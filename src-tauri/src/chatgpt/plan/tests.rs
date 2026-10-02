use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

use serde_json::json;
use tokio::sync::Notify;

use super::*;
use crate::chatgpt::{
    http::{HttpMethod, HttpResponse, HttpTransport, TransportError},
    lifecycle,
    model::{HostRecord, IssuedClientId, RegistrationRecord},
    storage::StorageError,
};

struct MemoryStorage {
    credential: Mutex<Option<CredentialRecord>>,
    registration: RegistrationRecord,
}

impl MemoryStorage {
    fn new(credential: CredentialRecord) -> Self {
        Self {
            credential: Mutex::new(Some(credential)),
            registration: RegistrationRecord {
                issued_client_id: IssuedClientId::parse("oaiapp_test").expect("valid client"),
                issuer: "https://auth.openai.com".to_owned(),
                subject: "subject".to_owned(),
                email: None,
                display_name: None,
                plan_usage_notice_acknowledged: true,
            },
        }
    }

    fn credential(&self) -> Option<CredentialRecord> {
        self.credential.lock().expect("credential lock").clone()
    }
}

impl ChatGptCredentialStorage for MemoryStorage {
    fn load_or_create_host(&self) -> Result<HostRecord, StorageError> {
        Err(StorageError::Io)
    }
    fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError> {
        Ok(Some(self.registration.clone()))
    }
    fn save_registration(&self, _: &RegistrationRecord) -> Result<(), StorageError> {
        Ok(())
    }
    fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError> {
        Ok(self.credential())
    }
    fn save_credential(&self, credential: &CredentialRecord) -> Result<(), StorageError> {
        *self.credential.lock().expect("credential lock") = Some(credential.clone());
        Ok(())
    }
    fn clear_credential(&self) -> Result<(), StorageError> {
        *self.credential.lock().expect("credential lock") = None;
        Ok(())
    }
}

struct FakeTransport {
    responses: Mutex<VecDeque<Result<ApiResponse, InternalError>>>,
    requests: Mutex<Vec<ApiRequest>>,
    token_pause: Option<(Arc<Notify>, Arc<Notify>)>,
    api_pause: Option<(Arc<Notify>, Arc<Notify>)>,
}

impl FakeTransport {
    fn new(responses: Vec<Result<ApiResponse, InternalError>>) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            requests: Mutex::new(Vec::new()),
            token_pause: None,
            api_pause: None,
        }
    }

    fn pausing_token(
        responses: Vec<Result<ApiResponse, InternalError>>,
        started: Arc<Notify>,
        release: Arc<Notify>,
    ) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            requests: Mutex::new(Vec::new()),
            token_pause: Some((started, release)),
            api_pause: None,
        }
    }

    fn pausing_api(
        responses: Vec<Result<ApiResponse, InternalError>>,
        started: Arc<Notify>,
        release: Arc<Notify>,
    ) -> Self {
        Self {
            responses: Mutex::new(responses.into()),
            requests: Mutex::new(Vec::new()),
            token_pause: None,
            api_pause: Some((started, release)),
        }
    }

    fn requests(&self) -> Vec<ApiRequest> {
        self.requests.lock().expect("request lock").clone()
    }
}

impl PlanTransport for FakeTransport {
    async fn send(&self, request: ApiRequest) -> Result<ApiResponse, InternalError> {
        let pauses_for_token = request.url.ends_with("/oauth/token");
        let pauses_for_api = request.url == MODELS_URL || request.url == RESPONSES_URL;
        self.requests.lock().expect("request lock").push(request);
        if pauses_for_token {
            if let Some((started, release)) = &self.token_pause {
                started.notify_one();
                release.notified().await;
            }
        }
        if pauses_for_api {
            if let Some((started, release)) = &self.api_pause {
                started.notify_one();
                release.notified().await;
            }
        }
        self.responses
            .lock()
            .expect("response lock")
            .pop_front()
            .expect("fixture response")
    }
}

struct DisconnectTransport {
    requests: Mutex<Vec<(String, Vec<(String, String)>)>>,
    revoke_pause: Option<(Arc<Notify>, Arc<Notify>)>,
}

impl DisconnectTransport {
    const fn immediate() -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
            revoke_pause: None,
        }
    }

    fn pausing_revoke(started: Arc<Notify>, release: Arc<Notify>) -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
            revoke_pause: Some((started, release)),
        }
    }

    fn requests(&self) -> Vec<(String, Vec<(String, String)>)> {
        self.requests.lock().expect("request lock").clone()
    }
}

impl HttpTransport for DisconnectTransport {
    async fn send(
        &self,
        _method: HttpMethod,
        url: &str,
        form: &[(String, String)],
    ) -> Result<HttpResponse, TransportError> {
        self.requests
            .lock()
            .expect("request lock")
            .push((url.to_owned(), form.to_vec()));
        if url.ends_with("/oauth/revoke") {
            if let Some((started, release)) = &self.revoke_pause {
                started.notify_one();
                release.notified().await;
            }
            return Ok(HttpResponse::new(200, b"{}".to_vec()));
        }
        Ok(HttpResponse::new(
            200,
            serde_json::to_vec(&json!({
                "issuer": "https://auth.openai.com",
                "authorization_endpoint": "https://auth.openai.com/api/accounts/authorize",
                "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
                "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
                "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
            }))
            .expect("discovery fixture"),
        ))
    }
}

fn credential(saved_at: u64, expires_in: u64) -> CredentialRecord {
    CredentialRecord {
        access_token: SecretToken::new("access-old"),
        refresh_token: Some(SecretToken::new("refresh-old")),
        id_token: SecretToken::new("id-old"),
        token_type: "Bearer".to_owned(),
        expires_in,
        earliest_refresh_at: None,
        granted_scopes: vec!["chatgpt.tokens.use.direct".to_owned()],
        saved_at,
    }
}

fn response(status: u16, value: serde_json::Value) -> Result<ApiResponse, InternalError> {
    Ok(ApiResponse {
        status,
        request_id: Some("req-test".to_owned()),
        body: serde_json::to_vec(&value).expect("fixture JSON"),
    })
}

fn raw_response(status: u16, body: &str) -> Result<ApiResponse, InternalError> {
    Ok(ApiResponse {
        status,
        request_id: None,
        body: body.as_bytes().to_vec(),
    })
}

fn discovery_response() -> Result<ApiResponse, InternalError> {
    response(
        200,
        json!({
            "issuer": "https://auth.openai.com",
            "authorization_endpoint": "https://auth.openai.com/api/accounts/authorize",
            "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
            "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
            "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
        }),
    )
}

fn refresh_response() -> Result<ApiResponse, InternalError> {
    response(
        200,
        json!({
            "access_token": "access-new", "refresh_token": "refresh-new",
            "token_type": "Bearer", "expires_in": 3600,
            "earliest_refresh_at": 2000, "scope": "openid chatgpt.tokens.use.direct"
        }),
    )
}

#[test]
fn filters_list_visibility_and_preserves_server_order() {
    // Given
    let body = serde_json::to_vec(&json!({ "models": [
        {"slug":"second","display_name":"Second","visibility":"list"},
        {"slug":"hidden","display_name":"Hidden","visibility":"hidden"},
        {"slug":"first","display_name":"First","visibility":"list"}
    ]}))
    .expect("fixture JSON");
    // When
    let models = parse_models(&body).expect("models parse");
    // Then
    assert_eq!(
        models
            .iter()
            .map(|model| model.slug.as_str())
            .collect::<Vec<_>>(),
        ["second", "first"]
    );
}

#[test]
fn rejects_malformed_model_response() {
    // Given / When
    let result = parse_models(br#"{"models":"wrong"}"#);
    // Then
    assert!(matches!(result, Err(error) if error.kind == InternalErrorKind::InvalidResponse));
}

#[test]
fn aggregates_deltas_only_after_completed() {
    // Given
    let body = b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello \"}\n\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"world\"}\n\ndata: {\"type\":\"response.completed\"}\n\n";
    // When
    let result = parse_response_stream(body);
    // Then
    assert_eq!(result.expect("completed stream"), "hello world");
}

#[test]
fn accepts_crlf_sse_frames() {
    let body = b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\r\n\r\ndata: {\"type\":\"response.completed\"}\r\n\r\n";
    assert_eq!(
        parse_response_stream(body).expect("completed stream"),
        "hello"
    );
}

#[test]
fn rejects_failed_incomplete_and_premature_eof() {
    for event in ["response.failed", "response.incomplete"] {
        let body = format!("data: {{\"type\":\"{event}\"}}\n\n");
        assert!(parse_response_stream(body.as_bytes()).is_err());
    }
    assert!(parse_response_stream(
        b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n"
    )
    .is_err());
}

#[test]
fn preserves_usage_limit_code_from_failed_stream() {
    let body = br#"data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}

"#;
    let error = parse_response_stream(body).expect_err("failed response");
    assert_eq!(error.dto().code, ChatGptPlanErrorCode::UsageLimitExceeded);
    assert_eq!(
        error.machine_code.as_deref(),
        Some("subscription_sharing_usage_limit_exceeded")
    );
}

#[test]
fn normalizes_status_and_usage_codes_without_diagnostics_in_dto() {
    for (status, machine, expected) in [
        (401, "other", ChatGptPlanErrorCode::ReauthenticationRequired),
        (403, "other", ChatGptPlanErrorCode::PermissionDenied),
        (429, "other", ChatGptPlanErrorCode::RateLimited),
        (500, "other", ChatGptPlanErrorCode::TemporaryFailure),
        (
            403,
            "subscription_sharing_usage_limit_exceeded",
            ChatGptPlanErrorCode::UsageLimitExceeded,
        ),
        (
            403,
            "subscription_sharing_usage_unavailable",
            ChatGptPlanErrorCode::UsageUnavailable,
        ),
    ] {
        let response = ApiResponse {
            status,
            request_id: Some("secret-request-id".to_owned()),
            body: serde_json::to_vec(&json!({"error":{"code":machine}})).expect("fixture"),
        };
        let encoded = serde_json::to_string(&InternalError::from_response(&response).dto())
            .expect("DTO JSON");
        assert_eq!(InternalError::from_response(&response).dto().code, expected);
        assert!(!encoded.contains("secret-request-id"));
        assert!(!encoded.contains(machine));
    }
}

#[tokio::test]
async fn refresh_replaces_tokens_scopes_and_expiry_atomically() {
    // Given
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        refresh_response(),
        response(200, json!({"models":[]})),
    ]);
    // When
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    // Then
    assert!(result.is_ok());
    let saved = storage.credential().expect("saved credential");
    assert_eq!(saved.access_token.expose(), "access-new");
    assert_eq!(
        saved.refresh_token.as_ref().expect("refresh").expose(),
        "refresh-new"
    );
    assert_eq!(saved.saved_at, 1100);
    assert_eq!(saved.expires_in, 3600);
    assert_eq!(
        saved.granted_scopes,
        ["openid", "chatgpt.tokens.use.direct"]
    );
}

#[tokio::test]
async fn refresh_form_uses_latest_token_and_omits_scope() {
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        refresh_response(),
        response(200, json!({"models":[]})),
    ]);
    list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await
    .expect("models");
    let requests = transport.requests();
    let form = match &requests[1].body {
        RequestBody::Form(form) => form,
        _ => panic!("refresh form"),
    };
    assert!(form
        .iter()
        .any(|(key, value)| key == "refresh_token" && value == "refresh-old"));
    assert!(form
        .iter()
        .any(|(key, value)| key == "client_id" && value == "oaiapp_test"));
    assert!(form
        .iter()
        .any(|(key, value)| key == "resource" && value == OPENAI_RESOURCE));
    assert!(!form.iter().any(|(key, _)| key == "scope"));
}

#[tokio::test]
async fn earliest_refresh_time_prevents_refresh() {
    let mut value = credential(1000, 10);
    value.earliest_refresh_at = Some(1200);
    let storage = MemoryStorage::new(value);
    let transport = FakeTransport::new(Vec::new());
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    assert_eq!(
        result.expect_err("too early").code,
        ChatGptPlanErrorCode::TemporaryFailure
    );
    assert!(transport.requests().is_empty());
}

#[tokio::test]
async fn earliest_refresh_time_uses_still_valid_access_token() {
    let mut value = credential(1000, 200);
    value.earliest_refresh_at = Some(1200);
    let storage = MemoryStorage::new(value);
    let transport = FakeTransport::new(vec![response(200, json!({"models":[]}))]);
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1150,
    )
    .await;
    assert!(result.is_ok());
    assert_eq!(transport.requests().len(), 1);
}

#[tokio::test]
async fn models_401_clears_current_credential_and_preserves_registration() {
    // Given
    let storage = MemoryStorage::new(credential(1000, 3600));
    let transport = FakeTransport::new(vec![response(401, json!({}))]);

    // When
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;

    // Then
    assert_eq!(
        result.expect_err("models 401").code,
        ChatGptPlanErrorCode::ReauthenticationRequired
    );
    assert!(storage.credential().is_none());
    assert!(storage.load_registration().expect("registration").is_some());
    let state = lifecycle::connection_state(&storage, false, None).expect("connection state");
    assert_eq!(
        state.status,
        crate::chatgpt::model::ChatGptConnectionStatus::Disconnected
    );
    assert!(state.client_registration_exists);
}

#[tokio::test]
async fn responses_401_clears_current_credential() {
    // Given
    let storage = MemoryStorage::new(credential(1000, 3600));
    let transport = FakeTransport::new(vec![response(401, json!({}))]);

    // When
    let result = generate_text(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
        &GenerateTextRequest {
            model: "gpt-test".to_owned(),
            prompt: "hello".to_owned(),
        },
    )
    .await;

    // Then
    assert_eq!(
        result.expect_err("responses 401").code,
        ChatGptPlanErrorCode::ReauthenticationRequired
    );
    assert!(storage.credential().is_none());
}

#[tokio::test]
async fn stale_models_401_preserves_newer_credential() {
    // Given
    let storage = Arc::new(MemoryStorage::new(credential(1000, 3600)));
    let started = Arc::new(Notify::new());
    let release = Arc::new(Notify::new());
    let transport = Arc::new(FakeTransport::pausing_api(
        vec![response(401, json!({}))],
        Arc::clone(&started),
        Arc::clone(&release),
    ));
    let state = Arc::new(ChatGptCredentialMutationState::default());

    // When
    let request = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&transport);
        let state = Arc::clone(&state);
        async move { list_models(&*storage, &*transport, &state, 1100).await }
    });
    started.notified().await;
    let mut newer = credential(1100, 3600);
    newer.access_token = SecretToken::new("access-newer");
    {
        let _guard = state.lock().await;
        storage
            .save_credential(&newer)
            .expect("save newer credential");
    }
    release.notify_one();
    let error = tokio::time::timeout(std::time::Duration::from_secs(1), request)
        .await
        .expect("stale models 401 must not deadlock")
        .expect("request task")
        .expect_err("models 401");

    // Then
    assert_eq!(error.code, ChatGptPlanErrorCode::ReauthenticationRequired);
    assert_eq!(
        storage
            .credential()
            .expect("newer credential")
            .access_token
            .expose(),
        "access-newer"
    );
}

#[tokio::test]
async fn stale_responses_401_preserves_newer_credential() {
    // Given
    let storage = Arc::new(MemoryStorage::new(credential(1000, 3600)));
    let started = Arc::new(Notify::new());
    let release = Arc::new(Notify::new());
    let transport = Arc::new(FakeTransport::pausing_api(
        vec![response(401, json!({}))],
        Arc::clone(&started),
        Arc::clone(&release),
    ));
    let state = Arc::new(ChatGptCredentialMutationState::default());

    // When
    let request = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&transport);
        let state = Arc::clone(&state);
        async move {
            generate_text(
                &*storage,
                &*transport,
                &state,
                1100,
                &GenerateTextRequest {
                    model: "gpt-test".to_owned(),
                    prompt: "hello".to_owned(),
                },
            )
            .await
        }
    });
    started.notified().await;
    let mut newer = credential(1100, 3600);
    newer.access_token = SecretToken::new("access-newer");
    {
        let _guard = state.lock().await;
        storage
            .save_credential(&newer)
            .expect("save newer credential");
    }
    release.notify_one();
    let error = tokio::time::timeout(std::time::Duration::from_secs(1), request)
        .await
        .expect("stale responses 401 must not deadlock")
        .expect("request task")
        .expect_err("responses 401");

    // Then
    assert_eq!(error.code, ChatGptPlanErrorCode::ReauthenticationRequired);
    assert_eq!(
        storage
            .credential()
            .expect("newer credential")
            .access_token
            .expose(),
        "access-newer"
    );
}

#[tokio::test]
async fn concurrent_refresh_is_serialized_and_uses_one_replacement() {
    let storage = Arc::new(MemoryStorage::new(credential(1000, 10)));
    let transport = Arc::new(FakeTransport::new(vec![
        discovery_response(),
        refresh_response(),
        response(200, json!({"models":[]})),
        response(200, json!({"models":[]})),
    ]));
    let state = Arc::new(ChatGptCredentialMutationState::default());
    let first = list_models(&*storage, &*transport, &state, 1100);
    let second = list_models(&*storage, &*transport, &state, 1100);
    let (one, two) = tokio::time::timeout(std::time::Duration::from_secs(1), async {
        tokio::join!(first, second)
    })
    .await
    .expect("concurrent refresh must not deadlock");
    assert!(one.is_ok() && two.is_ok());
    assert_eq!(
        transport
            .requests()
            .iter()
            .filter(|request| request.url.ends_with("/oauth/token"))
            .count(),
        1
    );
}

#[tokio::test]
async fn refresh_inflight_then_disconnect_revokes_replacement_and_clears_credential() {
    // Given
    let storage = Arc::new(MemoryStorage::new(credential(1000, 10)));
    let refresh_started = Arc::new(Notify::new());
    let release_refresh = Arc::new(Notify::new());
    let plan_transport = Arc::new(FakeTransport::pausing_token(
        vec![
            discovery_response(),
            refresh_response(),
            response(200, json!({"models":[]})),
        ],
        Arc::clone(&refresh_started),
        Arc::clone(&release_refresh),
    ));
    let disconnect_transport = Arc::new(DisconnectTransport::immediate());
    let state = Arc::new(ChatGptCredentialMutationState::default());

    // When
    let refresh = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&plan_transport);
        let state = Arc::clone(&state);
        async move { list_models(&*storage, &*transport, &state, 1100).await }
    });
    refresh_started.notified().await;
    let disconnect = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&disconnect_transport);
        let state = Arc::clone(&state);
        async move { lifecycle::disconnect(&*storage, &*transport, &state).await }
    });
    tokio::task::yield_now().await;
    release_refresh.notify_one();
    tokio::time::timeout(std::time::Duration::from_secs(1), async {
        refresh.await.expect("refresh task").expect("refresh");
        disconnect
            .await
            .expect("disconnect task")
            .expect("disconnect");
    })
    .await
    .expect("refresh then disconnect must not deadlock");

    // Then
    assert!(storage.credential().is_none());
    let revoke = disconnect_transport
        .requests()
        .into_iter()
        .find(|(url, _)| url.ends_with("/oauth/revoke"))
        .expect("revoke request");
    assert!(revoke
        .1
        .iter()
        .any(|(key, value)| key == "token" && value == "refresh-new"));
}

#[tokio::test]
async fn disconnect_inflight_then_refresh_skips_token_exchange_and_cannot_resurrect() {
    // Given
    let storage = Arc::new(MemoryStorage::new(credential(1000, 10)));
    let revoke_started = Arc::new(Notify::new());
    let release_revoke = Arc::new(Notify::new());
    let disconnect_transport = Arc::new(DisconnectTransport::pausing_revoke(
        Arc::clone(&revoke_started),
        Arc::clone(&release_revoke),
    ));
    let plan_transport = Arc::new(FakeTransport::new(vec![
        discovery_response(),
        refresh_response(),
        response(200, json!({"models":[]})),
    ]));
    let state = Arc::new(ChatGptCredentialMutationState::default());

    // When
    let disconnect = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&disconnect_transport);
        let state = Arc::clone(&state);
        async move { lifecycle::disconnect(&*storage, &*transport, &state).await }
    });
    revoke_started.notified().await;
    let refresh = tokio::spawn({
        let storage = Arc::clone(&storage);
        let transport = Arc::clone(&plan_transport);
        let state = Arc::clone(&state);
        async move { list_models(&*storage, &*transport, &state, 1100).await }
    });
    tokio::task::yield_now().await;
    release_revoke.notify_one();
    let error = tokio::time::timeout(std::time::Duration::from_secs(1), async {
        disconnect
            .await
            .expect("disconnect task")
            .expect("disconnect");
        refresh
            .await
            .expect("refresh task")
            .expect_err("credential removed")
    })
    .await
    .expect("disconnect then refresh must not deadlock");

    // Then
    assert_eq!(error.code, ChatGptPlanErrorCode::NotConnected);
    assert!(plan_transport.requests().is_empty());
    assert!(storage.credential().is_none());
}

#[tokio::test]
async fn temporary_refresh_failure_preserves_credential() {
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![discovery_response(), Err(InternalError::TRANSPORT)]);
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    assert_eq!(
        result.expect_err("network failure").code,
        ChatGptPlanErrorCode::TemporaryFailure
    );
    assert_eq!(
        storage
            .credential()
            .expect("preserved")
            .refresh_token
            .expect("refresh")
            .expose(),
        "refresh-old"
    );
}

#[tokio::test]
async fn generic_refresh_401_clears_credential_and_preserves_registration() {
    // Given
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        response(401, json!({"error":"unknown"})),
    ]);

    // When
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;

    // Then
    assert_eq!(
        result.expect_err("generic refresh 401").code,
        ChatGptPlanErrorCode::ReauthenticationRequired
    );
    assert!(storage.credential().is_none());
    assert!(storage.load_registration().expect("registration").is_some());
}

#[tokio::test]
async fn non_reauthentication_refresh_failures_preserve_credential() {
    for status in [403, 429, 500] {
        // Given
        let storage = MemoryStorage::new(credential(1000, 10));
        let transport = FakeTransport::new(vec![
            discovery_response(),
            response(status, json!({"error":"other"})),
        ]);

        // When
        let result = list_models(
            &storage,
            &transport,
            &ChatGptCredentialMutationState::default(),
            1100,
        )
        .await;

        // Then
        assert!(result.is_err());
        assert!(storage.credential().is_some(), "status {status}");
    }
}

#[tokio::test]
async fn invalid_grant_marks_credential_unusable() {
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        response(400, json!({"error":"invalid_grant"})),
    ]);
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    assert_eq!(
        result.expect_err("invalid grant").code,
        ChatGptPlanErrorCode::ReauthenticationRequired
    );
    assert!(storage.credential().is_none());
    assert!(storage.load_registration().expect("registration").is_some());
}

#[tokio::test]
async fn every_terminal_refresh_error_marks_credential_unusable() {
    for code in [
        "invalid_refresh_token",
        "token_expired",
        "refresh_token_expired",
        "refresh_token_invalidated",
        "refresh_token_reused",
    ] {
        let storage = MemoryStorage::new(credential(1000, 10));
        let transport = FakeTransport::new(vec![
            discovery_response(),
            response(400, json!({"error": code})),
        ]);
        let result = list_models(
            &storage,
            &transport,
            &ChatGptCredentialMutationState::default(),
            1100,
        )
        .await;
        assert_eq!(
            result.expect_err("terminal refresh error").code,
            ChatGptPlanErrorCode::ReauthenticationRequired
        );
        assert!(storage.credential().is_none());
    }
}

#[tokio::test]
async fn missing_replacement_refresh_token_is_rejected_without_overwrite() {
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        response(
            200,
            json!({
                "access_token":"access-new", "token_type":"Bearer", "expires_in":3600
            }),
        ),
    ]);
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    assert_eq!(
        result.expect_err("missing replacement").code,
        ChatGptPlanErrorCode::InvalidResponse
    );
    assert_eq!(
        storage
            .credential()
            .expect("preserved")
            .refresh_token
            .expect("refresh")
            .expose(),
        "refresh-old"
    );
}

#[tokio::test]
async fn malformed_refresh_response_is_rejected_without_overwrite() {
    let storage = MemoryStorage::new(credential(1000, 10));
    let transport = FakeTransport::new(vec![
        discovery_response(),
        response(
            200,
            json!({"access_token":"","token_type":"Bearer","expires_in":0}),
        ),
    ]);
    let result = list_models(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
    )
    .await;
    assert_eq!(
        result.expect_err("malformed").code,
        ChatGptPlanErrorCode::InvalidResponse
    );
    assert_eq!(
        storage
            .credential()
            .expect("preserved")
            .access_token
            .expose(),
        "access-old"
    );
}

#[tokio::test]
async fn generation_contract_contains_only_supported_fields_and_bearer_is_internal() {
    let storage = MemoryStorage::new(credential(1000, 3600));
    let stream = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"ok\"}\n\ndata: {\"type\":\"response.completed\"}\n\n";
    let transport = FakeTransport::new(vec![raw_response(200, stream)]);
    let request = GenerateTextRequest {
        model: "gpt-test".to_owned(),
        prompt: "hello".to_owned(),
    };
    let result = generate_text(
        &storage,
        &transport,
        &ChatGptCredentialMutationState::default(),
        1100,
        &request,
    )
    .await;
    assert_eq!(result.expect("generation"), "ok");
    let sent = transport.requests().pop().expect("request");
    assert_eq!(sent.bearer.as_deref(), Some("access-old"));
    let value = match sent.body {
        RequestBody::Json(value) => value,
        _ => panic!("JSON body"),
    };
    assert_eq!(value["store"], false);
    assert_eq!(value["stream"], true);
    assert!(value["input"].is_array());
    for absent in [
        "temperature",
        "background",
        "conversation",
        "max_output_tokens",
        "max_tool_calls",
        "metadata",
        "moderation",
        "multi_agent",
        "prompt",
        "prompt_cache_retention",
        "safety_identifier",
        "top_logprobs",
        "top_p",
        "truncation",
        "user",
        "previous_response_id",
    ] {
        assert!(value.get(absent).is_none(), "unexpected {absent}");
    }
}

#[test]
fn public_dtos_contain_no_token_fields() {
    let model = ChatGptModelDto {
        slug: "gpt-test".to_owned(),
        display_name: "GPT Test".to_owned(),
    };
    let encoded = serde_json::to_string(&model).expect("model DTO");
    assert_eq!(encoded, r#"{"slug":"gpt-test","displayName":"GPT Test"}"#);
    for forbidden in ["token", "authorization", "salt", "encrypted"] {
        assert!(!encoded.to_ascii_lowercase().contains(forbidden));
    }
}
