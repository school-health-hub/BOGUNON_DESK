use super::*;
use std::cell::Cell;

fn pinned() -> Pinned {
    Pinned {
        webview: Arc::new(Identity),
        window: Arc::new(Identity),
    }
}
fn observed(pinned: &Pinned) -> Observed<'static> {
    Observed {
        webview_label: "main",
        window_label: "main",
        caller_webview: Some(Arc::clone(&pinned.webview)),
        caller_window: Some(Arc::clone(&pinned.window)),
        registered_webview: Some(Arc::clone(&pinned.webview)),
        registered_window: Some(Arc::clone(&pinned.window)),
    }
}
#[test]
fn main_without_login_can_restore_session() {
    let pinned = pinned();
    let calls = Cell::new(0);
    let result = pinned
        .authorize(observed(&pinned))
        .map_err(CommandError::caller)
        .and_then(|permit| {
            permit.run(|| {
                calls.set(calls.get() + 1);
                Ok::<_, String>(None::<String>)
            })
        });
    assert!(matches!(result, Ok(None)));
    assert_eq!(calls.get(), 1);
}
#[test]
fn non_main_is_rejected() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.webview_label = "surface";
    assert!(matches!(pinned.authorize(input), Err(Error::NotMain)));
}
#[test]
fn matching_labels_do_not_authorize_a_different_webview() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.caller_webview = Some(Arc::new(Identity));
    assert!(matches!(
        pinned.authorize(input),
        Err(Error::IdentityMismatch)
    ));
}
#[test]
fn matching_labels_do_not_authorize_a_different_window() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.caller_window = Some(Arc::new(Identity));
    assert!(matches!(
        pinned.authorize(input),
        Err(Error::IdentityMismatch)
    ));
}
#[test]
fn missing_or_replaced_registration_is_rejected() {
    let pinned = pinned();
    for replaced in [false, true] {
        let mut input = observed(&pinned);
        input.registered_webview = replaced.then(|| Arc::new(Identity));
        assert!(pinned.authorize(input).is_err());
    }
}
#[test]
fn denied_caller_has_zero_sensitive_effects() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.caller_webview = None;
    let credential_io = Cell::new(0);
    let network = Cell::new(0);
    let session_changes = Cell::new(0);
    let result = pinned
        .authorize(input)
        .map_err(CommandError::caller)
        .and_then(|permit| {
            permit.run(|| {
                credential_io.set(1);
                network.set(1);
                session_changes.set(1);
                Ok::<_, String>(())
            })
        });
    assert!(result.is_err());
    assert_eq!(
        (credential_io.get(), network.get(), session_changes.get()),
        (0, 0, 0)
    );
}
#[test]
fn existing_error_wire_shape_is_preserved() {
    let result = CommandError::Existing("existing message".to_owned());
    assert_eq!(
        serde_json::to_value(result).unwrap(),
        serde_json::json!("existing message")
    );
    let rejected = CommandError::<String>::caller(Error::NotMain);
    assert_eq!(
        serde_json::to_value(rejected).unwrap(),
        serde_json::json!({"caller_guard":"NOT_MAIN"})
    );
}

struct NoWake;
impl std::task::Wake for NoWake {
    fn wake(self: Arc<Self>) {}
}
fn ready<T>(future: impl Future<Output = T>) -> T {
    let waker = std::task::Waker::from(Arc::new(NoWake));
    let mut context = std::task::Context::from_waker(&waker);
    match std::pin::pin!(future).poll(&mut context) {
        std::task::Poll::Ready(value) => value,
        std::task::Poll::Pending => panic!("pure dispatch unexpectedly pending"),
    }
}
#[test]
fn denied_async_caller_never_constructs_sensitive_future() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.caller_webview = None;
    let factory = Cell::new(0);
    let credential_io = Cell::new(0);
    let network = Cell::new(0);
    let session_changes = Cell::new(0);
    let result = ready(dispatch_async(pinned.authorize(input), || {
        factory.set(1);
        async {
            credential_io.set(1);
            network.set(1);
            session_changes.set(1);
            Ok::<_, String>(())
        }
    }));
    assert!(result.is_err());
    assert_eq!(
        (
            factory.get(),
            credential_io.get(),
            network.get(),
            session_changes.get()
        ),
        (0, 0, 0, 0)
    );
}
#[test]
fn authorized_async_dispatch_preserves_value() {
    let pinned = pinned();
    let result = ready(dispatch_async(
        pinned.authorize(observed(&pinned)),
        || async { Ok::<_, String>(17) },
    ));
    assert!(matches!(result, Ok(17)));
}
#[test]
fn unregistered_dispatch_has_no_effect() {
    let calls = Cell::new(0);
    let result = dispatch(Err(Error::Unregistered), || {
        calls.set(1);
        Ok::<_, String>(())
    });
    assert!(result.is_err());
    assert_eq!(calls.get(), 0);
}
#[test]
fn main_webview_in_non_main_window_is_denied() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.window_label = "surface";
    assert!(matches!(pinned.authorize(input), Err(Error::NotMain)));
}
#[test]
fn replaced_main_window_registration_is_denied() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.registered_window = Some(Arc::new(Identity));
    assert!(matches!(
        pinned.authorize(input),
        Err(Error::MainUnavailable)
    ));
}
#[test]
fn existing_dto_wire_shape_is_preserved() {
    #[derive(serde::Serialize)]
    struct Dto {
        code: &'static str,
        message: &'static str,
    }
    let result = CommandError::Existing(Dto {
        code: "permissionDenied",
        message: "existing message",
    });
    assert_eq!(
        serde_json::to_value(result).unwrap(),
        serde_json::json!({"code":"permissionDenied","message":"existing message"})
    );
}
#[test]
fn missing_caller_window_is_denied() {
    let pinned = pinned();
    let mut input = observed(&pinned);
    input.caller_window = None;
    assert!(matches!(
        pinned.authorize(input),
        Err(Error::IdentityMismatch)
    ));
}

#[test]
fn stale_async_completion_withholds_value_without_claiming_effect_rollback() {
    // Given a valid caller and an operation admitted in its generation.
    let pinned = pinned();
    let current = Cell::new(true);
    let effects = Cell::new(0);
    // When navigation retires the generation during the admitted operation.
    let result = ready(dispatch_current_async(
        pinned.authorize(observed(&pinned)),
        || async {
            effects.set(1);
            current.set(false);
            Ok::<_, String>("synthetic result")
        },
        || current.get(),
    ));
    // Then no stale value escapes, but the admitted effect is not a rollback.
    assert!(matches!(result, Err(CommandError::Caller { .. })));
    assert_eq!(effects.get(), 1);
}

#[test]
fn current_async_completion_preserves_success() {
    // Given an admitted Main caller.
    let pinned = pinned();
    // When its generation remains current through completion.
    let result = ready(dispatch_current_async(
        pinned.authorize(observed(&pinned)),
        || async { Ok::<_, String>(17) },
        || true,
    ));
    // Then its successful response remains unchanged.
    assert!(matches!(result, Ok(17)));
}
