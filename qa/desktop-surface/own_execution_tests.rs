use crate::own_coordinator::{Driver, Notice, NoticeKind};
use crate::own_execution::execute;
use crate::own_result::Error;
use crate::surface_event_types::Binding;
use std::{cell::RefCell, rc::Rc};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Fault {
    None,
    Create,
    Observe,
    Cleanup,
    Remaining,
    Drop,
    ObserveCleanup,
}
struct Fake {
    fault: Fault,
    trace: Rc<RefCell<Vec<&'static str>>>,
    notices: Vec<Notice>,
}
impl Fake {
    fn new(fault: Fault, trace: &Rc<RefCell<Vec<&'static str>>>) -> Self {
        Self {
            fault,
            trace: trace.clone(),
            notices: Vec::new(),
        }
    }
}
impl Driver for Fake {
    fn create(&mut self, binding: &Binding) -> Result<(), Error> {
        self.trace.borrow_mut().push("create");
        if self.fault == Fault::Create {
            panic!("SYNTHETIC_PRIVATE_CREATE");
        }
        self.notices.push(Notice {
            binding: binding.clone(),
            kind: NoticeKind::Created,
        });
        Ok(())
    }
    fn observe(&mut self) -> Result<(), Error> {
        self.trace.borrow_mut().push("observe");
        if matches!(self.fault, Fault::Observe | Fault::ObserveCleanup) {
            panic!("SYNTHETIC_PRIVATE_OBSERVE");
        }
        Ok(())
    }
    fn drain(&mut self) -> Result<Vec<Notice>, Error> {
        Ok(std::mem::take(&mut self.notices))
    }
    fn dispose(&mut self, binding: &Binding) -> Result<(), Error> {
        self.trace.borrow_mut().push("dispose");
        self.notices.push(Notice {
            binding: binding.clone(),
            kind: NoticeKind::Destroyed,
        });
        Ok(())
    }
    fn cleanup(&mut self) -> Result<(), Error> {
        self.trace.borrow_mut().push("cleanup");
        if matches!(self.fault, Fault::Cleanup | Fault::ObserveCleanup) {
            panic!("SYNTHETIC_PRIVATE_CLEANUP");
        }
        Ok(())
    }
    fn remaining(&self) -> Option<u32> {
        self.trace.borrow_mut().push("remaining");
        if self.fault == Fault::Remaining {
            panic!("SYNTHETIC_PRIVATE_REMAINING");
        }
        Some(0)
    }
}
impl Drop for Fake {
    fn drop(&mut self) {
        self.trace.borrow_mut().push("drop");
        if self.fault == Fault::Drop {
            panic!("SYNTHETIC_PRIVATE_DROP");
        }
    }
}

#[test]
fn owner_release_precedes_evidence_publication() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::None, &trace),
        |_| {
            trace.borrow_mut().push("persist");
            Ok(())
        },
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 0); // Then
    assert_eq!(
        *trace.borrow(),
        [
            "create",
            "observe",
            "dispose",
            "cleanup",
            "remaining",
            "drop",
            "persist"
        ]
    );
}
#[test]
fn partial_create_panic_still_cleans_and_releases_owner() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::Create, &trace),
        |_| {
            trace.borrow_mut().push("persist");
            Ok(())
        },
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 4); // Then
    assert_eq!(
        *trace.borrow(),
        ["create", "cleanup", "remaining", "drop", "persist"]
    );
}
#[test]
fn observation_panic_still_cleans_and_releases_owner() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::Observe, &trace),
        |_| Ok(()),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 4); // Then
    assert_eq!(
        *trace.borrow(),
        ["create", "observe", "cleanup", "remaining", "drop"]
    );
}
#[test]
fn cleanup_panic_blocks_success() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::Cleanup, &trace),
        |_| Ok(()),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 5); // Then
}
#[test]
fn cleanup_panic_has_priority_over_observation_panic() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::ObserveCleanup, &trace),
        |_| Ok(()),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 5); // Then
}
#[test]
fn remaining_query_panic_is_unverified_cleanup() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::Remaining, &trace),
        |_| Ok(()),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 5); // Then
    assert_eq!(report.remaining, None);
}
#[test]
fn release_panic_is_recorded_before_evidence() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::Drop, &trace),
        |evidence| {
            assert!(evidence.panicked);
            assert_eq!(evidence.cleanup, crate::own_result::Check::Fail);
            trace.borrow_mut().push("persist");
            Ok(())
        },
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 5); // Then
    assert_eq!(trace.borrow().last(), Some(&"persist"));
}
#[test]
fn evidence_error_has_failure_exit_after_cleanup() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::None, &trace),
        |_| Err(Error::Evidence),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 6); // Then
}
#[test]
fn evidence_panic_is_caught_after_owner_release() {
    let trace = Rc::new(RefCell::new(Vec::new())); // Given
    let report = execute(
        Fake::new(Fault::None, &trace),
        |_| panic!("SYNTHETIC_PRIVATE_EVIDENCE"),
        "source",
        "artifact",
    ); // When
    assert_eq!(report.code(), 4); // Then
    assert_eq!(trace.borrow().last(), Some(&"drop"));
}
