use crate::disposable_surface::{Completion, State, Support};
use crate::own_coordinator::{observed, run, Driver, Notice, NoticeKind};
use crate::own_result::Error;
use crate::surface_event_router::Router;
use crate::surface_event_types::{Binding, MainState};

struct LossDriver {
    notices: Vec<Notice>,
    binding: Option<Binding>,
    disposed: bool,
    observation_fails: bool,
}
impl Driver for LossDriver {
    fn create(&mut self, binding: &Binding) -> Result<(), Error> {
        self.binding = Some(binding.clone());
        self.notices.push(Notice {
            binding: binding.clone(),
            kind: NoticeKind::Created,
        });
        Ok(())
    }
    fn observe(&mut self) -> Result<(), Error> {
        self.notices.push(Notice {
            binding: self.binding.clone().expect("created"),
            kind: NoticeKind::Destroyed,
        });
        if self.observation_fails {
            Err(Error::Native)
        } else {
            Ok(())
        }
    }
    fn drain(&mut self) -> Result<Vec<Notice>, Error> {
        Ok(std::mem::take(&mut self.notices))
    }
    fn dispose(&mut self, _: &Binding) -> Result<(), Error> {
        self.disposed = true;
        Ok(())
    }
    fn cleanup(&mut self) -> Result<(), Error> {
        Ok(())
    }
    fn remaining(&self) -> Option<u32> {
        Some(0)
    }
}

fn available(main: &MainState) -> (Router, Binding) {
    let mut router = Router::new(main.projection(), 1);
    let binding = router.create(Support::Supported).unwrap();
    router.created(&binding, Completion::Succeeded).unwrap();
    (router, binding)
}

#[test]
fn confirmed_loss_transitions_actual_router_to_lost() {
    let main = MainState::new(7, 3, String::from("retained-note"));
    let before = main.projection();
    let (mut router, binding) = available(&main);
    let notices = vec![Notice {
        binding: binding.clone(),
        kind: NoticeKind::Destroyed,
    }];
    let result = observed(&mut router, &binding, notices);
    assert_eq!(result, Err(Error::Native));
    assert_eq!(
        router.state(),
        State::Lost(binding.operation().generation())
    );
    assert_eq!(main.projection(), before);
    assert_eq!(main.unsaved_note(), "retained-note");
}

#[test]
fn confirmed_loss_stops_native_disposal_even_after_observe_error() {
    for observation_fails in [false, true] {
        let mut driver = LossDriver {
            notices: Vec::new(),
            binding: None,
            disposed: false,
            observation_fails,
        };
        assert_eq!(run(&mut driver), Err(Error::Native));
        assert!(!driver.disposed);
    }
}

#[test]
fn foreign_captured_binding_is_rejected_without_main_mutation() {
    let main = MainState::new(7, 3, String::from("retained-note"));
    let before = main.projection();
    let (mut router, binding) = available(&main);
    let (_, foreign) = available(&main);
    let notices = vec![Notice {
        binding: foreign,
        kind: NoticeKind::Destroyed,
    }];
    assert_eq!(
        observed(&mut router, &binding, notices),
        Err(Error::Callback)
    );
    assert_eq!(
        router.state(),
        State::Available(binding.operation().generation())
    );
    assert_eq!(main.projection(), before);
}

#[test]
fn duplicate_or_reordered_loss_is_rejected_without_main_mutation() {
    let main = MainState::new(7, 3, String::from("retained-note"));
    let before = main.projection();
    for kind in [
        NoticeKind::Destroyed,
        NoticeKind::Created,
        NoticeKind::CloseRequested,
    ] {
        let (mut router, binding) = available(&main);
        let notices = vec![
            Notice {
                binding: binding.clone(),
                kind,
            },
            Notice {
                binding: binding.clone(),
                kind: NoticeKind::Destroyed,
            },
        ];
        assert_eq!(
            observed(&mut router, &binding, notices),
            Err(Error::Callback)
        );
        assert_eq!(
            router.state(),
            State::Available(binding.operation().generation())
        );
        assert_eq!(main.projection(), before);
    }
}

#[test]
fn lone_close_or_created_notice_cannot_become_confirmed_loss() {
    let main = MainState::new(7, 3, String::from("retained-note"));
    for kind in [NoticeKind::Created, NoticeKind::CloseRequested] {
        let (mut router, binding) = available(&main);
        assert_eq!(
            observed(
                &mut router,
                &binding,
                vec![Notice {
                    binding: binding.clone(),
                    kind
                }]
            ),
            Err(Error::Callback)
        );
    }
}
