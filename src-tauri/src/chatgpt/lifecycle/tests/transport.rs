use std::{collections::VecDeque, sync::Mutex};

use serde::Serialize;
use serde_json::json;

use super::fixtures::CallbackOpener;
use crate::chatgpt::{
    http::{HttpMethod, HttpResponse, HttpTransport, TransportError, DISCOVERY_URL},
    model::DIRECT_PLAN_SCOPE,
    test_support::{EphemeralRsaKeyPair, TEST_KEY_ID},
};

pub(super) struct FakeTransport<'a> {
    opener: &'a CallbackOpener,
    subject: &'static str,
    scopes: &'static str,
    requests: Mutex<Vec<(HttpMethod, String, Vec<(String, String)>)>>,
    revoke_statuses: Mutex<VecDeque<Result<u16, TransportError>>>,
    key_pair: EphemeralRsaKeyPair,
}

impl<'a> FakeTransport<'a> {
    pub(super) fn new(
        opener: &'a CallbackOpener,
        subject: &'static str,
        scopes: &'static str,
    ) -> Self {
        Self {
            opener,
            subject,
            scopes,
            requests: Mutex::new(Vec::new()),
            revoke_statuses: Mutex::new(VecDeque::new()),
            key_pair: EphemeralRsaKeyPair::generate(),
        }
    }

    pub(super) fn with_revoke_failures(opener: &'a CallbackOpener) -> Self {
        Self {
            opener,
            subject: "subject-123",
            scopes: DIRECT_PLAN_SCOPE,
            requests: Mutex::new(Vec::new()),
            revoke_statuses: Mutex::new(VecDeque::from([
                Err(TransportError::Unavailable),
                Ok(500),
            ])),
            key_pair: EphemeralRsaKeyPair::generate(),
        }
    }

    pub(super) fn requests(&self) -> Vec<(HttpMethod, String, Vec<(String, String)>)> {
        self.requests.lock().expect("request lock").clone()
    }

    fn token_response(&self, form: &[(String, String)]) -> serde_json::Value {
        let client_id = form_value(form, "client_id");
        let nonce = self
            .opener
            .nonce
            .lock()
            .expect("nonce lock")
            .clone()
            .expect("nonce captured");
        json!({
            "access_token": "access-sentinel",
            "refresh_token": "refresh-sentinel",
            "id_token": self.id_token(client_id, &nonce),
            "token_type": "Bearer",
            "expires_in": 3600,
            "scope": self.scopes
        })
    }

    fn id_token(&self, audience: &str, nonce: &str) -> String {
        self.key_pair.sign_rs256(
            TEST_KEY_ID,
            &Claims {
                iss: "https://auth.openai.com",
                aud: audience,
                sub: self.subject,
                exp: 4_102_444_800,
                nonce,
                email: "teacher@example.test",
                name: "School Nurse",
            },
        )
    }
}

impl HttpTransport for FakeTransport<'_> {
    async fn send(
        &self,
        method: HttpMethod,
        url: &str,
        form: &[(String, String)],
    ) -> Result<HttpResponse, TransportError> {
        self.requests
            .lock()
            .expect("request lock")
            .push((method, url.to_owned(), form.to_vec()));
        match (method, url) {
            (HttpMethod::Get, DISCOVERY_URL) => Ok(json_response(discovery())),
            (HttpMethod::PostForm, "https://auth.openai.com/api/accounts/oauth/token") => {
                Ok(json_response(self.token_response(form)))
            }
            (HttpMethod::Get, "https://auth.openai.com/.well-known/jwks.json") => {
                Ok(json_response(self.key_pair.jwks()))
            }
            (HttpMethod::PostForm, "https://auth.openai.com/api/accounts/oauth/revoke") => {
                match self
                    .revoke_statuses
                    .lock()
                    .expect("revoke lock")
                    .pop_front()
                    .unwrap_or(Ok(200))
                {
                    Ok(status) => Ok(HttpResponse::new(status, Vec::new())),
                    Err(error) => Err(error),
                }
            }
            _ => Err(TransportError::Unavailable),
        }
    }
}

pub(super) fn form_value<'a>(form: &'a [(String, String)], key: &str) -> &'a str {
    form.iter()
        .find_map(|(name, value)| (name == key).then_some(value.as_str()))
        .expect("form value")
}

fn json_response(body: serde_json::Value) -> HttpResponse {
    HttpResponse::new(200, serde_json::to_vec(&body).expect("fixture JSON"))
}

fn discovery() -> serde_json::Value {
    json!({
        "issuer": "https://auth.openai.com",
        "authorization_endpoint": "https://auth.openai.com/api/accounts/authorize",
        "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
        "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
        "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
    })
}

#[derive(Serialize)]
struct Claims<'a> {
    iss: &'a str,
    aud: &'a str,
    sub: &'a str,
    exp: u64,
    nonce: &'a str,
    email: &'a str,
    name: &'a str,
}
