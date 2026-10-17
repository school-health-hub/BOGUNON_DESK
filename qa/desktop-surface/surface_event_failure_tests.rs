use crate::disposable_surface::{Completion, Error, State, Support};
use crate::surface_event_router::Router;
use crate::surface_event_tests::{available, event, main_state};
use crate::surface_event_types::*;

#[test]
fn events_and_projection_are_rejected_while_creating() {
    let mut router = Router::new(main_state().projection(), 1);
    let binding = router.create(Support::Supported).unwrap();
    assert_eq!(router.accept(event(&binding, 1)), Err(RouteError::Inactive));
    assert_eq!(router.projection(&binding), Err(RouteError::Inactive));
}

#[test]
fn surface_loss_revokes_events_and_read_access_without_touching_main() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    let binding = available(&mut router);
    router.lost(&binding).unwrap();
    assert_eq!(router.accept(event(&binding, 1)), Err(RouteError::Inactive));
    assert_eq!(router.projection(&binding), Err(RouteError::Inactive));
    assert_eq!(main, main_state());
}

#[test]
fn disposal_in_progress_rejects_even_an_exact_current_binding() {
    let mut router = Router::new(main_state().projection(), 1);
    available(&mut router);
    let disposal = router.dispose().unwrap();
    assert_eq!(
        router.accept(event(&disposal, 1)),
        Err(RouteError::Inactive)
    );
}

#[test]
fn failed_disposal_preserves_main_and_blocks_recreation_and_events() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    available(&mut router);
    let disposal = router.dispose().unwrap();
    router.disposed(&disposal, Completion::Failed).unwrap();
    assert_eq!(
        router.accept(event(&disposal, 1)),
        Err(RouteError::Inactive)
    );
    assert_eq!(
        router.retry_create(Support::Supported),
        Err(RouteError::Lifecycle(Error::InvalidTransition))
    );
    assert_eq!(main, main_state());
}

#[test]
fn creation_failure_and_budget_exhaustion_preserve_main_and_failed_state() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    let first = router.create(Support::Supported).unwrap();
    router.created(&first, Completion::Failed).unwrap();
    assert_eq!(router.accept(event(&first, 1)), Err(RouteError::Inactive));
    let retry = router.retry_create(Support::Supported).unwrap();
    router.created(&retry, Completion::Failed).unwrap();
    let before = router.state();
    assert_eq!(
        router.retry_create(Support::Supported),
        Err(RouteError::Lifecycle(Error::RetryLimit))
    );
    assert_eq!(router.state(), before);
    assert_eq!(main, main_state());
}

#[test]
fn late_cleanup_cannot_clear_a_replacement_instance() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    available(&mut router);
    let old_cleanup = router.dispose().unwrap();
    router
        .disposed(&old_cleanup, Completion::Succeeded)
        .unwrap();
    let current = available(&mut router);
    let before = router.state();
    assert_eq!(
        router.disposed(&old_cleanup, Completion::Succeeded),
        Err(RouteError::Instance)
    );
    assert_eq!(router.state(), before);
    assert!(router.accept(event(&current, 1)).is_ok());
    assert_eq!(main, main_state());
}

#[test]
fn duplicate_cleanup_and_events_after_disposal_cannot_reactivate_surface() {
    let mut router = Router::new(main_state().projection(), 0);
    available(&mut router);
    let cleanup = router.dispose().unwrap();
    router.disposed(&cleanup, Completion::Succeeded).unwrap();
    assert_eq!(
        router.disposed(&cleanup, Completion::Succeeded),
        Err(RouteError::Lifecycle(Error::InvalidTransition))
    );
    assert_eq!(router.accept(event(&cleanup, 1)), Err(RouteError::Inactive));
    assert_eq!(router.state(), State::Absent);
}

#[test]
fn unsupported_reprobe_does_not_reset_the_existing_retry_budget() {
    let mut router = Router::new(main_state().projection(), 1);
    assert_eq!(
        router.create(Support::Unsupported),
        Err(RouteError::Lifecycle(Error::Unsupported))
    );
    assert_eq!(
        router.retry_create(Support::Unsupported),
        Err(RouteError::Lifecycle(Error::Unsupported))
    );
    assert_eq!(
        router.retry_create(Support::Supported),
        Err(RouteError::Lifecycle(Error::RetryLimit))
    );
    assert_eq!(router.state(), State::Unsupported);
}

#[test]
fn replacement_keeps_retry_budget_instead_of_constructing_a_new_core() {
    let mut router = Router::new(main_state().projection(), 1);
    let first = available(&mut router);
    router.lost(&first).unwrap();
    let retry = router.retry_create(Support::Supported).unwrap();
    router.created(&retry, Completion::Succeeded).unwrap();
    router.lost(&retry).unwrap();
    assert_eq!(
        router.retry_create(Support::Supported),
        Err(RouteError::Lifecycle(Error::RetryLimit))
    );
}

#[test]
fn refresh_is_only_a_request_and_does_not_replace_the_projection() {
    let main = main_state();
    let mut router = Router::new(main.projection(), 1);
    let binding = available(&mut router);
    let mut input = event(&binding, 1);
    input.action = Action::RefreshProjection;
    assert_eq!(
        router.accept(input).unwrap().action(),
        Action::RefreshProjection
    );
    assert_eq!(router.projection(&binding), Ok(&main.projection()));
    assert_eq!(main, main_state());
}
