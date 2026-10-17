use crate::disposable_surface::Completion;
use crate::main_boundary::{Boundary, Error};
use crate::main_boundary_state::Authoritative;
use crate::surface_event_types::{Action, Event};

pub(super) fn available() -> (Boundary, crate::surface_event_types::Binding) {
    let mut main = Boundary::new(Authoritative::synthetic());
    let binding = main.create().unwrap();
    main.created(&binding, Completion::Succeeded).unwrap();
    (main, binding)
}

#[test]
fn main_boundary_preserves_authoritative_state_when_surface_is_lost() {
    // Given an available Surface and Main-owned unsaved work.
    let (mut main, binding) = available();
    let before = main.inspect().clone();
    // When the Surface is lost.
    main.lost(&binding).unwrap();
    // Then all authoritative state survives and projection is unavailable.
    assert_eq!(main.inspect(), &before);
    assert!(main.projection(&binding).is_err());
    assert_eq!(main.retry_create(), Err(Error::CleanupUncertain));
}

#[test]
fn main_boundary_revalidates_queued_command_when_permission_revoked() {
    // Given a previously routed command.
    let (mut main, binding) = available();
    let request = main
        .route(Event {
            binding,
            sequence: 1,
            action: Action::OpenMain,
        })
        .unwrap();
    // When Main revokes permission before processing.
    main.set_permission(false);
    // Then the queued request cannot bypass Main authorization.
    assert_eq!(main.process(&request), Err(Error::Permission));
}

#[test]
fn main_boundary_rejects_command_when_authentication_revoked() {
    let (mut main, binding) = available();
    let request = main
        .route(Event {
            binding,
            sequence: 1,
            action: Action::OpenMain,
        })
        .unwrap();
    main.set_authenticated(false);
    assert_eq!(main.process(&request), Err(Error::Permission));
}

pub(super) fn command(
    main: &mut Boundary,
    binding: &crate::surface_event_types::Binding,
    sequence: u64,
) -> crate::surface_event_types::CommandRequest {
    main.route(Event {
        binding: binding.clone(),
        sequence,
        action: Action::OpenMain,
    })
    .unwrap()
}

#[test]
fn main_boundary_minimal_projection_is_detached_immutable_value() {
    let (main, binding) = available();
    let projection = *main.projection(&binding).unwrap();
    assert_eq!((projection.revision(), projection.open_tasks()), (1, 2));
    assert_eq!(*main.projection(&binding).unwrap(), projection);
}

#[test]
fn main_boundary_normal_command_returns_decision_without_mutating_main() {
    let (mut main, binding) = available();
    let before = main.inspect().clone();
    let request = command(&mut main, &binding, 1);
    assert_eq!(main.process(&request), Ok(Action::OpenMain));
    assert_eq!(main.inspect(), &before);
}

#[test]
fn main_boundary_refresh_remains_allowed_when_open_main_disallowed() {
    let (mut main, binding) = available();
    main.allow_open(false);
    let request = main
        .route(Event {
            binding,
            sequence: 1,
            action: Action::RefreshProjection,
        })
        .unwrap();
    assert_eq!(main.process(&request), Ok(Action::RefreshProjection));
}

#[test]
fn main_boundary_denied_command_consumes_sequence_without_blocking_successor() {
    let (mut main, binding) = available();
    let first = command(&mut main, &binding, 1);
    let second = command(&mut main, &binding, 2);
    main.allow_open(false);
    assert_eq!(main.process(&first), Err(Error::Disallowed));
    main.allow_open(true);
    assert_eq!(main.process(&second), Ok(Action::OpenMain));
}

#[test]
fn main_boundary_duplicate_main_processing_is_rejected() {
    let (mut main, binding) = available();
    let request = command(&mut main, &binding, 1);
    assert!(main.process(&request).is_ok());
    assert_eq!(main.process(&request), Err(Error::Sequence));
}

#[test]
fn main_boundary_out_of_order_main_processing_retains_expected_command() {
    let (mut main, binding) = available();
    let first = command(&mut main, &binding, 1);
    let second = command(&mut main, &binding, 2);
    assert_eq!(main.process(&second), Err(Error::Sequence));
    assert!(main.process(&first).is_ok());
    assert!(main.process(&second).is_ok());
}

#[test]
fn main_boundary_router_duplicate_and_gap_are_rejected() {
    let (mut main, binding) = available();
    let _request = command(&mut main, &binding, 1);
    for sequence in [1, 3, 0] {
        assert!(main
            .route(Event {
                binding: binding.clone(),
                sequence,
                action: Action::OpenMain
            })
            .is_err());
    }
    assert!(main
        .route(Event {
            binding,
            sequence: 2,
            action: Action::OpenMain
        })
        .is_ok());
}

#[test]
fn main_boundary_foreign_instance_is_rejected_by_main() {
    let (mut main, _) = available();
    let (mut other, foreign) = available();
    let request = command(&mut other, &foreign, 1);
    assert_eq!(main.process(&request), Err(Error::Instance));
}

#[test]
fn main_boundary_stale_generation_is_rejected_even_with_current_instance() {
    let (mut main, old) = available();
    let mut request = command(&mut main, &old, 1);
    main.lost(&old).unwrap();
    main.confirm_cleanup(&old).unwrap();
    let current = main.retry_create().unwrap();
    main.created(&current, Completion::Succeeded).unwrap();
    request.binding.instance = current.instance().clone();
    assert_eq!(main.process(&request), Err(Error::Generation));
}

#[test]
fn main_boundary_stale_operation_is_rejected_after_disposal_starts() {
    let (mut main, binding) = available();
    let request = command(&mut main, &binding, 1);
    main.dispose().unwrap();
    assert_eq!(main.process(&request), Err(Error::Operation));
}
