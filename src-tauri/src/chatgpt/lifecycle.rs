use std::time::Duration;

use super::{
    credential::ChatGptCredentialMutationState,
    http::HttpTransport,
    model::{
        AuthorizationClient, ChatGptConnectionStateDto, ChatGptNoticeCode, ChatGptNoticeDto,
        CredentialRecord, IssuedClientId, RegistrationRecord, ValidatedIdentity,
    },
    oauth::prepare_authorization,
    oidc::{OidcClient, RevocationStatus, TokenExchangeRequest},
    storage::ChatGptCredentialStorage,
};

mod error;
pub(crate) use error::ChatGptLifecycleError;

pub(crate) trait BrowserOpener {
    fn open(&self, authorization_url: &str) -> Result<(), ChatGptLifecycleError>;
}

pub(crate) struct SignInEnvironment<'a, Storage, Transport, Opener> {
    storage: &'a Storage,
    transport: &'a Transport,
    opener: &'a Opener,
    callback_timeout: Duration,
    saved_at: u64,
    credential_state: &'a ChatGptCredentialMutationState,
}

impl<'a, Storage, Transport, Opener> SignInEnvironment<'a, Storage, Transport, Opener> {
    pub(crate) const fn new(
        storage: &'a Storage,
        transport: &'a Transport,
        opener: &'a Opener,
        callback_timeout: Duration,
        saved_at: u64,
        credential_state: &'a ChatGptCredentialMutationState,
    ) -> Self {
        Self {
            storage,
            transport,
            opener,
            callback_timeout,
            saved_at,
            credential_state,
        }
    }
}

pub(crate) fn connection_state<Storage>(
    storage: &Storage,
    active: bool,
    notice: Option<ChatGptNoticeDto>,
) -> Result<ChatGptConnectionStateDto, ChatGptLifecycleError>
where
    Storage: ChatGptCredentialStorage,
{
    let registration = storage.load_registration()?;
    if active {
        return Ok(ChatGptConnectionStateDto::busy(registration.is_some()));
    }
    let credential = storage.load_credential()?;
    Ok(state_from_records(
        registration.as_ref(),
        credential.as_ref(),
        notice,
    ))
}

pub(crate) async fn sign_in<Storage, Transport, Opener>(
    environment: SignInEnvironment<'_, Storage, Transport, Opener>,
) -> Result<ChatGptConnectionStateDto, ChatGptLifecycleError>
where
    Storage: ChatGptCredentialStorage,
    Transport: HttpTransport,
    Opener: BrowserOpener,
{
    let host = environment.storage.load_or_create_host()?;
    let existing_registration = environment.storage.load_registration()?;
    let client = authorization_client(existing_registration.as_ref());
    let discovery = OidcClient::new(environment.transport)
        .fetch_discovery_metadata()
        .await?;
    let prepared = prepare_authorization(
        client,
        &host.ext_agent_host_id,
        &discovery.authorization_endpoint,
    )?;
    environment.opener.open(prepared.authorization_url())?;
    let callback_timeout = environment.callback_timeout;
    let completed =
        tauri::async_runtime::spawn_blocking(move || prepared.wait_with_timeout(callback_timeout))
            .await
            .map_err(|_| ChatGptLifecycleError::CallbackWorker)??;
    let issued_client_id = completed.callback.issued_client_id.clone();
    let exchange = OidcClient::new(environment.transport)
        .exchange_and_validate(TokenExchangeRequest {
            client_id: &issued_client_id,
            code: &completed.callback.authorization_code,
            verifier: &completed.attempt.verifier,
            redirect_uri: &completed.attempt.redirect_uri,
            nonce: &completed.attempt.nonce,
            saved_at: environment.saved_at,
        })
        .await?;
    let registration = next_registration(
        existing_registration.as_ref(),
        issued_client_id,
        &exchange.identity,
    )?;
    let _credential_guard = environment.credential_state.lock().await;
    environment.storage.save_registration(&registration)?;
    environment.storage.save_credential(&exchange.credential)?;
    Ok(ChatGptConnectionStateDto::connected(
        &registration,
        &exchange.credential,
    ))
}

pub(crate) async fn disconnect<Storage, Transport>(
    storage: &Storage,
    transport: &Transport,
    credential_state: &ChatGptCredentialMutationState,
) -> Result<ChatGptConnectionStateDto, ChatGptLifecycleError>
where
    Storage: ChatGptCredentialStorage,
    Transport: HttpTransport,
{
    let _credential_guard = credential_state.lock().await;
    let registration = storage.load_registration()?;
    let revocation = match storage.load_credential() {
        Ok(credential) => {
            revoke_if_possible(registration.as_ref(), credential.as_ref(), transport).await
        }
        Err(_) => RevocationStatus::Unconfirmed,
    };
    storage.clear_credential()?;
    let mut state = ChatGptConnectionStateDto::disconnected(registration.is_some());
    if revocation == RevocationStatus::Unconfirmed {
        state = state.with_notice(ChatGptNoticeDto {
            code: ChatGptNoticeCode::RemoteRevocationFailed,
            message: "원격 연결 해제 확인은 실패했지만 이 PC의 ChatGPT 연결 정보는 제거되었습니다.",
        });
    }
    Ok(state)
}

async fn revoke_if_possible<Transport>(
    registration: Option<&RegistrationRecord>,
    credential: Option<&CredentialRecord>,
    transport: &Transport,
) -> RevocationStatus
where
    Transport: HttpTransport,
{
    match (
        registration,
        credential.and_then(|record| record.refresh_token.as_ref()),
    ) {
        (Some(registration), Some(refresh_token)) => {
            OidcClient::new(transport)
                .revoke_refresh_token(&registration.issued_client_id, refresh_token)
                .await
        }
        _ => RevocationStatus::Confirmed,
    }
}

pub(super) fn authorization_client(
    registration: Option<&RegistrationRecord>,
) -> AuthorizationClient {
    match registration {
        Some(record) => AuthorizationClient::Issued(record.issued_client_id.clone()),
        None => AuthorizationClient::Dynamic,
    }
}

pub(super) fn next_registration(
    existing: Option<&RegistrationRecord>,
    issued_client_id: IssuedClientId,
    identity: &ValidatedIdentity,
) -> Result<RegistrationRecord, ChatGptLifecycleError> {
    if let Some(registration) = existing {
        if registration.subject != identity.subject {
            return Err(ChatGptLifecycleError::SubjectMismatch);
        }
        return Ok(RegistrationRecord {
            issued_client_id,
            issuer: identity.issuer.clone(),
            subject: identity.subject.clone(),
            email: identity.email.clone(),
            display_name: identity.display_name.clone(),
            plan_usage_notice_acknowledged: registration.plan_usage_notice_acknowledged,
        });
    }
    Ok(RegistrationRecord {
        issued_client_id,
        issuer: identity.issuer.clone(),
        subject: identity.subject.clone(),
        email: identity.email.clone(),
        display_name: identity.display_name.clone(),
        plan_usage_notice_acknowledged: false,
    })
}

pub(super) fn state_from_records(
    registration: Option<&RegistrationRecord>,
    credential: Option<&CredentialRecord>,
    notice: Option<ChatGptNoticeDto>,
) -> ChatGptConnectionStateDto {
    match (registration, credential) {
        (Some(registration), Some(credential)) => {
            let mut state = ChatGptConnectionStateDto::connected(registration, credential);
            if let Some(notice) = notice {
                state = state.with_notice(notice);
            }
            state
        }
        _ => {
            let mut state = ChatGptConnectionStateDto::disconnected(registration.is_some());
            if let Some(notice) = notice {
                state = state.with_notice(notice);
            }
            state
        }
    }
}

#[cfg(test)]
#[path = "lifecycle/contract_tests.rs"]
mod contract_tests;

#[cfg(test)]
#[path = "lifecycle/tests.rs"]
mod tests;
