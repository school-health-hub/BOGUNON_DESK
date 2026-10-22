use super::{request_core::*, wire::*};
use std::cell::Cell;
const REQUEST_ID: &str = "7c42b3d2-3b55-4fe3-8e8b-58d0ad5a90d1";
fn request() -> SearchRequest {
    SearchRequest {
        topic: "감염병 예방".into(),
        audience: "초등학생".into(),
        desired_minutes: 10,
    }
}
struct Fixture {
    status: u16,
    body: Vec<u8>,
    calls: Cell<usize>,
}
impl LocalTransport for Fixture {
    fn send(&self, plan: &RequestPlan) -> Result<HttpReply, SearchError> {
        self.calls.set(self.calls.get() + 1);
        assert_eq!(plan.authorization, "Bearer local-fixture-token");
        assert_eq!(plan.request_id.header_value(), REQUEST_ID);
        assert!(!plan.follow_redirects);
        assert_eq!(plan.timeout_seconds, 12);
        assert_eq!(
            plan.url,
            "https://bogunon.vercel.app/api/education-video/search"
        );
        let value: serde_json::Value = serde_json::from_slice(&plan.body).unwrap();
        assert_eq!(value["audience"], "초등학생");
        assert_eq!(value.as_object().unwrap().len(), 3);
        Ok(HttpReply {
            status: self.status,
            body: self.body.clone(),
        })
    }
}
#[test]
fn local_transport_success_auth_quota_redirects_and_safe_errors() {
    for (status, expected) in [
        (401, Some(SearchError::Unauthorized)),
        (403, Some(SearchError::Unauthorized)),
        (429, Some(SearchError::QuotaExceeded)),
        (302, Some(SearchError::RedirectBlocked)),
        (500, Some(SearchError::UpstreamUnavailable)),
        (200, None),
    ] {
        let mock = Fixture {
            status,
            body: r#"{"source":"synthetic-mock","notice":"합성 로컬 응답","results":[]}"#
                .as_bytes()
                .to_vec(),
            calls: Cell::new(0),
        };
        let result = run_local(&request(), "local-fixture-token", REQUEST_ID, &mock);
        match expected {
            Some(error) => assert_eq!(result.unwrap_err(), error),
            None => assert_eq!(result.unwrap().results.len(), 0),
        }
        assert_eq!(mock.calls.get(), 1);
    }
}
#[test]
fn disabled_dispatch_and_invalid_tokens_never_enter_transport() {
    assert!(!REAL_DISPATCH_ENABLED);
    assert_eq!(
        disabled_dispatch(&request(), "local-fixture-token", REQUEST_ID).unwrap_err(),
        SearchError::RealDispatchDisabled
    );
    for token in ["", "token\r\nInjected: true", "token with space"] {
        assert_eq!(
            prepare(&request(), token, REQUEST_ID).err(),
            Some(SearchError::Unauthorized)
        );
    }
    let mut bad = request();
    bad.desired_minutes = 0;
    assert_eq!(
        disabled_dispatch(&bad, "token", REQUEST_ID).unwrap_err(),
        SearchError::InvalidRequest
    );
}
#[test]
fn oversized_response_and_malformed_response_are_safely_rejected() {
    assert_eq!(
        decode(HttpReply {
            status: 200,
            body: vec![b'x'; MAX_RESPONSE_BYTES + 1]
        })
        .unwrap_err(),
        SearchError::ResponseTooLarge
    );
    assert_eq!(
        decode(HttpReply {
            status: 200,
            body: b"upstream secret payload".to_vec()
        })
        .unwrap_err(),
        SearchError::InvalidResponse
    );
    assert!(!safe_message(SearchError::InvalidResponse).contains("secret"));
}
#[test]
fn wire_future_timestamp_and_fabricated_official_claim_are_rejected() {
    let mut value = serde_json::json!({"source":"live","notice":"조회","results":[{"videoId":"EVmock00001","title":"영상","channelId":"unverified","channelTitle":"공식처럼 보이는 이름","durationSeconds":null,"url":"https://www.youtube.com/watch?v=EVmock00001","official":false,"officialEvidence":null,"synthetic":false,"fetchedAt":"2099-01-01T00:00:00.000Z"}]});
    assert_eq!(
        parse_response(value.to_string().as_bytes()).unwrap_err(),
        SearchError::InvalidResponse
    );
    value["results"][0]
        .as_object_mut()
        .unwrap()
        .remove("fetchedAt");
    value["results"][0]["official"] = serde_json::json!(true);
    value["results"][0]["officialEvidence"] = serde_json::json!("fabricated proof");
    assert!(parse_response(value.to_string().as_bytes()).is_err());
}

#[test]
fn live_video_requires_retrieval_timestamp() {
    let value = serde_json::json!({"source":"live","notice":"조회","results":[{"videoId":"EVmock00001","title":"영상","channelId":"UCchannel","channelTitle":"채널","durationSeconds":null,"url":"https://www.youtube.com/watch?v=EVmock00001","official":false,"officialEvidence":null,"synthetic":false}]});
    assert_eq!(
        parse_response(value.to_string().as_bytes()).unwrap_err(),
        SearchError::InvalidResponse
    );
}

#[test]
fn proxy_error_code_is_preserved_only_for_its_declared_status() {
    for (status, code) in [
        (400, "INVALID_REQUEST"),
        (401, "UNAUTHORIZED"),
        (403, "FORBIDDEN"),
        (429, "QUOTA_EXCEEDED"),
        (503, "NOT_CONFIGURED"),
        (503, "UNAVAILABLE"),
        (409, "SEARCH_BUSY"),
        (429, "UPSTREAM_QUOTA"),
        (502, "UPSTREAM_INVALID"),
        (503, "UPSTREAM_UNAVAILABLE"),
    ] {
        let body = serde_json::json!({"error":{"code":code,"message":"private upstream detail"}});
        let error = decode(HttpReply {
            status,
            body: body.to_string().into_bytes(),
        })
        .unwrap_err();
        assert_eq!(serde_json::to_value(error).unwrap(), code);
        assert!(!safe_message(error).contains("private"));
    }
}

#[test]
fn identical_retry_keeps_supplied_uuid_and_new_search_uses_its_new_uuid() {
    let first = prepare(&request(), "token", REQUEST_ID).unwrap();
    let retried = prepare(&request(), "token", REQUEST_ID).unwrap();
    let next_id = "1fdc61e1-e94c-4af0-b017-2e4857ad708c";
    let next = prepare(&request(), "token", next_id).unwrap();
    assert_eq!(
        first.request_id.header_value(),
        retried.request_id.header_value()
    );
    assert_eq!(next.request_id.header_value(), next_id);
    assert_ne!(
        first.request_id.header_value(),
        next.request_id.header_value()
    );
}

#[test]
fn invalid_request_uuid_is_rejected_before_transport() {
    for id in [
        "",
        "not-a-uuid",
        "00000000-0000-0000-0000-000000000000",
        "7c42b3d23b554fe38e8b58d0ad5a90d1",
        "7c42b3d2-3b55-4fe3-8e8b-58d0ad5a90d1\r\nInjected: true",
    ] {
        let fixture = Fixture {
            status: 200,
            body: Vec::new(),
            calls: Cell::new(0),
        };
        assert_eq!(
            run_local(&request(), "token", id, &fixture).unwrap_err(),
            SearchError::InvalidRequest
        );
        assert_eq!(fixture.calls.get(), 0);
    }
}

#[test]
fn malformed_unknown_or_status_mismatched_errors_use_safe_fallbacks() {
    for body in [
        "not-json",
        r#"{"error":{"code":"SECRET_INTERNAL","message":"private detail"}}"#,
        r#"{"error":{"code":"SEARCH_BUSY","message":"private detail"}}"#,
        r#"{"error":{"code":"NOT_CONFIGURED","message":7}}"#,
        r#"{"error":{"code":"NOT_CONFIGURED","message":"private detail","debug":"secret"}}"#,
        r#"{"error":{"code":"NOT_CONFIGURED","message":"private detail"},"debug":"secret"}"#,
        r#"{"error":{"code":"TIMEOUT","message":"private detail"}}"#,
    ] {
        let error = decode(HttpReply {
            status: 503,
            body: body.as_bytes().to_vec(),
        })
        .unwrap_err();
        assert_eq!(error, SearchError::UpstreamUnavailable);
        assert!(!safe_message(error).contains("private"));
    }
    let error = decode(HttpReply {
        status: 401,
        body: b"internal auth secret".to_vec(),
    })
    .unwrap_err();
    assert_eq!(error, SearchError::Unauthorized);
    assert!(!safe_message(error).contains("secret"));
}

#[test]
fn transport_timeout_and_error_body_size_remain_bounded() {
    struct Timeout;
    impl LocalTransport for Timeout {
        fn send(&self, _: &RequestPlan) -> Result<HttpReply, SearchError> {
            Err(SearchError::Timeout)
        }
    }
    assert_eq!(
        run_local(&request(), "token", REQUEST_ID, &Timeout).unwrap_err(),
        SearchError::Timeout
    );
    assert_eq!(
        decode(HttpReply {
            status: 503,
            body: vec![b'x'; MAX_RESPONSE_BYTES + 1]
        })
        .unwrap_err(),
        SearchError::ResponseTooLarge
    );
}
