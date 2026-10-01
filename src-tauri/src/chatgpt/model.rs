use std::{error::Error, fmt};

use serde::{Deserialize, Serialize};

pub(crate) const DIRECT_PLAN_SCOPE: &str = "chatgpt.tokens.use.direct";
pub(crate) const DYNAMIC_CLIENT_ID: &str = "dynamic_agent_client";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostRecord {
    pub(crate) ext_agent_host_id: String,
}

#[derive(Clone, Eq, PartialEq, Deserialize, Serialize)]
#[serde(try_from = "String", into = "String")]
pub(crate) struct IssuedClientId(String);

impl IssuedClientId {
    pub(crate) fn parse(value: &str) -> Result<Self, ChatGptModelError> {
        let suffix = value.strip_prefix("oaiapp_").unwrap_or_default();
        let valid = !suffix.is_empty()
            && value.len() <= 256
            && suffix
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
        valid
            .then(|| Self(value.to_owned()))
            .ok_or(ChatGptModelError::InvalidIssuedClientId)
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for IssuedClientId {
    type Error = ChatGptModelError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(&value)
    }
}

impl From<IssuedClientId> for String {
    fn from(value: IssuedClientId) -> Self {
        value.0
    }
}

#[derive(Clone, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegistrationRecord {
    pub(crate) issued_client_id: IssuedClientId,
    pub(crate) issuer: String,
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    pub(crate) display_name: Option<String>,
    pub(crate) plan_usage_notice_acknowledged: bool,
}

pub(crate) struct TokenKind;
pub(crate) struct AuthorizationCodeKind;
pub(crate) struct OAuthStateKind;
pub(crate) struct OAuthNonceKind;
pub(crate) struct PkceVerifierKind;
pub(crate) struct PkceChallengeKind;

pub(crate) struct SecretValue<Kind> {
    value: String,
    kind: std::marker::PhantomData<Kind>,
}

impl<Kind> SecretValue<Kind> {
    pub(crate) fn new(value: impl Into<String>) -> Self {
        Self {
            value: value.into(),
            kind: std::marker::PhantomData,
        }
    }

    pub(crate) fn expose(&self) -> &str {
        &self.value
    }
}

impl<Kind> Clone for SecretValue<Kind> {
    fn clone(&self) -> Self {
        Self::new(&self.value)
    }
}

pub(crate) type SecretToken = SecretValue<TokenKind>;
pub(crate) type AuthorizationCode = SecretValue<AuthorizationCodeKind>;
pub(crate) type OAuthState = SecretValue<OAuthStateKind>;
pub(crate) type OAuthNonce = SecretValue<OAuthNonceKind>;
pub(crate) type PkceVerifier = SecretValue<PkceVerifierKind>;
pub(crate) type PkceChallenge = SecretValue<PkceChallengeKind>;

pub(crate) enum AuthorizationClient {
    Dynamic,
    Issued(IssuedClientId),
}

pub(crate) struct OAuthAttempt {
    pub(crate) client: AuthorizationClient,
    pub(crate) ext_agent_host_id: String,
    pub(crate) redirect_uri: String,
    pub(crate) state: OAuthState,
    pub(crate) nonce: OAuthNonce,
    pub(crate) verifier: PkceVerifier,
    pub(crate) challenge: PkceChallenge,
}

#[derive(Deserialize)]
pub(crate) struct DiscoveryMetadata {
    pub(crate) issuer: String,
    pub(crate) authorization_endpoint: String,
    pub(crate) token_endpoint: String,
    pub(crate) jwks_uri: String,
    pub(crate) revocation_endpoint: String,
}

pub(crate) struct ValidatedIdentity {
    pub(crate) issuer: String,
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    pub(crate) display_name: Option<String>,
}

#[derive(Clone)]
pub(crate) struct CredentialRecord {
    pub(crate) access_token: SecretToken,
    pub(crate) refresh_token: Option<SecretToken>,
    pub(crate) id_token: SecretToken,
    pub(crate) token_type: String,
    pub(crate) expires_in: u64,
    pub(crate) earliest_refresh_at: Option<u64>,
    pub(crate) granted_scopes: Vec<String>,
    pub(crate) saved_at: u64,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CredentialStorageEnvelope {
    access_token: String,
    refresh_token: Option<String>,
    id_token: String,
    token_type: String,
    expires_in: u64,
    earliest_refresh_at: Option<u64>,
    granted_scopes: Vec<String>,
    saved_at: u64,
}

impl CredentialRecord {
    pub(crate) fn plan_usage_enabled(&self) -> bool {
        self.granted_scopes
            .iter()
            .any(|scope| scope == DIRECT_PLAN_SCOPE)
    }

    pub(crate) fn to_storage_json(&self) -> Result<Vec<u8>, ChatGptModelError> {
        serde_json::to_vec(&CredentialStorageEnvelope::from(self))
            .map_err(|_| ChatGptModelError::CredentialEncoding)
    }

    pub(crate) fn from_storage_json(value: &[u8]) -> Result<Self, ChatGptModelError> {
        serde_json::from_slice::<CredentialStorageEnvelope>(value)
            .map(Into::into)
            .map_err(|_| ChatGptModelError::CredentialDecoding)
    }
}

impl From<&CredentialRecord> for CredentialStorageEnvelope {
    fn from(value: &CredentialRecord) -> Self {
        Self {
            access_token: value.access_token.expose().to_owned(),
            refresh_token: value
                .refresh_token
                .as_ref()
                .map(|token| token.expose().to_owned()),
            id_token: value.id_token.expose().to_owned(),
            token_type: value.token_type.clone(),
            expires_in: value.expires_in,
            earliest_refresh_at: value.earliest_refresh_at,
            granted_scopes: value.granted_scopes.clone(),
            saved_at: value.saved_at,
        }
    }
}

impl From<CredentialStorageEnvelope> for CredentialRecord {
    fn from(value: CredentialStorageEnvelope) -> Self {
        Self {
            access_token: SecretToken::new(value.access_token),
            refresh_token: value.refresh_token.map(SecretToken::new),
            id_token: SecretToken::new(value.id_token),
            token_type: value.token_type,
            expires_in: value.expires_in,
            earliest_refresh_at: value.earliest_refresh_at,
            granted_scopes: value.granted_scopes,
            saved_at: value.saved_at,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ChatGptConnectionStatus {
    Disconnected,
    Connected,
    Busy,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ChatGptNoticeCode {
    PlanUsageUnavailable,
    RemoteRevocationFailed,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptNoticeDto {
    pub(crate) code: ChatGptNoticeCode,
    pub(crate) message: &'static str,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptConnectionStateDto {
    pub(crate) status: ChatGptConnectionStatus,
    pub(crate) email: Option<String>,
    pub(crate) display_name: Option<String>,
    pub(crate) plan_usage_enabled: bool,
    pub(crate) client_registration_exists: bool,
    pub(crate) show_plan_usage_notice: bool,
    pub(crate) notice: Option<ChatGptNoticeDto>,
}

impl ChatGptConnectionStateDto {
    pub(crate) fn disconnected(client_registration_exists: bool) -> Self {
        Self {
            status: ChatGptConnectionStatus::Disconnected,
            email: None,
            display_name: None,
            plan_usage_enabled: false,
            client_registration_exists,
            show_plan_usage_notice: false,
            notice: None,
        }
    }

    pub(crate) fn busy(client_registration_exists: bool) -> Self {
        Self {
            status: ChatGptConnectionStatus::Busy,
            email: None,
            display_name: None,
            plan_usage_enabled: false,
            client_registration_exists,
            show_plan_usage_notice: false,
            notice: None,
        }
    }

    pub(crate) fn with_notice(mut self, notice: ChatGptNoticeDto) -> Self {
        self.notice = Some(notice);
        self
    }

    pub(crate) fn connected(
        registration: &RegistrationRecord,
        credential: &CredentialRecord,
    ) -> Self {
        let plan_usage_enabled = credential.plan_usage_enabled();
        Self {
            status: ChatGptConnectionStatus::Connected,
            email: registration.email.clone(),
            display_name: registration.display_name.clone(),
            plan_usage_enabled,
            client_registration_exists: true,
            show_plan_usage_notice: plan_usage_enabled
                && !registration.plan_usage_notice_acknowledged,
            notice: (!plan_usage_enabled).then_some(ChatGptNoticeDto {
                code: ChatGptNoticeCode::PlanUsageUnavailable,
                message: "ChatGPT 요금제 사용 권한이 없어 연결만 유지됩니다.",
            }),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ChatGptModelError {
    InvalidIssuedClientId,
    CredentialEncoding,
    CredentialDecoding,
}

impl fmt::Display for ChatGptModelError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidIssuedClientId => "발급된 ChatGPT 앱 등록 정보가 올바르지 않습니다.",
            Self::CredentialEncoding => "ChatGPT 연결 정보를 저장할 수 없습니다.",
            Self::CredentialDecoding => "저장된 ChatGPT 연결 정보를 읽을 수 없습니다.",
        };
        formatter.write_str(message)
    }
}

impl Error for ChatGptModelError {}

#[cfg(test)]
#[path = "model/tests.rs"]
mod tests;
