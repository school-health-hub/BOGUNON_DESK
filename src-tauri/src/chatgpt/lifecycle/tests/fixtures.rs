use std::{io::Write as _, net::TcpStream, sync::Mutex};

use super::super::*;
use crate::chatgpt::{
    model::{HostRecord, SecretToken, DIRECT_PLAN_SCOPE},
    storage::StorageError,
};

const HOST_ID: &str = "urn:uuid:6b30c832-a704-47cb-8bca-1f820f164f5d";

pub(super) struct MemoryStorage {
    registration: Mutex<Option<RegistrationRecord>>,
    credential: Mutex<Option<CredentialRecord>>,
}

impl MemoryStorage {
    pub(super) const fn empty() -> Self {
        Self {
            registration: Mutex::new(None),
            credential: Mutex::new(None),
        }
    }

    pub(super) fn with_registration(
        registration: RegistrationRecord,
        credential: CredentialRecord,
    ) -> Self {
        Self {
            registration: Mutex::new(Some(registration)),
            credential: Mutex::new(Some(credential)),
        }
    }
}

impl ChatGptCredentialStorage for MemoryStorage {
    fn load_or_create_host(&self) -> Result<HostRecord, StorageError> {
        Ok(HostRecord {
            ext_agent_host_id: HOST_ID.to_owned(),
        })
    }

    fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError> {
        Ok(self.registration.lock().expect("registration lock").clone())
    }

    fn save_registration(&self, registration: &RegistrationRecord) -> Result<(), StorageError> {
        *self.registration.lock().expect("registration lock") = Some(registration.clone());
        Ok(())
    }

    fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError> {
        Ok(self.credential.lock().expect("credential lock").clone())
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

pub(super) struct CallbackOpener {
    callback_client_id: Option<&'static str>,
    pub(super) nonce: Mutex<Option<String>>,
    pub(super) opened_urls: Mutex<Vec<String>>,
}

impl CallbackOpener {
    pub(super) const fn new(callback_client_id: Option<&'static str>) -> Self {
        Self {
            callback_client_id,
            nonce: Mutex::new(None),
            opened_urls: Mutex::new(Vec::new()),
        }
    }
}

impl BrowserOpener for CallbackOpener {
    fn open(&self, authorization_url: &str) -> Result<(), ChatGptLifecycleError> {
        self.opened_urls
            .lock()
            .expect("opened URL lock")
            .push(authorization_url.to_owned());
        let url = reqwest::Url::parse(authorization_url).expect("authorization URL");
        let redirect_uri = query_value(&url, "redirect_uri");
        let state = query_value(&url, "state");
        *self.nonce.lock().expect("nonce lock") = Some(query_value(&url, "nonce"));
        let callback_client_id = self.callback_client_id;
        std::thread::spawn(move || {
            let redirect = reqwest::Url::parse(&redirect_uri).expect("redirect URL");
            let port = redirect.port().expect("loopback port");
            let mut callback = format!("/auth/callback?state={state}&code=code-sentinel");
            if let Some(client_id) = callback_client_id {
                callback.push_str("&client_id=");
                callback.push_str(client_id);
            }
            let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("callback connect");
            let request = format!(
                "GET {callback} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
            );
            stream
                .write_all(request.as_bytes())
                .expect("callback write");
        });
        Ok(())
    }
}

fn query_value(url: &reqwest::Url, key: &str) -> String {
    url.query_pairs()
        .find_map(|(name, value)| (name == key).then(|| value.into_owned()))
        .expect("query value")
}

pub(super) fn registration(subject: &str) -> RegistrationRecord {
    RegistrationRecord {
        issued_client_id: IssuedClientId::parse("oaiapp_lifecycle").expect("issued client"),
        issuer: "https://auth.openai.com".to_owned(),
        subject: subject.to_owned(),
        email: Some("teacher@example.test".to_owned()),
        display_name: Some("School Nurse".to_owned()),
        plan_usage_notice_acknowledged: true,
    }
}

pub(super) fn credential() -> CredentialRecord {
    CredentialRecord {
        access_token: SecretToken::new("old-access"),
        refresh_token: Some(SecretToken::new("old-refresh")),
        id_token: SecretToken::new("old-id"),
        token_type: "Bearer".to_owned(),
        expires_in: 3600,
        earliest_refresh_at: None,
        granted_scopes: vec![DIRECT_PLAN_SCOPE.to_owned()],
        saved_at: 1,
    }
}
