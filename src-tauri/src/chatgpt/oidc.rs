use std::{error::Error, fmt};

use jsonwebtoken::jwk::JwkSet;
use serde::Deserialize;

use super::{
    http::{
        parse_discovery, HttpError, HttpMethod, HttpResponse, HttpTransport, TransportError,
        DISCOVERY_URL,
    },
    model::{
        AuthorizationCode, CredentialRecord, DiscoveryMetadata, IssuedClientId, OAuthNonce,
        PkceVerifier, SecretToken, ValidatedIdentity,
    },
};

mod validation;
pub(crate) use validation::validate_id_token;

pub(crate) const OPENAI_RESOURCE: &str = "https://api.openai.com/v1";

pub(crate) struct TokenExchangeRequest<'a> {
    pub(crate) client_id: &'a IssuedClientId,
    pub(crate) code: &'a AuthorizationCode,
    pub(crate) verifier: &'a PkceVerifier,
    pub(crate) redirect_uri: &'a str,
    pub(crate) nonce: &'a OAuthNonce,
    pub(crate) saved_at: u64,
}

pub(crate) struct ValidatedTokenExchange {
    pub(crate) identity: ValidatedIdentity,
    pub(crate) credential: CredentialRecord,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum RevocationStatus {
    Confirmed,
    Unconfirmed,
}

pub(crate) struct OidcClient<'a, Transport> {
    transport: &'a Transport,
}

impl<'a, Transport> OidcClient<'a, Transport>
where
    Transport: HttpTransport,
{
    pub(crate) const fn new(transport: &'a Transport) -> Self {
        Self { transport }
    }

    pub(crate) async fn exchange_and_validate(
        &self,
        request: TokenExchangeRequest<'_>,
    ) -> Result<ValidatedTokenExchange, OidcError> {
        let discovery = self.fetch_discovery_metadata().await?;
        let form = vec![
            ("grant_type".to_owned(), "authorization_code".to_owned()),
            (
                "client_id".to_owned(),
                request.client_id.as_str().to_owned(),
            ),
            ("code".to_owned(), request.code.expose().to_owned()),
            (
                "code_verifier".to_owned(),
                request.verifier.expose().to_owned(),
            ),
            ("redirect_uri".to_owned(), request.redirect_uri.to_owned()),
            ("resource".to_owned(), OPENAI_RESOURCE.to_owned()),
        ];
        let token_response = self
            .send_success(HttpMethod::PostForm, &discovery.token_endpoint, &form)
            .await?;
        let token: TokenResponse = serde_json::from_value(token_response.json()?)
            .map_err(|_| OidcError::InvalidTokenResponse)?;
        token.validate()?;
        let jwks_response = self
            .send_success(HttpMethod::Get, &discovery.jwks_uri, &[])
            .await?;
        let jwks: JwkSet = serde_json::from_value(jwks_response.json()?)
            .map_err(|_| OidcError::InvalidIdentity)?;
        let identity = validate_id_token(
            &SecretToken::new(&token.id_token),
            &jwks,
            request.client_id,
            request.nonce,
            &discovery.issuer,
        )?;
        let granted_scopes = token
            .scope
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_owned)
            .collect();
        Ok(ValidatedTokenExchange {
            identity,
            credential: CredentialRecord {
                access_token: SecretToken::new(token.access_token),
                refresh_token: token.refresh_token.map(SecretToken::new),
                id_token: SecretToken::new(token.id_token),
                token_type: token.token_type,
                expires_in: token.expires_in,
                earliest_refresh_at: token.earliest_refresh_at,
                granted_scopes,
                saved_at: request.saved_at,
            },
        })
    }

    pub(crate) async fn revoke_refresh_token(
        &self,
        client_id: &IssuedClientId,
        refresh_token: &SecretToken,
    ) -> RevocationStatus {
        let Ok(discovery) = self.fetch_discovery_metadata().await else {
            return RevocationStatus::Unconfirmed;
        };
        let form = vec![
            ("token".to_owned(), refresh_token.expose().to_owned()),
            ("token_type_hint".to_owned(), "refresh_token".to_owned()),
            ("client_id".to_owned(), client_id.as_str().to_owned()),
        ];
        for attempt in 0..2 {
            match self
                .transport
                .send(HttpMethod::PostForm, &discovery.revocation_endpoint, &form)
                .await
            {
                Ok(response) if (200..300).contains(&response.status()) => {
                    return RevocationStatus::Confirmed;
                }
                Ok(response) if response.status() < 500 => {
                    return RevocationStatus::Unconfirmed;
                }
                Ok(_) | Err(TransportError::Unavailable) if attempt == 0 => {}
                Ok(_) | Err(TransportError::Unavailable | TransportError::ResponseTooLarge) => {
                    return RevocationStatus::Unconfirmed;
                }
            }
        }
        RevocationStatus::Unconfirmed
    }

    pub(crate) async fn fetch_discovery_metadata(&self) -> Result<DiscoveryMetadata, OidcError> {
        let response = self
            .send_success(HttpMethod::Get, DISCOVERY_URL, &[])
            .await?;
        parse_discovery(&response.json()?).map_err(Into::into)
    }

    async fn send_success(
        &self,
        method: HttpMethod,
        url: &str,
        form: &[(String, String)],
    ) -> Result<HttpResponse, OidcError> {
        let response = self.transport.send(method, url, form).await?;
        if (200..300).contains(&response.status()) {
            Ok(response)
        } else {
            Err(OidcError::RequestFailed)
        }
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: String,
    token_type: String,
    expires_in: u64,
    earliest_refresh_at: Option<u64>,
    scope: Option<String>,
}

impl TokenResponse {
    fn validate(&self) -> Result<(), OidcError> {
        let valid = !self.access_token.is_empty()
            && !self.id_token.is_empty()
            && self.token_type.eq_ignore_ascii_case("bearer")
            && self.expires_in > 0;
        valid.then_some(()).ok_or(OidcError::InvalidTokenResponse)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OidcError {
    InvalidDiscovery,
    InvalidResponse,
    InvalidTokenResponse,
    InvalidIdentity,
    RequestFailed,
}

impl From<HttpError> for OidcError {
    fn from(value: HttpError) -> Self {
        match value {
            HttpError::InvalidDiscovery => Self::InvalidDiscovery,
            HttpError::InvalidResponse => Self::InvalidResponse,
            HttpError::ClientConfiguration => Self::RequestFailed,
        }
    }
}

impl From<TransportError> for OidcError {
    fn from(_: TransportError) -> Self {
        Self::RequestFailed
    }
}

impl fmt::Display for OidcError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidDiscovery => "ChatGPT 인증 서버 구성이 올바르지 않습니다.",
            Self::InvalidResponse | Self::InvalidTokenResponse => {
                "ChatGPT 인증 서버 응답이 올바르지 않습니다."
            }
            Self::InvalidIdentity => "ChatGPT 신원 확인에 실패했습니다.",
            Self::RequestFailed => "ChatGPT 인증 서버 요청에 실패했습니다.",
        };
        formatter.write_str(message)
    }
}

impl Error for OidcError {}

#[cfg(test)]
#[path = "oidc/tests.rs"]
mod tests;
