use crate::async_surface::{AsyncSurface, Error, Event, SyntheticDecision};
use crate::disposable_surface::State;
use crate::main_boundary_state::Authoritative;
use crate::surface_event_types::{Action, Binding, Event as Callback};
pub(super) fn run(s: &mut AsyncSurface, e: Event) -> Result<SyntheticDecision, Error> {
    s.enqueue(e)?;
    s.step()
}
pub(super) fn creating() -> (AsyncSurface, Binding) {
    let mut s = AsyncSurface::new(Authoritative::synthetic());
    run(&mut s, Event::CreateRequested).unwrap();
    let b = s.binding().unwrap().clone();
    (s, b)
}
pub(super) fn available() -> (AsyncSurface, Binding) {
    let (mut s, b) = creating();
    run(&mut s, Event::CreateCompleted(b.clone())).unwrap();
    (s, b)
}
pub(super) fn lost() -> (AsyncSurface, Binding) {
    let (mut s, b) = available();
    run(&mut s, Event::SurfaceLost(b.clone())).unwrap();
    (s, b)
}
pub(super) fn clean(s: &mut AsyncSurface, b: &Binding) {
    run(s, Event::CleanupStarted(b.clone())).unwrap();
    run(s, Event::CleanupConfirmed(b.clone())).unwrap();
}
#[test]
fn async_surface_delayed_create() {
    // Given creation; When no completion arrives; Then it stays Creating.
    let (s, _) = creating();
    assert!(matches!(s.state(), State::Creating(_)));
}
#[test]
fn async_surface_close_during_creation() {
    // Given pending creation; When close precedes completion; Then disposal follows completion.
    let (mut s, b) = creating();
    run(&mut s, Event::CloseRequested).unwrap();
    run(&mut s, Event::CreateCompleted(b)).unwrap();
    assert!(matches!(s.state(), State::Disposing(_)));
}
#[test]
fn async_surface_create_immediately_lost_preserves_main() {
    // Given available state; When loss arrives; Then Main survives.
    let (mut s, b) = available();
    let before = s.inspect().clone();
    run(&mut s, Event::SurfaceLost(b)).unwrap();
    assert_eq!(s.inspect(), &before);
    assert!(matches!(s.state(), State::Lost(_)));
}
#[test]
fn async_surface_close_admission_blocks_queued_callback() {
    // Given a queued callback; When close is admitted; Then callback cannot execute.
    let (mut s, b) = available();
    s.enqueue(Event::CallbackArrived(Callback {
        binding: b.clone(),
        sequence: 1,
        action: Action::OpenMain,
    }))
    .unwrap();
    s.enqueue(Event::CloseRequested).unwrap();
    assert_eq!(s.step(), Err(Error::Closed));
    assert_eq!(
        s.enqueue(Event::CallbackArrived(Callback {
            binding: b,
            sequence: 2,
            action: Action::OpenMain
        })),
        Err(Error::Closed)
    );
}
#[test]
fn async_surface_replacement_waits_for_close_and_cleanup() {
    // Given closing state; When replacement is requested early; Then it is rejected.
    let (mut s, _) = available();
    run(&mut s, Event::CloseRequested).unwrap();
    assert_eq!(run(&mut s, Event::ReplacementRequested), Err(Error::Order));
    let close = s.binding().unwrap().clone();
    run(&mut s, Event::CloseCompleted(close.clone())).unwrap();
    assert_eq!(run(&mut s, Event::ReplacementRequested), Err(Error::Order));
    clean(&mut s, &close);
    assert!(matches!(
        run(&mut s, Event::ReplacementRequested),
        Ok(SyntheticDecision::Binding(_))
    ));
}
#[test]
fn async_surface_old_completions_do_not_poison_replacement() {
    // Given a replacement; When old completions arrive; Then current creation still completes.
    let (mut s, old) = available();
    run(&mut s, Event::CloseRequested).unwrap();
    let close = s.binding().unwrap().clone();
    run(&mut s, Event::CloseCompleted(close.clone())).unwrap();
    clean(&mut s, &close);
    run(&mut s, Event::ReplacementRequested).unwrap();
    let current = s.binding().unwrap().clone();
    assert_eq!(run(&mut s, Event::CreateCompleted(old)), Err(Error::Stale));
    assert_eq!(run(&mut s, Event::CloseCompleted(close)), Err(Error::Stale));
    run(&mut s, Event::CreateCompleted(current)).unwrap();
    assert!(matches!(s.state(), State::Available(_)));
}
#[test]
fn async_surface_cleanup_failure_requires_explicit_recovery() {
    // Given failed cleanup; When recreate or confirmation is attempted; Then explicit restart is required.
    let (mut s, b) = lost();
    run(&mut s, Event::CleanupStarted(b.clone())).unwrap();
    run(&mut s, Event::CleanupFailed(b.clone())).unwrap();
    assert_eq!(run(&mut s, Event::ReplacementRequested), Err(Error::Order));
    assert_eq!(
        run(&mut s, Event::CleanupConfirmed(b.clone())),
        Err(Error::Order)
    );
    assert_eq!(run(&mut s, Event::CleanupStarted(b)), Err(Error::Order));
    assert_eq!(run(&mut s, Event::ReplacementRequested), Err(Error::Order));
}
#[test]
fn async_surface_duplicate_cleanup_and_reverse_events_rejected() {
    // Given lost state; When events reverse or repeat; Then neither clears a latch.
    let (mut s, b) = lost();
    assert_eq!(
        run(&mut s, Event::CleanupConfirmed(b.clone())),
        Err(Error::Order)
    );
    assert_eq!(
        run(&mut s, Event::CloseCompleted(b.clone())),
        Err(Error::Order)
    );
    clean(&mut s, &b);
    assert_eq!(run(&mut s, Event::CleanupConfirmed(b)), Err(Error::Order));
}
#[test]
fn async_surface_overflow_fails_closed() {
    // Given a full queue; When admission overflows; Then commands remain blocked.
    let (mut s, b) = available();
    for _ in 0..8 {
        s.enqueue(Event::CreateRequested).unwrap();
    }
    assert_eq!(s.enqueue(Event::CreateRequested), Err(Error::Overflow));
    assert_eq!(
        s.enqueue(Event::CallbackArrived(Callback {
            binding: b,
            sequence: 1,
            action: Action::OpenMain
        })),
        Err(Error::Overflow)
    );
}
#[test]
fn async_surface_loss_close_race_both_orders() {
    // Given available state; When loss races close in either order; Then commands stay unavailable.
    for loss_first in [false, true] {
        let (mut s, b) = available();
        if loss_first {
            run(&mut s, Event::SurfaceLost(b)).unwrap();
            run(&mut s, Event::CloseRequested).unwrap();
        } else {
            run(&mut s, Event::CloseRequested).unwrap();
            let close = s.binding().unwrap().clone();
            run(&mut s, Event::SurfaceLost(close.clone())).unwrap();
            run(&mut s, Event::CloseCompleted(close)).unwrap();
        }
        assert!(!matches!(s.state(), State::Available(_)));
    }
}
#[test]
fn async_surface_duplicate_create_and_callback_sequence_rejected() {
    // Given completion and first callback; When either repeats or reverses; Then it is rejected.
    let (mut s, b) = available();
    assert_eq!(
        run(&mut s, Event::CreateCompleted(b.clone())),
        Err(Error::Order)
    );
    for seq in [2, 0] {
        assert!(run(
            &mut s,
            Event::CallbackArrived(Callback {
                binding: b.clone(),
                sequence: seq,
                action: Action::OpenMain
            })
        )
        .is_err());
    }
    assert_eq!(
        run(
            &mut s,
            Event::CallbackArrived(Callback {
                binding: b.clone(),
                sequence: 1,
                action: Action::OpenMain
            })
        ),
        Ok(SyntheticDecision::Command(Action::OpenMain))
    );
    assert!(run(
        &mut s,
        Event::CallbackArrived(Callback {
            binding: b,
            sequence: 1,
            action: Action::OpenMain
        })
    )
    .is_err());
}
#[test]
fn async_surface_create_failure_replacement_is_explicit() {
    // Given failed creation; When no replacement is requested; Then no automatic creation occurs.
    let (mut s, b) = creating();
    run(&mut s, Event::CreateFailed(b.clone())).unwrap();
    assert_eq!(s.step(), Ok(SyntheticDecision::Idle));
    clean(&mut s, &b);
    run(&mut s, Event::ReplacementRequested).unwrap();
}
