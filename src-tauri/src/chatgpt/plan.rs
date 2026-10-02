use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Mutex;

use super::{
    http::{parse_discovery, HttpResponse, DISCOVERY_URL},
    model::{CredentialRecord, SecretToken},
    oidc::OPENAI_RESOURCE,
    storage::ChatGptCredentialStorage,
};

const MODELS_URL: &str = "https://api.openai.com/v1/models";
const RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const REFRESH_MARGIN_SECONDS: u64 = 60;
const MAX_API_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Default)]
pub(crate) struct ChatGptPlanState {
    refresh: Mutex<()>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptModelDto {
    pub(crate) slug: String,
    pub(crate) display_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateTextRequest {
    model: String,
    prompt: String,
}

impl GenerateTextRequest {
    pub(crate) const fn new(model: String, prompt: String) -> Self {
        Self { model, prompt }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ChatGptPlanErrorCode {
    ReauthenticationRequired,
    PermissionDenied,
    UsageLimitExceeded,
    UsageUnavailable,
    RateLimited,
    TemporaryFailure,
    InvalidResponse,
    NotConnected,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptPlanErrorDto {
    pub(crate) code: ChatGptPlanErrorCode,
    pub(crate) message: &'static str,
}

impl ChatGptPlanErrorDto {
    pub(crate) const fn storage() -> Self {
        Self::temporary()
    }
    pub(crate) const fn clock() -> Self {
        Self::temporary()
    }
    const fn temporary() -> Self {
        Self {
            code: ChatGptPlanErrorCode::TemporaryFailure,
            message: "ChatGPT 서비스에 일시적으로 연결할 수 없습니다.",
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
enum RequestBody {
    None,
    Form(Vec<(String, String)>),
    Json(serde_json::Value),
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct ApiRequest {
    method: ApiMethod,
    url: String,
    bearer: Option<String>,
    body: RequestBody,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ApiMethod {
    Get,
    Post,
}

pub(crate) struct ApiResponse {
    status: u16,
    request_id: Option<String>,
    body: Vec<u8>,
}

pub(crate) trait PlanTransport: Send + Sync {
    async fn send(&self, request: ApiRequest) -> Result<ApiResponse, InternalError>;
}

pub(crate) struct ReqwestPlanTransport {
    client: Client,
}

impl ReqwestPlanTransport {
    pub(crate) fn new() -> Result<Self, ChatGptPlanErrorDto> {
        Client::builder()
            .timeout(Duration::from_secs(120))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map(|client| Self { client })
            .map_err(|_| ChatGptPlanErrorDto::temporary())
    }
}

impl PlanTransport for ReqwestPlanTransport {
    async fn send(&self, request: ApiRequest) -> Result<ApiResponse, InternalError> {
        let mut builder = match request.method {
            ApiMethod::Get => self.client.get(&request.url),
            ApiMethod::Post => self.client.post(&request.url),
        };
        if let Some(token) = request.bearer {
            builder = builder.bearer_auth(token);
        }
        builder = match request.body {
            RequestBody::None => builder,
            RequestBody::Form(form) => builder.form(&form),
            RequestBody::Json(value) => builder.json(&value),
        };
        let mut response = builder.send().await.map_err(|_| InternalError::TRANSPORT)?;
        let status = response.status().as_u16();
        let request_id = response
            .headers()
            .get("x-request-id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| InternalError::TRANSPORT)?
        {
            if body.len().saturating_add(chunk.len()) > MAX_API_RESPONSE_BYTES {
                return Err(InternalError::INVALID_RESPONSE);
            }
            body.extend_from_slice(&chunk);
        }
        Ok(ApiResponse {
            status,
            request_id,
            body,
        })
    }
}

#[derive(Debug)]
pub(crate) struct InternalError {
    kind: InternalErrorKind,
    status: Option<u16>,
    request_id: Option<String>,
    machine_code: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum InternalErrorKind {
    Transport,
    InvalidResponse,
    NotConnected,
    Reauth,
    Permission,
    RateLimit,
    UsageExceeded,
    UsageUnavailable,
    Temporary,
}

impl InternalError {
    const fn bare(kind: InternalErrorKind) -> Self {
        Self {
            kind,
            status: None,
            request_id: None,
            machine_code: None,
        }
    }
    const TRANSPORT: Self = Self::bare(InternalErrorKind::Transport);
    const INVALID_RESPONSE: Self = Self::bare(InternalErrorKind::InvalidResponse);
    fn from_machine_code(machine_code: String) -> Self {
        let kind = match machine_code.as_str() {
            "subscription_sharing_usage_limit_exceeded" => InternalErrorKind::UsageExceeded,
            "subscription_sharing_usage_unavailable" => InternalErrorKind::UsageUnavailable,
            _ => InternalErrorKind::InvalidResponse,
        };
        Self {
            kind,
            status: None,
            request_id: None,
            machine_code: Some(machine_code),
        }
    }
    fn from_response(response: &ApiResponse) -> Self {
        let machine_code = parse_error_code(&response.body);
        let kind = match machine_code.as_deref() {
            Some("subscription_sharing_usage_limit_exceeded") => InternalErrorKind::UsageExceeded,
            Some("subscription_sharing_usage_unavailable") => InternalErrorKind::UsageUnavailable,
            _ => match response.status {
                401 => InternalErrorKind::Reauth,
                403 => InternalErrorKind::Permission,
                429 => InternalErrorKind::RateLimit,
                500..=599 => InternalErrorKind::Temporary,
                _ => InternalErrorKind::InvalidResponse,
            },
        };
        Self {
            kind,
            status: Some(response.status),
            request_id: response.request_id.clone(),
            machine_code,
        }
    }
    fn dto(&self) -> ChatGptPlanErrorDto {
        let _diagnostics = (&self.status, &self.request_id, &self.machine_code);
        match self.kind {
            InternalErrorKind::NotConnected => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::NotConnected,
                message: "ChatGPT 계정을 먼저 연결해 주세요.",
            },
            InternalErrorKind::Reauth => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::ReauthenticationRequired,
                message: "ChatGPT에 다시 로그인해 주세요.",
            },
            InternalErrorKind::Permission => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::PermissionDenied,
                message: "현재 계정 또는 지역에서는 ChatGPT 요금제 요청을 사용할 수 없습니다.",
            },
            InternalErrorKind::UsageExceeded => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::UsageLimitExceeded,
                message: "ChatGPT 요금제 사용 한도에 도달했습니다.",
            },
            InternalErrorKind::UsageUnavailable => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::UsageUnavailable,
                message: "현재 ChatGPT 요금제 사용량을 사용할 수 없습니다.",
            },
            InternalErrorKind::RateLimit => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::RateLimited,
                message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            },
            InternalErrorKind::Transport | InternalErrorKind::Temporary => {
                ChatGptPlanErrorDto::temporary()
            }
            InternalErrorKind::InvalidResponse => ChatGptPlanErrorDto {
                code: ChatGptPlanErrorCode::InvalidResponse,
                message: "ChatGPT 서비스 응답이 올바르지 않습니다.",
            },
        }
    }
}

pub(crate) async fn list_models<S: ChatGptCredentialStorage, T: PlanTransport>(
    storage: &S,
    transport: &T,
    state: &ChatGptPlanState,
    now: u64,
) -> Result<Vec<ChatGptModelDto>, ChatGptPlanErrorDto> {
    let token = valid_access_token(storage, transport, state, now)
        .await
        .map_err(|error| error.dto())?;
    let response = transport
        .send(ApiRequest {
            method: ApiMethod::Get,
            url: MODELS_URL.to_owned(),
            bearer: Some(token.expose().to_owned()),
            body: RequestBody::None,
        })
        .await
        .map_err(|error| error.dto())?;
    ensure_success(&response).map_err(|error| error.dto())?;
    parse_models(&response.body).map_err(|error| error.dto())
}

pub(crate) async fn generate_text<S: ChatGptCredentialStorage, T: PlanTransport>(
    storage: &S,
    transport: &T,
    state: &ChatGptPlanState,
    now: u64,
    request: &GenerateTextRequest,
) -> Result<String, ChatGptPlanErrorDto> {
    let token = valid_access_token(storage, transport, state, now)
        .await
        .map_err(|error| error.dto())?;
    let body = json!({ "model": request.model, "input": [{ "role": "user", "content": request.prompt }], "store": false, "stream": true });
    let response = transport
        .send(ApiRequest {
            method: ApiMethod::Post,
            url: RESPONSES_URL.to_owned(),
            bearer: Some(token.expose().to_owned()),
            body: RequestBody::Json(body),
        })
        .await
        .map_err(|error| error.dto())?;
    ensure_success(&response).map_err(|error| error.dto())?;
    parse_response_stream(&response.body).map_err(|error| error.dto())
}

async fn valid_access_token<S: ChatGptCredentialStorage, T: PlanTransport>(
    storage: &S,
    transport: &T,
    state: &ChatGptPlanState,
    now: u64,
) -> Result<SecretToken, InternalError> {
    let credential = storage
        .load_credential()
        .map_err(|_| InternalError::TRANSPORT)?
        .ok_or_else(|| InternalError::bare(InternalErrorKind::NotConnected))?;
    if !credential.plan_usage_enabled() {
        return Err(InternalError::bare(InternalErrorKind::Permission));
    }
    if !refresh_needed(&credential, now) {
        return Ok(credential.access_token);
    }
    let _guard = state.refresh.lock().await;
    let latest = storage
        .load_credential()
        .map_err(|_| InternalError::TRANSPORT)?
        .ok_or_else(|| InternalError::bare(InternalErrorKind::NotConnected))?;
    if !latest.plan_usage_enabled() {
        return Err(InternalError::bare(InternalErrorKind::Permission));
    }
    if !refresh_needed(&latest, now) {
        return Ok(latest.access_token);
    }
    if latest
        .earliest_refresh_at
        .is_some_and(|earliest| now < earliest)
    {
        let expires_at = latest.saved_at.saturating_add(latest.expires_in);
        return if now < expires_at {
            Ok(latest.access_token)
        } else {
            Err(InternalError::bare(InternalErrorKind::Temporary))
        };
    }
    refresh(storage, transport, latest, now).await
}

fn refresh_needed(credential: &CredentialRecord, now: u64) -> bool {
    now.saturating_add(REFRESH_MARGIN_SECONDS)
        >= credential.saved_at.saturating_add(credential.expires_in)
}

async fn refresh<S: ChatGptCredentialStorage, T: PlanTransport>(
    storage: &S,
    transport: &T,
    previous: CredentialRecord,
    now: u64,
) -> Result<SecretToken, InternalError> {
    let registration = storage
        .load_registration()
        .map_err(|_| InternalError::TRANSPORT)?
        .ok_or_else(|| InternalError::bare(InternalErrorKind::NotConnected))?;
    let refresh_token = previous
        .refresh_token
        .as_ref()
        .ok_or_else(|| InternalError::bare(InternalErrorKind::Reauth))?;
    let discovery_response = transport
        .send(ApiRequest {
            method: ApiMethod::Get,
            url: DISCOVERY_URL.to_owned(),
            bearer: None,
            body: RequestBody::None,
        })
        .await?;
    ensure_success(&discovery_response)?;
    let discovery_json = HttpResponse::new(discovery_response.status, discovery_response.body)
        .json()
        .map_err(|_| InternalError::INVALID_RESPONSE)?;
    let metadata = parse_discovery(&discovery_json).map_err(|_| InternalError::INVALID_RESPONSE)?;
    let response = transport
        .send(ApiRequest {
            method: ApiMethod::Post,
            url: metadata.token_endpoint,
            bearer: None,
            body: RequestBody::Form(vec![
                ("grant_type".to_owned(), "refresh_token".to_owned()),
                (
                    "client_id".to_owned(),
                    registration.issued_client_id.as_str().to_owned(),
                ),
                (
                    "refresh_token".to_owned(),
                    refresh_token.expose().to_owned(),
                ),
                ("resource".to_owned(), OPENAI_RESOURCE.to_owned()),
            ]),
        })
        .await?;
    if !(200..300).contains(&response.status) {
        let error = InternalError::from_response(&response);
        if terminal_refresh_error(error.machine_code.as_deref()) {
            storage
                .clear_credential()
                .map_err(|_| InternalError::TRANSPORT)?;
            return Err(InternalError::bare(InternalErrorKind::Reauth));
        }
        return Err(error);
    }
    let decoded: RefreshResponse =
        serde_json::from_slice(&response.body).map_err(|_| InternalError::INVALID_RESPONSE)?;
    let replacement = decoded.into_credential(&previous, now)?;
    let access = replacement.access_token.clone();
    storage
        .save_credential(&replacement)
        .map_err(|_| InternalError::TRANSPORT)?;
    Ok(access)
}

#[derive(Deserialize)]
struct RefreshResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: String,
    expires_in: u64,
    earliest_refresh_at: Option<u64>,
    scope: Option<String>,
}

impl RefreshResponse {
    fn into_credential(
        self,
        previous: &CredentialRecord,
        saved_at: u64,
    ) -> Result<CredentialRecord, InternalError> {
        if self.access_token.is_empty()
            || !self.token_type.eq_ignore_ascii_case("bearer")
            || self.expires_in == 0
        {
            return Err(InternalError::INVALID_RESPONSE);
        }
        let refresh_token = self
            .refresh_token
            .filter(|token| !token.is_empty())
            .map(SecretToken::new)
            .ok_or(InternalError::INVALID_RESPONSE)?;
        Ok(CredentialRecord {
            access_token: SecretToken::new(self.access_token),
            refresh_token: Some(refresh_token),
            id_token: self
                .id_token
                .map(SecretToken::new)
                .unwrap_or_else(|| previous.id_token.clone()),
            token_type: self.token_type,
            expires_in: self.expires_in,
            earliest_refresh_at: self.earliest_refresh_at,
            granted_scopes: self
                .scope
                .map(|scope| scope.split_ascii_whitespace().map(str::to_owned).collect())
                .unwrap_or_else(|| previous.granted_scopes.clone()),
            saved_at,
        })
    }
}

#[derive(Deserialize)]
struct ModelsEnvelope {
    models: Vec<ModelRecord>,
}
#[derive(Deserialize)]
struct ModelRecord {
    slug: String,
    #[serde(alias = "display_name")]
    display_name: String,
    visibility: String,
}

fn parse_models(body: &[u8]) -> Result<Vec<ChatGptModelDto>, InternalError> {
    let envelope: ModelsEnvelope =
        serde_json::from_slice(body).map_err(|_| InternalError::INVALID_RESPONSE)?;
    Ok(envelope
        .models
        .into_iter()
        .filter(|model| model.visibility == "list")
        .map(|model| ChatGptModelDto {
            slug: model.slug,
            display_name: model.display_name,
        })
        .collect())
}

fn parse_response_stream(body: &[u8]) -> Result<String, InternalError> {
    let text = std::str::from_utf8(body).map_err(|_| InternalError::INVALID_RESPONSE)?;
    let text = text.replace("\r\n", "\n");
    let mut output = String::new();
    let mut completed = false;
    for frame in text.split("\n\n") {
        let data = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:").map(str::trim))
            .collect::<Vec<_>>()
            .join("\n");
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let event: StreamEvent =
            serde_json::from_str(&data).map_err(|_| InternalError::INVALID_RESPONSE)?;
        match event.kind.as_str() {
            "response.output_text.delta" => output.push_str(
                event
                    .delta
                    .as_deref()
                    .ok_or(InternalError::INVALID_RESPONSE)?,
            ),
            "response.completed" => completed = true,
            "response.failed" => {
                return Err(event
                    .response
                    .and_then(|response| response.error)
                    .map(|error| InternalError::from_machine_code(error.code))
                    .unwrap_or(InternalError::INVALID_RESPONSE));
            }
            "response.incomplete" => return Err(InternalError::INVALID_RESPONSE),
            _ => {}
        }
    }
    completed
        .then_some(output)
        .ok_or(InternalError::INVALID_RESPONSE)
}

#[derive(Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    kind: String,
    delta: Option<String>,
    response: Option<StreamResponse>,
}

#[derive(Deserialize)]
struct StreamResponse {
    error: Option<StreamError>,
}

#[derive(Deserialize)]
struct StreamError {
    code: String,
}

fn ensure_success(response: &ApiResponse) -> Result<(), InternalError> {
    if response.status == 200 {
        Ok(())
    } else {
        Err(InternalError::from_response(response))
    }
}
fn parse_error_code(body: &[u8]) -> Option<String> {
    serde_json::from_slice::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/code")
                .and_then(|code| code.as_str())
                .or_else(|| value.get("error").and_then(|error| error.as_str()))
                .map(str::to_owned)
        })
}
fn terminal_refresh_error(code: Option<&str>) -> bool {
    matches!(
        code,
        Some(
            "invalid_grant"
                | "invalid_refresh_token"
                | "token_expired"
                | "refresh_token_expired"
                | "refresh_token_invalidated"
                | "refresh_token_reused"
        )
    )
}

#[cfg(test)]
#[path = "plan/tests.rs"]
mod tests;
