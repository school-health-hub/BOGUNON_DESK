use crate::{
    observation::*,
    observation_fixture::Fake,
    observation_reader::Reader,
    outcome::{Capability, Report, WindowResult},
    window_lifecycle::{OwnedWindows, Role, WindowApi, WindowError},
};
use std::{cell::RefCell, rc::Rc};

#[derive(Default)]
struct FakeWindows {
    events: Vec<&'static str>,
    fail_create: Option<Role>,
    stale: bool,
    wrong_thread: bool,
    fail_destroy: bool,
    fail_unregister: bool,
    fail_register: bool,
}
impl WindowApi for Rc<RefCell<FakeWindows>> {
    type Id = usize;
    fn register(&mut self) -> Result<(), WindowError> {
        let mut fake = self.borrow_mut();
        fake.events.push("register");
        if fake.fail_register {
            Err(WindowError::Register)
        } else {
            Ok(())
        }
    }
    fn create(&mut self, role: Role, root: Option<usize>) -> Result<usize, WindowError> {
        let mut fake = self.borrow_mut();
        if fake.fail_create == Some(role) {
            return Err(WindowError::Create);
        }
        assert_eq!(root, if role == Role::Root { None } else { Some(1) });
        let id = match role {
            Role::Root => 1,
            Role::Owned => 2,
            Role::Child => 3,
        };
        fake.events.push(match role {
            Role::Root => "root",
            Role::Owned => "owned",
            Role::Child => "child",
        });
        Ok(id)
    }
    fn same_thread(&self) -> bool {
        !self.borrow().wrong_thread
    }
    fn identity_matches(&self, _: usize) -> bool {
        !self.borrow().stale
    }
    fn destroy(&mut self, id: usize) -> Result<(), WindowError> {
        let mut fake = self.borrow_mut();
        fake.events.push(match id {
            1 => "destroy-root",
            2 => "destroy-owned",
            3 => "destroy-child",
            _ => panic!("foreign"),
        });
        if fake.fail_destroy {
            Err(WindowError::Cleanup)
        } else {
            Ok(())
        }
    }
    fn unregister(&mut self) -> Result<(), WindowError> {
        let mut fake = self.borrow_mut();
        fake.events.push("unregister");
        if fake.fail_unregister {
            Err(WindowError::Cleanup)
        } else {
            Ok(())
        }
    }
}

#[test]
fn missing_worker_does_not_fail_valid_window_observation() {
    let mut fake = Fake::default();
    fake.shell.workers.clear();
    let mut reader = Reader(fake);
    let window = reader.0.window(WindowId(100)).unwrap();
    let capability = reader.collect(window.identity.id).map(|_| ());
    assert_eq!(
        Report::finish(Ok(()), capability, Ok(())),
        Report {
            window: WindowResult::Pass,
            capability: Capability::Unsupported
        }
    );
}
#[test]
fn shell_identity_failure_is_not_unsupported() {
    assert_eq!(
        Report::finish(Ok(()), Err(QueryError::ShellIdentity), Ok(())).capability,
        Capability::Fail
    );
}
#[test]
fn unobserved_capability_never_claims_supported() {
    assert_eq!(Report::not_run().capability, Capability::NotObserved);
    assert_eq!(Report::not_run().window, WindowResult::Blocked);
    assert_eq!(
        Report::not_run().line(),
        "WINDOW=BLOCKED CAPABILITY=NOT_OBSERVED"
    );
}
#[test]
fn cleanup_failure_overrides_successful_window_observation() {
    assert_eq!(
        Report::finish(Ok(()), Ok(()), Err(WindowError::Cleanup)).window,
        WindowResult::Fail
    );
}
#[test]
fn synthetic_creation_relations_and_reverse_cleanup_are_explicit() {
    let fake = Rc::new(RefCell::new(FakeWindows::default()));
    let mut owned = OwnedWindows::register(fake.clone()).unwrap();
    owned.create_all().unwrap();
    assert_eq!(owned.ids(), [1, 2, 3]);
    owned.close().unwrap();
    assert!(!owned.cleanup_status().get());
    assert_eq!(
        fake.borrow().events,
        [
            "register",
            "root",
            "owned",
            "child",
            "destroy-child",
            "destroy-owned",
            "destroy-root",
            "unregister"
        ]
    );
}
#[test]
fn partial_creation_cleans_only_created_windows() {
    let fake = Rc::new(RefCell::new(FakeWindows {
        fail_create: Some(Role::Child),
        ..Default::default()
    }));
    let mut owned = OwnedWindows::register(fake.clone()).unwrap();
    assert_eq!(owned.create_all(), Err(WindowError::Create));
    owned.close().unwrap();
    assert_eq!(
        &fake.borrow().events[3..],
        ["destroy-owned", "destroy-root", "unregister"]
    );
}
#[test]
fn stale_identity_or_wrong_thread_permits_zero_destroy_calls() {
    for wrong_thread in [true, false] {
        let fake = Rc::new(RefCell::new(FakeWindows::default()));
        let mut owned = OwnedWindows::register(fake.clone()).unwrap();
        owned.create_all().unwrap();
        fake.borrow_mut().wrong_thread = wrong_thread;
        fake.borrow_mut().stale = !wrong_thread;
        assert_eq!(owned.close(), Err(WindowError::Cleanup));
        drop(owned);
        assert_eq!(fake.borrow().events.len(), 4);
    }
}
#[test]
fn cleanup_failure_stops_without_destroying_parent_or_retrying() {
    let fake = Rc::new(RefCell::new(FakeWindows::default()));
    let mut owned = OwnedWindows::register(fake.clone()).unwrap();
    owned.create_all().unwrap();
    fake.borrow_mut().fail_destroy = true;
    assert_eq!(owned.close(), Err(WindowError::Cleanup));
    drop(owned);
    assert_eq!(fake.borrow().events.last(), Some(&"destroy-child"));
    assert_eq!(fake.borrow().events.len(), 5);
}
#[test]
fn class_cleanup_failure_is_reported() {
    let fake = Rc::new(RefCell::new(FakeWindows {
        fail_unregister: true,
        ..Default::default()
    }));
    let mut owned = OwnedWindows::register(fake).unwrap();
    owned.create_all().unwrap();
    assert_eq!(owned.close(), Err(WindowError::Cleanup));
}
#[test]
fn registration_failure_creates_no_window() {
    let fake = Rc::new(RefCell::new(FakeWindows {
        fail_register: true,
        ..Default::default()
    }));
    assert!(matches!(
        OwnedWindows::register(fake.clone()),
        Err(WindowError::Register)
    ));
    assert_eq!(fake.borrow().events, ["register"]);
}
#[test]
fn drop_cleanup_failure_is_observable_without_retry() {
    let fake = Rc::new(RefCell::new(FakeWindows::default()));
    let mut owned = OwnedWindows::register(fake.clone()).unwrap();
    owned.create_all().unwrap();
    let status = owned.cleanup_status();
    fake.borrow_mut().fail_destroy = true;
    drop(owned);
    assert!(status.get());
}
