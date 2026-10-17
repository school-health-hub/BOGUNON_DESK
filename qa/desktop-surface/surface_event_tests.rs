use crate::disposable_surface::{Completion, Support};
use crate::surface_event_router::Router;
use crate::surface_event_types::*;

pub(super) fn main_state() -> MainState {
    MainState::new(7, 3, String::from("synthetic unsaved work"))
}
pub(super) fn available(router: &mut Router) -> Binding {
    let binding = router.create(Support::Supported).unwrap();
    router.created(&binding, Completion::Succeeded).unwrap();
    binding
}
pub(super) fn event(binding: &Binding, sequence: u64) -> Event {
    Event {
        binding: binding.clone(),
        sequence,
        action: Action::OpenMain,
    }
}

#[test]
fn projection_is_detached_and_exposes_only_read_access() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    let binding = available(&mut router);
    let view = router.projection(&binding).unwrap();
    assert_eq!((view.revision(), view.open_tasks()), (7, 3));
    assert_eq!(main.unsaved_note(), "synthetic unsaved work");
}

#[test]
fn valid_event_returns_a_request_without_executing_main_work() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    let binding = available(&mut router);
    let request = router.accept(event(&binding, 1)).unwrap();
    assert_eq!(request.binding(), &binding);
    assert_eq!(
        (request.sequence(), request.action(), request.revision()),
        (1, Action::OpenMain, 7)
    );
    assert_eq!(main, main_state());
}

#[test]
fn matching_core_counters_do_not_allow_cross_instance_events() {
    let projection = main_state().projection();
    let mut first = Router::new(projection, 1);
    let old = available(&mut first);
    let mut second = Router::new(projection, 1);
    let current = available(&mut second);
    assert_eq!(old.operation(), current.operation());
    assert_ne!(old.instance(), current.instance());
    assert_eq!(second.accept(event(&old, 1)), Err(RouteError::Instance));
    assert!(second.accept(event(&current, 1)).is_ok());
}

#[test]
fn stale_generation_is_rejected_even_with_current_instance_envelope() {
    let mut router = Router::new(main_state().projection(), 1);
    let old = available(&mut router);
    router.lost(&old).unwrap();
    let current = router.retry_create(Support::Supported).unwrap();
    router.created(&current, Completion::Succeeded).unwrap();
    let mixed = Binding {
        instance: current.instance().clone(),
        operation: old.operation(),
    };
    assert_eq!(router.accept(event(&mixed, 1)), Err(RouteError::Operation));
}

#[test]
fn duplicate_events_are_rejected_without_consuming_next_sequence() {
    let mut router = Router::new(main_state().projection(), 1);
    let binding = available(&mut router);
    router.accept(event(&binding, 1)).unwrap();
    assert_eq!(router.accept(event(&binding, 1)), Err(RouteError::Sequence));
    assert!(router.accept(event(&binding, 2)).is_ok());
}

#[test]
fn out_of_order_events_are_not_buffered_or_accepted() {
    let mut router = Router::new(main_state().projection(), 1);
    let binding = available(&mut router);
    assert_eq!(router.accept(event(&binding, 2)), Err(RouteError::Sequence));
    assert_eq!(router.accept(event(&binding, 0)), Err(RouteError::Sequence));
    assert!(router.accept(event(&binding, 1)).is_ok());
}

#[test]
fn replacement_rejects_old_callbacks_and_resets_only_event_sequence() {
    let mut router = Router::new(main_state().projection(), 1);
    let old = available(&mut router);
    router.accept(event(&old, 1)).unwrap();
    router.lost(&old).unwrap();
    let current = router.retry_create(Support::Supported).unwrap();
    router.created(&current, Completion::Succeeded).unwrap();
    assert_ne!(old.instance(), current.instance());
    assert_eq!(
        router.created(&old, Completion::Succeeded),
        Err(RouteError::Instance)
    );
    assert!(router.accept(event(&current, 1)).is_ok());
}

#[test]
fn retained_callback_tokens_prevent_aba_across_dropped_routers() {
    let projection = main_state().projection();
    let old = {
        let mut router = Router::new(projection, 0);
        available(&mut router)
    };
    for _ in 0..64 {
        let mut router = Router::new(projection, 0);
        let current = available(&mut router);
        assert_ne!(old.instance(), current.instance());
        assert_eq!(
            router.created(&old, Completion::Succeeded),
            Err(RouteError::Instance)
        );
    }
}

#[test]
fn duplicate_create_and_dispose_join_the_existing_binding() {
    let mut router = Router::new(main_state().projection(), 1);
    let first = router.create(Support::Supported).unwrap();
    assert_eq!(router.create(Support::Supported), Ok(first.clone()));
    router.created(&first, Completion::Succeeded).unwrap();
    let disposal = router.dispose().unwrap();
    assert_eq!(router.dispose(), Ok(disposal));
}

#[test]
fn same_generation_old_operation_is_rejected_during_disposal_retry() {
    let mut router = Router::new(main_state().projection(), 1);
    available(&mut router);
    let old = router.dispose().unwrap();
    router.disposed(&old, Completion::Failed).unwrap();
    let current = router.retry_dispose().unwrap();
    assert_eq!(
        old.operation().generation(),
        current.operation().generation()
    );
    assert_eq!(old.instance(), current.instance());
    assert_eq!(
        router.disposed(&old, Completion::Succeeded),
        Err(RouteError::Operation)
    );
}
