use super::{authorization_client, next_registration, state_from_records, ChatGptLifecycleError};
use crate::chatgpt::model::{
    AuthorizationClient, ChatGptConnectionStatus, CredentialRecord, IssuedClientId,
    RegistrationRecord, SecretToken, ValidatedIdentity,
};

fn issued(value: &str) -> IssuedClientId {
    IssuedClientId::parse(value).expect("valid issued client id")
}

fn registration(subject: &str) -> RegistrationRecord {
    RegistrationRecord {
        issued_client_id: issued("oaiapp_existing"),
        issuer: "https://auth.openai.com".to_owned(),
        subject: subject.to_owned(),
        email: Some("teacher@example.test".to_owned()),
        display_name: Some("Teacher".to_owned()),
        plan_usage_notice_acknowledged: false,
    }
}

fn identity(subject: &str) -> ValidatedIdentity {
    ValidatedIdentity {
        issuer: "https://auth.openai.com".to_owned(),
        subject: subject.to_owned(),
        email: Some("new@example.test".to_owned()),
        display_name: Some("New Name".to_owned()),
    }
}

fn credential(scopes: &[&str]) -> CredentialRecord {
    CredentialRecord {
        access_token: SecretToken::new("redacted-access"),
        refresh_token: Some(SecretToken::new("redacted-refresh")),
        id_token: SecretToken::new("redacted-id"),
        token_type: "Bearer".to_owned(),
        expires_in: 3600,
        earliest_refresh_at: Some(1234),
        granted_scopes: scopes.iter().map(|scope| (*scope).to_owned()).collect(),
        saved_at: 99,
    }
}

#[test]
fn uses_dynamic_client_when_registration_is_absent() {
    let client = authorization_client(None);

    assert!(matches!(client, AuthorizationClient::Dynamic));
}

#[test]
fn uses_issued_client_when_registration_exists() {
    let record = registration("sub-1");
    let client = authorization_client(Some(&record));

    match client {
        AuthorizationClient::Issued(client_id) => {
            assert_eq!(client_id.as_str(), "oaiapp_existing");
        }
        AuthorizationClient::Dynamic => panic!("expected issued client"),
    }
}

#[test]
fn preserves_registration_notice_acknowledgement_when_subject_matches() {
    let mut existing = registration("sub-1");
    existing.plan_usage_notice_acknowledged = true;
    let next = next_registration(
        Some(&existing),
        issued("oaiapp_returning"),
        &identity("sub-1"),
    )
    .expect("matching subject");

    assert_eq!(next.issued_client_id.as_str(), "oaiapp_returning");
    assert_eq!(next.subject, "sub-1");
    assert!(next.plan_usage_notice_acknowledged);
    assert_eq!(next.email.as_deref(), Some("new@example.test"));
}

#[test]
fn rejects_returning_sign_in_when_subject_differs() {
    let existing = registration("sub-1");
    let error = match next_registration(
        Some(&existing),
        issued("oaiapp_returning"),
        &identity("sub-2"),
    ) {
        Ok(_) => panic!("expected subject mismatch"),
        Err(error) => error,
    };

    assert!(matches!(error, ChatGptLifecycleError::SubjectMismatch));
    assert_eq!(
        error.to_string(),
        "이 PC에 등록된 ChatGPT 계정과 다른 계정입니다."
    );
}

#[test]
fn state_dto_never_serializes_tokens() {
    let state = state_from_records(
        Some(&registration("sub-1")),
        Some(&credential(&[
            "openid",
            "profile",
            "chatgpt.tokens.use.direct",
        ])),
        None,
    );
    let serialized = serde_json::to_string(&state).expect("serialize dto");

    assert_eq!(state.status, ChatGptConnectionStatus::Connected);
    assert!(state.plan_usage_enabled);
    assert!(!serialized.contains("redacted-access"));
    assert!(!serialized.contains("redacted-refresh"));
    assert!(!serialized.contains("redacted-id"));
}

#[test]
fn missing_direct_plan_scope_keeps_connection_with_plan_usage_disabled() {
    let state = state_from_records(
        Some(&registration("sub-1")),
        Some(&credential(&["openid", "profile", "email"])),
        None,
    );

    assert_eq!(state.status, ChatGptConnectionStatus::Connected);
    assert!(!state.plan_usage_enabled);
    assert!(state.notice.is_some());
}
