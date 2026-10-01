use super::*;

const ACCESS_SENTINEL: &str = "access-sentinel";
const REFRESH_SENTINEL: &str = "refresh-sentinel";
const ID_SENTINEL: &str = "id-sentinel";

fn credential() -> CredentialRecord {
    CredentialRecord {
        access_token: SecretToken::new(ACCESS_SENTINEL),
        refresh_token: Some(SecretToken::new(REFRESH_SENTINEL)),
        id_token: SecretToken::new(ID_SENTINEL),
        token_type: "Bearer".to_owned(),
        expires_in: 3_600,
        earliest_refresh_at: Some(1_700_000_100),
        granted_scopes: vec!["openid".to_owned(), DIRECT_PLAN_SCOPE.to_owned()],
        saved_at: 1_700_000_000,
    }
}

#[test]
fn frontend_dto_omits_credentials_when_connected() {
    // Given
    let registration = RegistrationRecord {
        issued_client_id: IssuedClientId::parse("oaiapp_public-client")
            .expect("valid issued client id"),
        issuer: "https://auth.openai.com".to_owned(),
        subject: "validated-subject".to_owned(),
        email: Some("person@example.test".to_owned()),
        display_name: Some("School Nurse".to_owned()),
        plan_usage_notice_acknowledged: false,
    };
    let credential = credential();
    let _callback_code = AuthorizationCode::new("code-sentinel");
    let _pkce_verifier = PkceVerifier::new("verifier-sentinel");

    // When
    let serialized = serde_json::to_string(&ChatGptConnectionStateDto::connected(
        &registration,
        &credential,
    ))
    .expect("DTO serialization should succeed");

    // Then
    for sentinel in [
        ACCESS_SENTINEL,
        REFRESH_SENTINEL,
        ID_SENTINEL,
        "code-sentinel",
        "verifier-sentinel",
    ] {
        assert!(
            !serialized.contains(sentinel),
            "DTO leaked a secret sentinel"
        );
    }
}

#[test]
fn credential_storage_round_trip_preserves_refresh_rotation_fields() {
    // Given
    let original = credential();

    // When
    let encoded = original
        .to_storage_json()
        .expect("storage serialization should succeed");
    let restored = CredentialRecord::from_storage_json(&encoded)
        .expect("storage deserialization should succeed");

    // Then
    assert_eq!(restored.earliest_refresh_at, Some(1_700_000_100));
    assert_eq!(
        restored.refresh_token.as_ref().map(SecretToken::expose),
        Some(REFRESH_SENTINEL)
    );
    assert_eq!(restored.granted_scopes, &["openid", DIRECT_PLAN_SCOPE]);
}

#[test]
fn credential_storage_round_trip_accepts_rotated_refresh_token() {
    // Given
    let mut rotated = credential();
    rotated.refresh_token = Some(SecretToken::new("rotated-refresh-sentinel"));

    // When
    let encoded = rotated
        .to_storage_json()
        .expect("storage serialization should succeed");
    let restored = CredentialRecord::from_storage_json(&encoded)
        .expect("storage deserialization should succeed");

    // Then
    assert_eq!(
        restored.refresh_token.as_ref().map(SecretToken::expose),
        Some("rotated-refresh-sentinel")
    );
}

#[test]
fn issued_client_id_rejects_dynamic_or_malformed_values() {
    // Given / When / Then
    for malformed in [
        "dynamic_agent_client",
        "oaiapp_",
        "oaiapp_contains whitespace",
        "client_oaiapp_wrong-prefix",
    ] {
        assert!(IssuedClientId::parse(malformed).is_err());
    }
    assert!(serde_json::from_str::<IssuedClientId>(r#""dynamic_agent_client""#).is_err());
    assert!(IssuedClientId::parse("oaiapp_public-client_123").is_ok());
}

#[test]
fn missing_direct_plan_scope_disables_plan_usage() {
    // Given
    let credential = CredentialRecord {
        access_token: SecretToken::new(ACCESS_SENTINEL),
        refresh_token: None,
        id_token: SecretToken::new(ID_SENTINEL),
        token_type: "Bearer".to_owned(),
        expires_in: 3_600,
        earliest_refresh_at: None,
        granted_scopes: vec!["openid".to_owned(), "profile".to_owned()],
        saved_at: 1_700_000_000,
    };

    // When
    let enabled = credential.plan_usage_enabled();

    // Then
    assert!(!enabled);
}
