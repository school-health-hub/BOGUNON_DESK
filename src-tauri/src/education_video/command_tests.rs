use super::{
    command_core,
    request_core::{self, HttpReply},
    wire::*,
};
use std::{
    cell::{Cell, RefCell},
    future::{ready, Future},
    sync::Arc,
    task::{Context, Poll, Wake, Waker},
};

const TOKEN: &str = "synthetic-finder-e1b-token";
const FIRST_ID: &str = "7c42b3d2-3b55-4fe3-8e8b-58d0ad5a90d1";
const NEXT_ID: &str = "1fdc61e1-e94c-4af0-b017-2e4857ad708c";

struct ReadyWaker;
impl Wake for ReadyWaker {
    fn wake(self: Arc<Self>) {}
}

fn finish_ready<F: Future>(future: F) -> F::Output {
    let waker = Waker::from(Arc::new(ReadyWaker));
    let mut context = Context::from_waker(&waker);
    match std::pin::pin!(future).as_mut().poll(&mut context) {
        Poll::Ready(output) => output,
        Poll::Pending => panic!("Synthetic ready transport unexpectedly suspended"),
    }
}

fn request() -> SearchRequest {
    SearchRequest {
        topic: "합성 교육".into(),
        audience: "합성 대상".into(),
        desired_minutes: 10,
    }
}

fn response(status: u16, body: &[u8]) -> Result<SearchResponse, SearchError> {
    request_core::decode(HttpReply {
        status,
        body: body.to_vec(),
    })
}

#[test]
fn shared_command_core_dispatches_synthetic_success_with_original_constraints() {
    let result = finish_ready(command_core::synthetic(
        &request(),
        TOKEN,
        FIRST_ID,
        |plan| {
            assert_eq!(plan.request_id.header_value(), FIRST_ID);
            assert_eq!(plan.authorization, format!("Bearer {TOKEN}"));
            assert_eq!(plan.timeout_seconds, 12);
            assert!(!plan.follow_redirects);
            assert_eq!(
                plan.url,
                "https://bogunon.vercel.app/api/education-video/search"
            );
            let body: serde_json::Value = serde_json::from_slice(&plan.body).unwrap();
            assert_eq!(
                body,
                serde_json::json!({"topic":"합성 교육","audience":"합성 대상","desiredMinutes":10})
            );
            ready(response(
                200,
                br#"{"source":"synthetic-mock","notice":"synthetic","results":[]}"#,
            ))
        },
    ))
    .unwrap();
    assert!(result.results.is_empty());
}

#[test]
fn shared_command_core_keeps_retry_identity_and_accepts_new_search_identity() {
    let seen = RefCell::new(Vec::new());
    for id in [FIRST_ID, FIRST_ID, NEXT_ID] {
        finish_ready(command_core::synthetic(&request(), TOKEN, id, |plan| {
            seen.borrow_mut().push(plan.request_id.header_value());
            ready(response(
                200,
                br#"{"source":"synthetic-mock","notice":"synthetic","results":[]}"#,
            ))
        }))
        .unwrap();
    }
    assert_eq!(*seen.borrow(), [FIRST_ID, FIRST_ID, NEXT_ID]);
}

#[test]
fn shared_command_core_rejects_missing_auth_before_transport() {
    let calls = Cell::new(0);
    let failure = finish_ready(command_core::synthetic(&request(), "", FIRST_ID, |_| {
        calls.set(calls.get() + 1);
        ready(Err(SearchError::Timeout))
    }))
    .unwrap_err();
    assert_eq!(calls.get(), 0);
    assert_eq!(
        serde_json::to_value(failure).unwrap()["code"],
        "UNAUTHORIZED"
    );
}

#[test]
fn shared_command_core_preserves_busy_not_configured_and_safe_messages() {
    for (status, code) in [(409, "SEARCH_BUSY"), (503, "NOT_CONFIGURED")] {
        let body = serde_json::json!({"error":{"code":code,"message":"private upstream detail"}});
        let failure = finish_ready(command_core::synthetic(&request(), TOKEN, FIRST_ID, |_| {
            ready(response(status, body.to_string().as_bytes()))
        }))
        .unwrap_err();
        let serialized = serde_json::to_value(failure).unwrap();
        assert_eq!(serialized["code"], code);
        assert!(!serialized.to_string().contains("private"));
    }
}

#[test]
fn shared_command_core_rejects_bad_response_and_preserves_timeout() {
    for outcome in [
        response(200, b"private malformed body"),
        Err(SearchError::Timeout),
    ] {
        let failure = finish_ready(command_core::synthetic(&request(), TOKEN, FIRST_ID, |_| {
            ready(outcome)
        }))
        .unwrap_err();
        let serialized = serde_json::to_value(failure).unwrap();
        assert!(matches!(
            serialized["code"].as_str(),
            Some("INVALID_RESPONSE" | "TIMEOUT")
        ));
        assert!(!serialized.to_string().contains("private"));
    }
}

#[test]
fn shared_command_core_preserves_false_runtime_gate_and_bounds() {
    assert!(!request_core::REAL_DISPATCH_ENABLED);
    for outcome in [
        Err(SearchError::RealDispatchDisabled),
        response(302, b""),
        response(200, &vec![b'x'; MAX_RESPONSE_BYTES + 1]),
    ] {
        let failure = finish_ready(command_core::synthetic(&request(), TOKEN, FIRST_ID, |_| {
            ready(outcome)
        }))
        .unwrap_err();
        let serialized = serde_json::to_value(failure).unwrap();
        assert!(matches!(
            serialized["code"].as_str(),
            Some("REAL_DISPATCH_DISABLED" | "REDIRECT_BLOCKED" | "RESPONSE_TOO_LARGE")
        ));
    }
}
