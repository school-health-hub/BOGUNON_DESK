use std::{error::Error, fmt, time::Duration};

use reqwest::{Client, Url};
use serde_json::Value;

use super::model::DiscoveryMetadata;

pub(crate) const DISCOVERY_URL: &str = "https://auth.openai.com/.well-known/openid-configuration";
pub(crate) const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HttpMethod {
    Get,
    PostForm,
}

pub(crate) struct HttpResponse {
    status: u16,
    body: Vec<u8>,
}

impl HttpResponse {
    pub(crate) fn new(status: u16, body: Vec<u8>) -> Self {
        Self { status, body }
    }

    pub(crate) const fn status(&self) -> u16 {
        self.status
    }

    pub(crate) fn json(&self) -> Result<Value, HttpError> {
        serde_json::from_slice(&self.body).map_err(|_| HttpError::InvalidResponse)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TransportError {
    Unavailable,
    ResponseTooLarge,
}

impl fmt::Display for TransportError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ChatGPT 인증 서버에 연결할 수 없습니다.")
    }
}

impl Error for TransportError {}

pub(crate) trait HttpTransport: Send + Sync {
    async fn send(
        &self,
        method: HttpMethod,
        url: &str,
        form: &[(String, String)],
    ) -> Result<HttpResponse, TransportError>;
}

#[derive(Clone)]
pub(crate) struct ReqwestTransport {
    client: Client,
}

impl ReqwestTransport {
    pub(crate) fn new() -> Result<Self, HttpError> {
        Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map(|client| Self { client })
            .map_err(|_| HttpError::ClientConfiguration)
    }
}

impl HttpTransport for ReqwestTransport {
    async fn send(
        &self,
        method: HttpMethod,
        url: &str,
        form: &[(String, String)],
    ) -> Result<HttpResponse, TransportError> {
        let request = match method {
            HttpMethod::Get => self.client.get(url),
            HttpMethod::PostForm => self.client.post(url).form(form),
        };
        let mut response = request
            .send()
            .await
            .map_err(|_| TransportError::Unavailable)?;
        if response
            .content_length()
            .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
        {
            return Err(TransportError::ResponseTooLarge);
        }
        let status = response.status().as_u16();
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| TransportError::Unavailable)?
        {
            if body.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
                return Err(TransportError::ResponseTooLarge);
            }
            body.extend_from_slice(&chunk);
        }
        Ok(HttpResponse::new(status, body))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum EndpointKind {
    Authorization,
    Token,
    Jwks,
    Revocation,
}

pub(crate) fn parse_discovery(value: &Value) -> Result<DiscoveryMetadata, HttpError> {
    let metadata: DiscoveryMetadata =
        serde_json::from_value(value.clone()).map_err(|_| HttpError::InvalidDiscovery)?;
    if metadata.issuer != "https://auth.openai.com" {
        return Err(HttpError::InvalidDiscovery);
    }
    validate_endpoint(
        &metadata.authorization_endpoint,
        EndpointKind::Authorization,
    )?;
    validate_endpoint(&metadata.token_endpoint, EndpointKind::Token)?;
    validate_endpoint(&metadata.jwks_uri, EndpointKind::Jwks)?;
    validate_endpoint(&metadata.revocation_endpoint, EndpointKind::Revocation)?;
    Ok(metadata)
}

pub(crate) fn validate_endpoint(value: &str, kind: EndpointKind) -> Result<Url, HttpError> {
    let lowered = value.to_ascii_lowercase();
    if lowered.contains("%2e") || lowered.contains("\\") {
        return Err(HttpError::InvalidDiscovery);
    }
    let url = Url::parse(value).map_err(|_| HttpError::InvalidDiscovery)?;
    let base_is_valid = url.scheme() == "https"
        && url.host_str() == Some("auth.openai.com")
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none();
    let path_is_valid = match kind {
        EndpointKind::Authorization => url.path() == "/api/accounts/authorize",
        EndpointKind::Token => url.path() == "/api/accounts/oauth/token",
        EndpointKind::Jwks => url.path().starts_with("/.well-known/") && url.path().len() > 13,
        EndpointKind::Revocation => url.path() == "/api/accounts/oauth/revoke",
    };
    (base_is_valid && path_is_valid)
        .then_some(url)
        .ok_or(HttpError::InvalidDiscovery)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HttpError {
    ClientConfiguration,
    InvalidDiscovery,
    InvalidResponse,
}

impl fmt::Display for HttpError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::ClientConfiguration => "ChatGPT 네트워크를 초기화할 수 없습니다.",
            Self::InvalidDiscovery => "ChatGPT 인증 서버 구성이 올바르지 않습니다.",
            Self::InvalidResponse => "ChatGPT 인증 서버 응답이 올바르지 않습니다.",
        };
        formatter.write_str(message)
    }
}

impl Error for HttpError {}

#[cfg(test)]
#[path = "http/tests.rs"]
mod tests;
