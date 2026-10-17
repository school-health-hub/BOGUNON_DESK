use crate::disposable_surface::Completion;
use crate::main_boundary::{Boundary, Error};
use crate::main_boundary_state::Authoritative;
use crate::main_boundary_tests::{available, command};
use crate::surface_event_types::{Action, Event};

#[test]
fn main_boundary_queued_command_is_rejected_after_loss() {
    let (mut main, binding) = available();
    let request = command(&mut main, &binding, 1);
    main.lost(&binding).unwrap();
    assert_eq!(main.process(&request), Err(Error::Unavailable));
}

#[test]
fn main_boundary_disposal_blocks_projection_and_recreation_until_confirmation() {
    let (mut main, binding) = available();
    let before = main.inspect().clone();
    let disposal = main.dispose().unwrap();
    main.disposed(&disposal, Completion::Succeeded).unwrap();
    assert!(main.projection(&binding).is_err());
    assert_eq!(main.create(), Err(Error::CleanupUncertain));
    assert!(main.confirm_cleanup(&binding).is_err());
    main.confirm_cleanup(&disposal).unwrap();
    assert!(main.create().is_ok());
    assert_eq!(main.inspect(), &before);
}

#[test]
fn main_boundary_recreation_rejects_prior_instance_command() {
    let (mut main, old) = available();
    let before = main.inspect().clone();
    let old_request = command(&mut main, &old, 1);
    main.lost(&old).unwrap();
    main.confirm_cleanup(&old).unwrap();
    assert!(main.create().is_err());
    let current = main.retry_create().unwrap();
    main.created(&current, Completion::Succeeded).unwrap();
    assert_eq!(main.process(&old_request), Err(Error::Instance));
    assert_eq!(main.inspect(), &before);
}

#[test]
fn main_boundary_failed_creation_cannot_retry_without_cleanup_confirmation() {
    let mut main = Boundary::new(Authoritative::synthetic());
    let binding = main.create().unwrap();
    main.created(&binding, Completion::Failed).unwrap();
    assert_eq!(main.retry_create(), Err(Error::CleanupUncertain));
    main.confirm_cleanup(&binding).unwrap();
    assert!(main.retry_create().is_ok());
}

#[test]
fn main_boundary_failed_disposal_blocks_recreation() {
    let (mut main, _) = available();
    let disposal = main.dispose().unwrap();
    main.disposed(&disposal, Completion::Failed).unwrap();
    main.confirm_cleanup(&disposal).unwrap();
    assert!(main.create().is_err());
    assert!(main.retry_create().is_err());
}

#[test]
fn main_boundary_queue_overflow_fails_closed_and_preserves_main() {
    let (mut main, binding) = available();
    let before = main.inspect().clone();
    let first = command(&mut main, &binding, 1);
    for sequence in 2..=8 {
        let _request = command(&mut main, &binding, sequence);
    }
    assert_eq!(
        main.route(Event {
            binding: binding.clone(),
            sequence: 9,
            action: Action::OpenMain
        }),
        Err(Error::ProtocolFault)
    );
    assert_eq!(main.process(&first), Err(Error::ProtocolFault));
    assert_eq!(main.projection(&binding), Err(Error::ProtocolFault));
    assert_eq!(main.inspect(), &before);
}

#[test]
fn main_boundary_real_coordinator_loss_closes_access() {
    let (mut main, binding) = available();
    let notice = crate::own_coordinator::Notice {
        binding: binding.clone(),
        kind: crate::own_coordinator::NoticeKind::Destroyed,
    };
    assert_eq!(
        main.observe_notices(&binding, vec![notice]),
        Err(Error::ProtocolFault)
    );
    assert!(main.projection(&binding).is_err());
    assert_eq!(main.retry_create(), Err(Error::CleanupUncertain));
    main.confirm_cleanup(&binding).unwrap();
    assert!(main.retry_create().is_ok());
}

#[test]
fn main_boundary_foreign_callback_fails_closed() {
    let (mut main, binding) = available();
    let (_, foreign) = available();
    let notice = crate::own_coordinator::Notice {
        binding: foreign,
        kind: crate::own_coordinator::NoticeKind::Destroyed,
    };
    assert_eq!(
        main.observe_notices(&binding, vec![notice]),
        Err(Error::ProtocolFault)
    );
    assert_eq!(main.projection(&binding), Err(Error::ProtocolFault));
    assert!(main.confirm_cleanup(&binding).is_err());
}
