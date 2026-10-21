use super::{request_core::*, wire::*};
use std::cell::Cell;
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
        assert!(!plan.follow_redirects);
        assert_eq!(plan.timeout_seconds, 12);
        assert_eq!(
            plan.url,
            "https://bogunon.vercel.app/api/education-video/search"
        );
        let value: serde_json::Value = serde_json::from_slice(&plan.body).unwrap();
        assert_eq!(value["audience"], "초등학생");
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
        let result = run_local(&request(), "local-fixture-token", &mock);
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
        disabled_dispatch(&request(), "local-fixture-token").unwrap_err(),
        SearchError::RealDispatchDisabled
    );
    for token in ["", "token\r\nInjected: true", "token with space"] {
        assert_eq!(
            prepare(&request(), token).err(),
            Some(SearchError::Unauthorized)
        );
    }
    let mut bad = request();
    bad.desired_minutes = 0;
    assert_eq!(
        disabled_dispatch(&bad, "token").unwrap_err(),
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
