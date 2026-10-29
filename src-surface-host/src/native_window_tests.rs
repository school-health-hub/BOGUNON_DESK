use super::{confirm_native_release, NativeReleaseState, WindowResizeState};
use std::cell::Cell;

#[test]
fn native_release_state_advances_only_after_each_confirmed_operation() {
    let mut state = NativeReleaseState::owned();
    let unregister_calls = Cell::new(0);

    let result = confirm_native_release(
        &mut state,
        || Err::<(), _>("destroy failed"),
        || {
            unregister_calls.set(unregister_calls.get() + 1);
            Ok(())
        },
    );

    assert_eq!(result, Err("destroy failed"));
    assert!(state.window_owned());
    assert!(state.class_owned());
    assert_eq!(unregister_calls.get(), 0);
}

#[test]
fn partial_native_release_keeps_only_the_unconfirmed_class_owned() {
    let mut state = NativeReleaseState::owned();

    let result = confirm_native_release(
        &mut state,
        || Ok::<(), &str>(()),
        || Err("unregister failed"),
    );

    assert_eq!(result, Err("unregister failed"));
    assert!(!state.window_owned());
    assert!(state.class_owned());
}

#[test]
fn confirmed_native_release_is_idempotent_at_the_internal_state_seam() {
    let mut state = NativeReleaseState::owned();
    let calls = Cell::new(0);
    let release = || {
        calls.set(calls.get() + 1);
        Ok::<(), &str>(())
    };

    assert_eq!(confirm_native_release(&mut state, release, release), Ok(()));
    assert_eq!(confirm_native_release(&mut state, release, release), Ok(()));
    assert_eq!(calls.get(), 2);
    assert!(!state.window_owned());
    assert!(!state.class_owned());
}

#[test]
fn close_request_is_latched_until_owned_cleanup_runs() {
    let state = super::WindowCloseState::new();
    assert!(!state.is_requested());
    super::WindowCloseState::request();
    assert!(state.is_requested());
    super::WindowCloseState::request();
    assert!(state.is_requested());
}

#[test]
fn resize_request_is_consumed_once_per_window_message() {
    let state = WindowResizeState::new();
    assert!(!state.take_requested());
    WindowResizeState::request();
    assert!(state.take_requested());
    assert!(!state.take_requested());
}
