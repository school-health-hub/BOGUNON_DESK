use std::{collections::VecDeque, sync::Mutex};

use serde::Serialize;
use serde_json::json;

use super::*;
use crate::chatgpt::{
    http::{HttpResponse, TransportError},
    test_support::{EphemeralRsaKeyPair, TEST_KEY_ID},
};

#[path = "tests/revocation.rs"]
mod revocation;
#[path = "tests/validation.rs"]
mod validation;

struct FakeTransport {
    replies: Mutex<VecDeque<Result<HttpResponse, TransportError>>>,
    requests: Mutex<Vec<(HttpMethod, String, Vec<(String, String)>)>>,
}

impl FakeTransport {
    fn new(replies: Vec<Result<HttpResponse, TransportError>>) -> Self {
        Self {
            replies: Mutex::new(replies.into()),
            requests: Mutex::new(Vec::new()),
        }
    }

    fn requests(&self) -> Vec<(HttpMethod, String, Vec<(String, String)>)> {
        self.requests.lock().expect("request lock").clone()
    }
}

impl HttpTransport for FakeTransport {
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
        self.replies
            .lock()
            .expect("reply lock")
            .pop_front()
            .expect("fixture response")
    }
}

fn response(status: u16, body: serde_json::Value) -> Result<HttpResponse, TransportError> {
    Ok(HttpResponse::new(
        status,
        serde_json::to_vec(&body).expect("fixture JSON"),
    ))
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
struct FixtureClaims<'a> {
    iss: &'a str,
    aud: &'a str,
    sub: &'a str,
    exp: u64,
    nonce: &'a str,
    email: &'a str,
    name: &'a str,
}

fn id_token(
    key_pair: &EphemeralRsaKeyPair,
    overrides: impl FnOnce(&mut FixtureClaims<'_>),
) -> String {
    let mut claims = FixtureClaims {
        iss: "https://auth.openai.com",
        aud: "oaiapp_fixture",
        sub: "subject-123",
        exp: 4_102_444_800,
        nonce: "nonce-sentinel",
        email: "person@example.test",
        name: "Test Person",
    };
    overrides(&mut claims);
    key_pair.sign_rs256(TEST_KEY_ID, &claims)
}

#[test]
fn exchange_chain_uses_discovery_jwks_and_authoritative_scopes() {
    tauri::async_runtime::block_on(async {
        // Given a discovery -> token -> JWKS chain with an optional refresh boundary.
        let key_pair = EphemeralRsaKeyPair::generate();
        let jwt = id_token(&key_pair, |_| {});
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            response(
                200,
                json!({
                    "access_token": "access-sentinel", "refresh_token": "refresh-sentinel",
                    "id_token": jwt, "token_type": "Bearer", "expires_in": 3600,
                    "earliest_refresh_at": 1_900_000_000,
                    "scope": "openid chatgpt.tokens.use.direct"
                }),
            ),
            response(200, key_pair.jwks()),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When the code is exchanged and the ID token is validated.
        let result = OidcClient::new(&transport)
            .exchange_and_validate(TokenExchangeRequest {
                client_id: &client_id,
                code: &AuthorizationCode::new("code-sentinel"),
                verifier: &PkceVerifier::new("verifier-sentinel"),
                redirect_uri: "http://127.0.0.1:43123/auth/callback",
                nonce: &OAuthNonce::new("nonce-sentinel"),
                saved_at: 1_800_000_000,
            })
            .await
            .expect("valid chain");

        // Then identity and later-refresh fields survive, and direct plan use is scope-driven.
        assert_eq!(result.identity.subject, "subject-123");
        assert!(result.credential.plan_usage_enabled());
        assert_eq!(result.credential.earliest_refresh_at, Some(1_900_000_000));
        let requests = transport.requests();
        assert_eq!(requests[0].1, DISCOVERY_URL);
        assert_eq!(
            requests[2].1,
            "https://auth.openai.com/.well-known/jwks.json"
        );
        assert_eq!(
            requests[1].2,
            vec![
                ("grant_type".to_owned(), "authorization_code".to_owned()),
                ("client_id".to_owned(), "oaiapp_fixture".to_owned()),
                ("code".to_owned(), "code-sentinel".to_owned()),
                ("code_verifier".to_owned(), "verifier-sentinel".to_owned()),
                (
                    "redirect_uri".to_owned(),
                    "http://127.0.0.1:43123/auth/callback".to_owned()
                ),
                ("resource".to_owned(), OPENAI_RESOURCE.to_owned()),
            ]
        );
        assert!(!requests[1].2.iter().any(|(key, _)| key == "client_secret"));
    });
}

#[test]
fn missing_direct_scope_keeps_identity_but_disables_plan_usage() {
    tauri::async_runtime::block_on(async {
        // Given a valid identity with only ordinary OIDC scopes.
        let key_pair = EphemeralRsaKeyPair::generate();
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            response(
                200,
                json!({
                    "access_token": "access-sentinel", "id_token": id_token(&key_pair, |_| {}),
                    "token_type": "Bearer", "expires_in": 3600, "scope": "openid profile"
                }),
            ),
            response(200, key_pair.jwks()),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When the chain succeeds.
        let result = OidcClient::new(&transport)
            .exchange_and_validate(TokenExchangeRequest {
                client_id: &client_id,
                code: &AuthorizationCode::new("code-sentinel"),
                verifier: &PkceVerifier::new("verifier-sentinel"),
                redirect_uri: "http://127.0.0.1:43123/auth/callback",
                nonce: &OAuthNonce::new("nonce-sentinel"),
                saved_at: 1_800_000_000,
            })
            .await
            .expect("identity remains valid");

        // Then the token response scope, not ID-token validity, disables plan usage.
        assert_eq!(result.identity.subject, "subject-123");
        assert!(!result.credential.plan_usage_enabled());
    });
}

#[test]
fn malformed_token_response_is_rejected_without_provider_body_exposure() {
    tauri::async_runtime::block_on(async {
        // Given a provider response with a non-bearer token type and a sentinel body.
        let key_pair = EphemeralRsaKeyPair::generate();
        let transport = FakeTransport::new(vec![
            response(200, discovery()),
            response(
                200,
                json!({
                    "access_token": "access-sentinel", "id_token": id_token(&key_pair, |_| {}),
                    "token_type": "provider-sentinel", "expires_in": 3600,
                    "scope": ["openid", "chatgpt.tokens.use.direct"]
                }),
            ),
        ]);
        let client_id = IssuedClientId::parse("oaiapp_fixture").expect("issued ID");

        // When the response crosses the token boundary.
        let error = match OidcClient::new(&transport)
            .exchange_and_validate(TokenExchangeRequest {
                client_id: &client_id,
                code: &AuthorizationCode::new("code-sentinel"),
                verifier: &PkceVerifier::new("verifier-sentinel"),
                redirect_uri: "http://127.0.0.1:43123/auth/callback",
                nonce: &OAuthNonce::new("nonce-sentinel"),
                saved_at: 1_800_000_000,
            })
            .await
        {
            Ok(_) => panic!("malformed response must fail"),
            Err(error) => error,
        };

        // Then only a stable sanitized error leaves the boundary.
        assert_eq!(error, OidcError::InvalidTokenResponse);
        assert!(!error.to_string().contains("sentinel"));
    });
}
