use crate::async_surface::{Error, Event, SyntheticDecision};
use crate::async_surface_tests::{available, clean, creating, lost, run};
use crate::disposable_surface::{Completion, State};
use crate::main_boundary::{Boundary, Error as MainError};
use crate::main_boundary_state::Authoritative;
use crate::surface_event_types::{Action, CommandRequest, Event as Callback};
#[test]
fn async_surface_stale_cleanup_cannot_clear_current_failure() {
    // Given replacement cleanup failure; When an old confirmation arrives; Then failure persists.
    let (mut s, old) = lost();
    clean(&mut s, &old);
    run(&mut s, Event::ReplacementRequested).unwrap();
    let b = s.binding().unwrap().clone();
    run(&mut s, Event::CreateFailed(b.clone())).unwrap();
    run(&mut s, Event::CleanupStarted(b.clone())).unwrap();
    run(&mut s, Event::CleanupFailed(b)).unwrap();
    assert_eq!(run(&mut s, Event::CleanupConfirmed(old)), Err(Error::Stale));
    assert_eq!(run(&mut s, Event::ReplacementRequested), Err(Error::Order));
}
#[test]
fn async_surface_old_command_and_operation_rejected_after_replacement() {
    // Given replacement; When previous binding is presented; Then both command and completion are stale.
    let (mut s, old) = available();
    run(&mut s, Event::CloseRequested).unwrap();
    let closing = s.binding().unwrap().clone();
    assert_eq!(
        run(&mut s, Event::CreateCompleted(old.clone())),
        Err(Error::Stale)
    );
    run(&mut s, Event::CloseCompleted(closing.clone())).unwrap();
    clean(&mut s, &closing);
    run(&mut s, Event::ReplacementRequested).unwrap();
    let b = s.binding().unwrap().clone();
    run(&mut s, Event::CreateCompleted(b)).unwrap();
    let command = CommandRequest {
        binding: old,
        sequence: 1,
        action: Action::OpenMain,
        revision: 1,
    };
    assert_eq!(s.process(&command), Err(Error::Stale));
}
#[test]
fn async_surface_queued_old_revision_rejected_without_router_reset() {
    // Given an issued request; When trusted Main updates; Then stale revision is denied and sequence continues.
    let mut main = Boundary::new(Authoritative::synthetic());
    let b = main.create().unwrap();
    main.created(&b, Completion::Succeeded).unwrap();
    let request = main
        .route(Callback {
            binding: b.clone(),
            sequence: 1,
            action: Action::OpenMain,
        })
        .unwrap();
    let before_state = main.lifecycle_state();
    main.update_main(9).unwrap();
    assert_eq!(main.process(&request), Err(MainError::Revision));
    assert_eq!(main.lifecycle_state(), before_state);
    assert_eq!(main.projection(&b).unwrap().revision(), 2);
    assert_eq!(main.projection(&b).unwrap().open_tasks(), 9);
    let next = main
        .route(Callback {
            binding: b,
            sequence: 2,
            action: Action::OpenMain,
        })
        .unwrap();
    assert_eq!(main.process(&next), Ok(Action::OpenMain));
}
#[test]
fn async_surface_initial_create_cannot_bypass_cleanup() {
    // Given completed close; When initial-create is repeated; Then cleanup and replacement protocol remain required.
    let (mut s, _) = available();
    run(&mut s, Event::CloseRequested).unwrap();
    let b = s.binding().unwrap().clone();
    run(&mut s, Event::CloseCompleted(b)).unwrap();
    assert_eq!(run(&mut s, Event::CreateRequested), Err(Error::Order));
}
#[test]
fn async_surface_admitted_close_survives_creation_steps() {
    // Given create/replacement queued before close; When creation starts; Then admission remains closed.
    for replacement in [false, true] {
        let (mut s, old) = lost();
        if replacement {
            clean(&mut s, &old);
        }
        let mut s = if replacement {
            s
        } else {
            crate::async_surface::AsyncSurface::new(Authoritative::synthetic())
        };
        s.enqueue(if replacement {
            Event::ReplacementRequested
        } else {
            Event::CreateRequested
        })
        .unwrap();
        s.enqueue(Event::CloseRequested).unwrap();
        s.step().unwrap();
        let b = s.binding().unwrap().clone();
        assert_eq!(
            s.enqueue(Event::CallbackArrived(Callback {
                binding: b,
                sequence: 1,
                action: Action::OpenMain
            })),
            Err(Error::Closed)
        );
    }
}
#[test]
fn async_surface_shared_retry_budget_is_not_reset() {
    // Given three explicit retries; When a fourth is requested; Then the shared lifecycle budget rejects it.
    let (mut s, mut b) = creating();
    for attempt in 0..4 {
        run(&mut s, Event::CreateFailed(b.clone())).unwrap();
        clean(&mut s, &b);
        let result = run(&mut s, Event::ReplacementRequested);
        if attempt == 3 {
            assert!(matches!(result, Err(Error::Boundary(_))));
        } else {
            assert!(matches!(result, Ok(SyntheticDecision::Binding(_))));
            b = s.binding().unwrap().clone();
        }
    }
}
#[test]
fn async_surface_main_update_preserves_active_binding() {
    // Given available state; When trusted Main updates; Then the binding and lifecycle survive.
    let (mut s, b) = available();
    s.update_main(7).unwrap();
    assert_eq!(s.binding(), Some(&b));
    assert!(matches!(s.state(), State::Available(_)));
}
#[test]
fn async_surface_queued_callback_revision_is_captured_at_admission() {
    // Given a callback observed at revision one; When Main advances; Then queued intent is rejected.
    let (mut s, b) = available();
    s.enqueue(Event::CallbackArrived(Callback {
        binding: b.clone(),
        sequence: 1,
        action: Action::OpenMain,
    }))
    .unwrap();
    s.update_main(8).unwrap();
    assert_eq!(s.step(), Err(Error::Boundary(MainError::Revision)));
    assert_eq!(
        run(
            &mut s,
            Event::CallbackArrived(Callback {
                binding: b,
                sequence: 1,
                action: Action::OpenMain
            })
        ),
        Ok(SyntheticDecision::Command(Action::OpenMain))
    );
}
