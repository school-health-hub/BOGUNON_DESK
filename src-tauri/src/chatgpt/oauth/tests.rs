use std::collections::HashMap;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use sha2::{Digest as _, Sha256};

use super::{prepare_authorization, OAuthParameters};
use crate::chatgpt::model::{AuthorizationClient, IssuedClientId, DYNAMIC_CLIENT_ID};

const AUTHORIZE_ENDPOINT: &str = "https://auth.openai.com/api/accounts/authorize";
const HOST_ID: &str = "urn:uuid:6b30c832-a704-47cb-8bca-1f820f164f5d";

fn query(url: &str) -> HashMap<String, String> {
    reqwest::Url::parse(url)
        .expect("authorization URL must parse")
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect()
}

#[test]
fn creates_fresh_pkce_state_and_nonce_for_each_attempt() {
    // Given two OAuth attempts
    let first = OAuthParameters::generate().expect("first parameters");

    // When another attempt is generated
    let second = OAuthParameters::generate().expect("second parameters");

    // Then all secret values are fresh and satisfy the PKCE contract
    assert_ne!(first.state().expose(), second.state().expose());
    assert_ne!(first.nonce().expose(), second.nonce().expose());
    assert_ne!(first.verifier().expose(), second.verifier().expose());
    assert_eq!(first.state().expose().len(), 43);
    assert_eq!(first.nonce().expose().len(), 43);
    assert_eq!(first.verifier().expose().len(), 43);
    let expected = URL_SAFE_NO_PAD.encode(Sha256::digest(first.verifier().expose().as_bytes()));
    assert_eq!(first.challenge().expose(), expected);
}

#[test]
fn builds_first_registration_url_with_dynamic_client_and_agent_hint() {
    // Given a first-registration attempt
    let pending = prepare_authorization(AuthorizationClient::Dynamic, HOST_ID, AUTHORIZE_ENDPOINT)
        .expect("first registration preparation");

    // When the authorization URL is inspected
    let values = query(pending.authorization_url());

    // Then it contains the complete first-registration contract
    assert_eq!(
        values.get("client_id").map(String::as_str),
        Some(DYNAMIC_CLIENT_ID)
    );
    assert_eq!(
        values.get("agent_name_hint").map(String::as_str),
        Some("BOGUNON DESK")
    );
    assert_eq!(
        values.get("ext_agent_host_id").map(String::as_str),
        Some(HOST_ID)
    );
    assert_eq!(
        values.get("redirect_uri").map(String::as_str),
        Some(pending.redirect_uri())
    );
    assert_eq!(
        values.get("response_type").map(String::as_str),
        Some("code")
    );
    assert_eq!(
        values.get("resource").map(String::as_str),
        Some("https://api.openai.com/v1")
    );
    assert_eq!(
        values.get("code_challenge_method").map(String::as_str),
        Some("S256")
    );
    assert_eq!(
        values.get("scope").map(String::as_str),
        Some("openid profile email offline_access resource.invoke chatgpt.tokens.use.direct")
    );
    assert!(!pending.redirect_uri().contains("localhost"));
    assert!(pending.redirect_uri().starts_with("http://127.0.0.1:"));
    assert!(pending.redirect_uri().ends_with("/auth/callback"));
}

#[test]
fn builds_returning_url_with_issued_client_and_without_agent_hint() {
    // Given a returning registration
    let client = IssuedClientId::parse("oaiapp_existing-client").expect("issued client");

    // When authorization is prepared
    let pending = prepare_authorization(
        AuthorizationClient::Issued(client),
        HOST_ID,
        AUTHORIZE_ENDPOINT,
    )
    .expect("returning preparation");
    let values = query(pending.authorization_url());

    // Then the issued client and stable host are used without the registration hint
    assert_eq!(
        values.get("client_id").map(String::as_str),
        Some("oaiapp_existing-client")
    );
    assert_eq!(
        values.get("ext_agent_host_id").map(String::as_str),
        Some(HOST_ID)
    );
    assert!(!values.contains_key("agent_name_hint"));
}

#[test]
fn binds_loopback_listener_before_authorization_can_be_opened() {
    // Given a prepared authorization
    let pending = prepare_authorization(AuthorizationClient::Dynamic, HOST_ID, AUTHORIZE_ENDPOINT)
        .expect("preparation");
    let address = pending.listener_address();

    // When a browser-equivalent client connects immediately
    let connection = std::net::TcpStream::connect(address);

    // Then the listener was already bound
    assert!(connection.is_ok());
}
