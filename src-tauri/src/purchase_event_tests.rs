use super::*;
use std::cell::RefCell;

#[test]
fn result_and_error_follow_start_for_current_generation() {
    let state = PurchaseHelperState::default();
    state.active.store(true, Ordering::SeqCst);
    let events = RefCell::new(Vec::new());
    for terminal in ["result", "error"] {
        let generation = state.begin_analysis();
        events.borrow_mut().push((generation, "start"));
        assert!(state.deliver_current(
            generation,
            || true,
            terminal,
            |value| events.borrow_mut().push((generation, value))
        ));
    }
    assert_eq!(
        *events.borrow(),
        vec![(1, "start"), (1, "result"), (2, "start"), (2, "error")]
    );
}
#[test]
fn replaced_or_missing_main_suppresses_current_analysis() {
    let state = PurchaseHelperState::default();
    state.active.store(true, Ordering::SeqCst);
    let generation = state.begin_analysis();
    let mut sent = 0;
    assert!(!state.deliver_current(generation, || false, "synthetic", |_| sent += 1));
    assert_eq!(sent, 0);
}
#[test]
fn superseded_and_cancelled_analysis_never_reaches_sender() {
    let state = PurchaseHelperState::default();
    state.active.store(true, Ordering::SeqCst);
    let old = state.begin_analysis();
    let current = state.begin_analysis();
    let mut sent = 0;
    assert!(!state.deliver_current(old, || true, (), |_| sent += 1));
    state.invalidate_analysis();
    assert!(!state.deliver_current(current, || true, (), |_| sent += 1));
    let closed = state.begin_analysis();
    state.active.store(false, Ordering::SeqCst);
    assert!(!state.deliver_current(closed, || true, (), |_| sent += 1));
    assert_eq!(sent, 0);
}
