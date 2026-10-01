use std::{error::Error, fmt, time::Duration};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, TryRngCore as _};
use sha2::{Digest as _, Sha256};

use super::{
    loopback::{CallbackResult, LoopbackError, LoopbackListener},
    model::{
        AuthorizationClient, OAuthAttempt, OAuthNonce, OAuthState, PkceChallenge, PkceVerifier,
        DYNAMIC_CLIENT_ID,
    },
};

const AGENT_NAME: &str = "BOGUNON DESK";
const RESOURCE: &str = "https://api.openai.com/v1";
const SCOPES: &str =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const RANDOM_VALUE_BYTES: usize = 32;

pub(crate) struct OAuthParameters {
    state: OAuthState,
    nonce: OAuthNonce,
    verifier: PkceVerifier,
    challenge: PkceChallenge,
}

impl OAuthParameters {
    pub(crate) fn generate() -> Result<Self, OAuthError> {
        let state = OAuthState::new(random_base64url()?);
        let nonce = OAuthNonce::new(random_base64url()?);
        let verifier = PkceVerifier::new(random_base64url()?);
        let challenge = PkceChallenge::new(
            URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.expose().as_bytes())),
        );
        Ok(Self {
            state,
            nonce,
            verifier,
            challenge,
        })
    }

    #[cfg(test)]
    pub(crate) const fn state(&self) -> &OAuthState {
        &self.state
    }

    #[cfg(test)]
    pub(crate) const fn nonce(&self) -> &OAuthNonce {
        &self.nonce
    }

    #[cfg(test)]
    pub(crate) const fn verifier(&self) -> &PkceVerifier {
        &self.verifier
    }

    #[cfg(test)]
    pub(crate) const fn challenge(&self) -> &PkceChallenge {
        &self.challenge
    }
}

pub(crate) struct PreparedAuthorization {
    authorization_url: String,
    attempt: OAuthAttempt,
    listener: LoopbackListener,
}

impl PreparedAuthorization {
    pub(crate) fn authorization_url(&self) -> &str {
        &self.authorization_url
    }

    #[cfg(test)]
    pub(crate) fn redirect_uri(&self) -> &str {
        &self.attempt.redirect_uri
    }

    #[cfg(test)]
    pub(crate) const fn listener_address(&self) -> std::net::SocketAddr {
        self.listener.local_addr()
    }

    pub(crate) fn wait_with_timeout(
        self,
        timeout: Duration,
    ) -> Result<CompletedAuthorization, OAuthError> {
        let callback = self
            .listener
            .wait_for_callback(&self.attempt, timeout)
            .map_err(OAuthError::from)?;
        Ok(CompletedAuthorization {
            attempt: self.attempt,
            callback,
        })
    }
}

pub(crate) struct CompletedAuthorization {
    pub(crate) attempt: OAuthAttempt,
    pub(crate) callback: CallbackResult,
}

pub(crate) fn prepare_authorization(
    client: AuthorizationClient,
    ext_agent_host_id: &str,
    authorization_endpoint: &str,
) -> Result<PreparedAuthorization, OAuthError> {
    let listener = LoopbackListener::bind().map_err(OAuthError::from)?;
    let attempt = create_attempt(client, ext_agent_host_id, listener.redirect_uri())?;
    let authorization_url = build_authorization_url(authorization_endpoint, &attempt)?;
    Ok(PreparedAuthorization {
        authorization_url,
        attempt,
        listener,
    })
}

pub(crate) fn create_attempt(
    client: AuthorizationClient,
    ext_agent_host_id: &str,
    redirect_uri: &str,
) -> Result<OAuthAttempt, OAuthError> {
    let parameters = OAuthParameters::generate()?;
    Ok(OAuthAttempt {
        client,
        ext_agent_host_id: ext_agent_host_id.to_owned(),
        redirect_uri: redirect_uri.to_owned(),
        state: parameters.state,
        nonce: parameters.nonce,
        verifier: parameters.verifier,
        challenge: parameters.challenge,
    })
}

fn build_authorization_url(
    authorization_endpoint: &str,
    attempt: &OAuthAttempt,
) -> Result<String, OAuthError> {
    let mut url = reqwest::Url::parse(authorization_endpoint)
        .map_err(|_| OAuthError::InvalidAuthorizationEndpoint)?;
    let client_id = match &attempt.client {
        AuthorizationClient::Dynamic => DYNAMIC_CLIENT_ID,
        AuthorizationClient::Issued(client_id) => client_id.as_str(),
    };
    let mut query = url.query_pairs_mut();
    query
        .append_pair("response_type", "code")
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", &attempt.redirect_uri)
        .append_pair("scope", SCOPES)
        .append_pair("resource", RESOURCE)
        .append_pair("state", attempt.state.expose())
        .append_pair("nonce", attempt.nonce.expose())
        .append_pair("code_challenge", attempt.challenge.expose())
        .append_pair("code_challenge_method", "S256")
        .append_pair("ext_agent_host_id", &attempt.ext_agent_host_id);
    if matches!(&attempt.client, AuthorizationClient::Dynamic) {
        query.append_pair("agent_name_hint", AGENT_NAME);
    }
    drop(query);
    Ok(url.into())
}

fn random_base64url() -> Result<String, OAuthError> {
    let mut bytes = [0_u8; RANDOM_VALUE_BYTES];
    OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|_| OAuthError::RandomGeneration)?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OAuthError {
    RandomGeneration,
    InvalidAuthorizationEndpoint,
    Loopback(LoopbackError),
}

impl From<LoopbackError> for OAuthError {
    fn from(value: LoopbackError) -> Self {
        Self::Loopback(value)
    }
}

impl fmt::Display for OAuthError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::RandomGeneration => "ChatGPT 로그인 보안 값을 만들 수 없습니다.",
            Self::InvalidAuthorizationEndpoint => "ChatGPT 로그인 주소가 올바르지 않습니다.",
            Self::Loopback(error) => return error.fmt(formatter),
        };
        formatter.write_str(message)
    }
}

impl Error for OAuthError {}

#[cfg(test)]
#[path = "oauth/tests.rs"]
mod tests;
