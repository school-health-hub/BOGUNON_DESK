use std::{
    fs,
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::{ByteProtector, ChatGptStorage, DpapiProtector, StorageError};
use crate::chatgpt::model::{CredentialRecord, IssuedClientId, RegistrationRecord, SecretToken};

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bogunon-chatgpt-storage-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("test directory should be created");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[derive(Clone, Copy)]
struct FakeProtector;

impl ByteProtector for FakeProtector {
    fn protect(&self, plaintext: &[u8]) -> Result<Vec<u8>, StorageError> {
        let mut protected = b"fake-protected:".to_vec();
        protected.extend_from_slice(plaintext);
        Ok(protected)
    }

    fn unprotect(&self, protected: &[u8]) -> Result<Vec<u8>, StorageError> {
        protected
            .strip_prefix(b"fake-protected:")
            .map(<[u8]>::to_vec)
            .ok_or(StorageError::Corrupted)
    }
}

fn registration() -> RegistrationRecord {
    RegistrationRecord {
        issued_client_id: IssuedClientId::parse("oaiapp_storage-test")
            .expect("fixture client id should be valid"),
        issuer: "https://auth.openai.com".to_owned(),
        subject: "subject-fixture".to_owned(),
        email: Some("school@example.test".to_owned()),
        display_name: Some("School Nurse".to_owned()),
        plan_usage_notice_acknowledged: true,
    }
}

fn credential() -> CredentialRecord {
    CredentialRecord {
        access_token: SecretToken::new("access-sentinel"),
        refresh_token: Some(SecretToken::new("refresh-sentinel")),
        id_token: SecretToken::new("id-sentinel"),
        token_type: "Bearer".to_owned(),
        expires_in: 3_600,
        earliest_refresh_at: Some(1_700_000_100),
        granted_scopes: vec!["openid".to_owned(), "chatgpt.tokens.use.direct".to_owned()],
        saved_at: 1_700_000_000,
    }
}

fn hash(path: &Path) -> Vec<u8> {
    Sha256::digest(fs::read(path).expect("fixture file should be readable")).to_vec()
}

#[test]
fn stable_host_is_reused_when_file_is_valid() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);

    // When
    let first = storage
        .load_or_create_host()
        .expect("host should be generated");
    let second = storage.load_or_create_host().expect("host should reload");

    // Then
    assert_eq!(first, second);
    let uuid = first
        .ext_agent_host_id
        .strip_prefix("urn:uuid:")
        .and_then(|value| Uuid::parse_str(value).ok())
        .expect("host id should use urn:uuid UUID syntax");
    assert_eq!(uuid.get_version_num(), 4);
    let plaintext = fs::read_to_string(directory.path().join("chatgpt-host.json"))
        .expect("host file should be readable JSON");
    assert!(plaintext.contains(&first.ext_agent_host_id));
}

#[test]
fn malformed_host_is_replaced_with_a_new_opaque_uuid() {
    // Given
    let directory = TestDirectory::new();
    fs::write(
        directory.path().join("chatgpt-host.json"),
        br#"{"extAgentHostId":"email@example.test"}"#,
    )
    .expect("malformed fixture should be written");
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);

    // When
    let host = storage
        .load_or_create_host()
        .expect("malformed host should be regenerated");

    // Then
    assert!(host.ext_agent_host_id.starts_with("urn:uuid:"));
    assert!(!host.ext_agent_host_id.contains('@'));
}

#[test]
fn registration_round_trip_uses_an_independent_protected_file() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);
    let expected = registration();

    // When
    storage
        .save_registration(&expected)
        .expect("registration should save");
    let actual = storage
        .load_registration()
        .expect("registration should load")
        .expect("registration should exist");

    // Then
    assert!(actual == expected);
    let bytes = fs::read(directory.path().join("chatgpt-registration.bin"))
        .expect("registration file should exist");
    assert!(bytes.starts_with(b"fake-protected:"));
    assert!(!directory.path().join("chatgpt-auth.bin").exists());
}

#[test]
fn credential_round_trip_preserves_refresh_rotation_fields() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);
    let expected = credential();

    // When
    storage
        .save_credential(&expected)
        .expect("credential should save");
    let actual = storage
        .load_credential()
        .expect("credential should load")
        .expect("credential should exist");

    // Then
    assert_eq!(actual.access_token.expose(), expected.access_token.expose());
    assert_eq!(
        actual.refresh_token.as_ref().map(|token| token.expose()),
        expected.refresh_token.as_ref().map(|token| token.expose())
    );
    assert_eq!(actual.id_token.expose(), expected.id_token.expose());
    assert_eq!(actual.earliest_refresh_at, Some(1_700_000_100));
    assert_eq!(actual.granted_scopes, expected.granted_scopes);
}

#[test]
fn clearing_credential_preserves_host_registration_and_supabase_session() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);
    storage.load_or_create_host().expect("host should save");
    storage
        .save_registration(&registration())
        .expect("registration should save");
    storage
        .save_credential(&credential())
        .expect("credential should save");
    let supabase_path = directory.path().join("auth-session.bin");
    fs::write(&supabase_path, b"supabase-session-sentinel").expect("Supabase fixture should save");
    let host_hash = hash(&directory.path().join("chatgpt-host.json"));
    let registration_hash = hash(&directory.path().join("chatgpt-registration.bin"));
    let supabase_hash = hash(&supabase_path);

    // When
    storage
        .clear_credential()
        .expect("credential clear should succeed");

    // Then
    assert!(!directory.path().join("chatgpt-auth.bin").exists());
    assert_eq!(hash(&directory.path().join("chatgpt-host.json")), host_hash);
    assert_eq!(
        hash(&directory.path().join("chatgpt-registration.bin")),
        registration_hash
    );
    assert_eq!(hash(&supabase_path), supabase_hash);
}

#[test]
fn corrupted_credential_returns_sanitized_error_and_preserves_siblings() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);
    storage.load_or_create_host().expect("host should save");
    storage
        .save_registration(&registration())
        .expect("registration should save");
    let supabase_path = directory.path().join("auth-session.bin");
    fs::write(&supabase_path, b"supabase-session-sentinel").expect("Supabase fixture should save");
    fs::write(
        directory.path().join("chatgpt-auth.bin"),
        b"refresh-sentinel-corrupt",
    )
    .expect("corrupt fixture should save");
    let registration_hash = hash(&directory.path().join("chatgpt-registration.bin"));
    let supabase_hash = hash(&supabase_path);

    // When
    let error = match storage.load_credential() {
        Ok(_) => panic!("corrupt credential should fail"),
        Err(error) => error,
    };

    // Then
    let message = error.to_string();
    assert!(!message.contains("refresh-sentinel"));
    assert!(directory.path().join("chatgpt-auth.bin").exists());
    assert_eq!(
        hash(&directory.path().join("chatgpt-registration.bin")),
        registration_hash
    );
    assert_eq!(hash(&supabase_path), supabase_hash);
}

#[test]
fn stale_unrelated_temp_file_does_not_block_atomic_replacement() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), FakeProtector);
    storage
        .save_registration(&registration())
        .expect("initial registration should save");
    fs::write(
        directory.path().join(".chatgpt-registration.bin.stale.tmp"),
        b"stale",
    )
    .expect("stale temp fixture should save");
    let mut replacement = registration();
    replacement.display_name = Some("Replacement".to_owned());

    // When
    storage
        .save_registration(&replacement)
        .expect("replacement should commit atomically");

    // Then
    let actual = storage
        .load_registration()
        .expect("registration should load");
    assert!(actual == Some(replacement));
}

#[cfg(windows)]
#[test]
fn windows_dpapi_user_scope_round_trip_preserves_credential() {
    // Given
    let directory = TestDirectory::new();
    let storage = ChatGptStorage::new(directory.path(), DpapiProtector);
    let expected = credential();
    let expected_registration = registration();

    // When
    storage
        .save_registration(&expected_registration)
        .expect("DPAPI registration should save");
    storage
        .save_credential(&expected)
        .expect("DPAPI credential should save");
    let actual = storage
        .load_credential()
        .expect("DPAPI credential should load")
        .expect("DPAPI credential should exist");

    // Then
    assert_eq!(actual.access_token.expose(), expected.access_token.expose());
    assert_eq!(actual.id_token.expose(), expected.id_token.expose());
    let actual_registration = storage
        .load_registration()
        .expect("DPAPI registration should load");
    assert!(actual_registration == Some(expected_registration));
    let protected = fs::read(directory.path().join("chatgpt-auth.bin"))
        .expect("DPAPI credential file should be readable");
    assert!(!protected
        .windows(b"access-sentinel".len())
        .any(|window| window == b"access-sentinel"));
}
