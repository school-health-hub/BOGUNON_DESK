#[path = "tests/fixtures.rs"]
mod fixtures;
#[path = "tests/transport.rs"]
mod transport;

use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

use uuid::Uuid;

use super::*;
use crate::chatgpt::{
    http::DISCOVERY_URL,
    model::{ChatGptConnectionStatus, DIRECT_PLAN_SCOPE},
    storage::{ByteProtector, ChatGptStorage, StorageError},
};
use fixtures::{credential, registration, CallbackOpener, MemoryStorage};
use transport::{form_value, FakeTransport};

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("bogunon-chatgpt-lifecycle-{}", Uuid::new_v4()));
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

#[test]
fn dynamic_sign_in_stores_registration_before_token_free_state() {
    tauri::async_runtime::block_on(async {
        let storage = MemoryStorage::empty();
        let opener = CallbackOpener::new(Some("oaiapp_lifecycle"));
        let transport = FakeTransport::new(&opener, "subject-123", DIRECT_PLAN_SCOPE);

        let state = sign_in(SignInEnvironment::new(
            &storage,
            &transport,
            &opener,
            Duration::from_secs(2),
            123,
        ))
        .await
        .expect("sign-in");

        assert_eq!(state.status, ChatGptConnectionStatus::Connected);
        assert!(state.plan_usage_enabled);
        assert!(!serde_json::to_string(&state)
            .expect("state JSON")
            .contains("access-sentinel"));
        let registration = storage
            .load_registration()
            .expect("registration")
            .expect("saved registration");
        assert_eq!(registration.issued_client_id.as_str(), "oaiapp_lifecycle");
        assert_eq!(registration.subject, "subject-123");
        let opened = opener.opened_urls.lock().expect("opened URL lock");
        assert!(opened[0].contains("client_id=dynamic_agent_client"));
        assert!(opened[0].contains("agent_name_hint=BOGUNON+DESK"));
        assert!(opened[0].contains("ext_agent_host_id=urn%3Auuid%3A"));
    });
}

#[test]
fn returning_sign_in_rejects_subject_mismatch_without_overwrite() {
    tauri::async_runtime::block_on(async {
        let storage = MemoryStorage::with_registration(registration("subject-123"), credential());
        let opener = CallbackOpener::new(None);
        let transport = FakeTransport::new(&opener, "other-subject", DIRECT_PLAN_SCOPE);

        let error = sign_in(SignInEnvironment::new(
            &storage,
            &transport,
            &opener,
            Duration::from_secs(2),
            123,
        ))
        .await
        .expect_err("subject mismatch");

        assert_eq!(
            error.to_string(),
            "이 PC에 등록된 ChatGPT 계정과 다른 계정입니다."
        );
        let registration = storage
            .load_registration()
            .expect("registration")
            .expect("existing registration");
        assert_eq!(registration.subject, "subject-123");
        let credential = storage
            .load_credential()
            .expect("credential")
            .expect("existing credential");
        assert_eq!(credential.access_token.expose(), "old-access");
        let opened = opener.opened_urls.lock().expect("opened URL lock");
        assert!(opened[0].contains("client_id=oaiapp_lifecycle"));
        assert!(!opened[0].contains("agent_name_hint"));
    });
}

#[test]
fn disconnect_revokes_first_then_clears_only_credential() {
    tauri::async_runtime::block_on(async {
        let storage = MemoryStorage::with_registration(registration("subject-123"), credential());
        let opener = CallbackOpener::new(None);
        let transport = FakeTransport::with_revoke_failures(&opener);

        let state = disconnect(&storage, &transport).await.expect("disconnect");

        assert_eq!(state.status, ChatGptConnectionStatus::Disconnected);
        assert!(state.client_registration_exists);
        assert!(state.notice.is_some());
        assert!(storage.load_credential().expect("credential").is_none());
        assert_eq!(
            storage
                .load_registration()
                .expect("registration")
                .expect("saved registration")
                .subject,
            "subject-123"
        );
        let requests = transport.requests();
        assert_eq!(requests[0].1, DISCOVERY_URL);
        assert_eq!(
            requests[1].1,
            "https://auth.openai.com/api/accounts/oauth/revoke"
        );
        assert_eq!(
            requests[2].1,
            "https://auth.openai.com/api/accounts/oauth/revoke"
        );
        assert_eq!(form_value(&requests[1].2, "client_id"), "oaiapp_lifecycle");
        assert_eq!(
            form_value(&requests[1].2, "token_type_hint"),
            "refresh_token"
        );
    });
}

#[test]
fn disconnect_clears_corrupt_credential_and_returns_sanitized_notice() {
    tauri::async_runtime::block_on(async {
        // Given
        let directory = TestDirectory::new();
        let storage = ChatGptStorage::new(directory.path(), FakeProtector);
        storage
            .save_registration(&registration("subject-123"))
            .expect("registration should save");
        let credential_path = directory.path().join("chatgpt-auth.bin");
        fs::write(&credential_path, b"refresh-token-sentinel-corrupt")
            .expect("corrupt credential should save");
        let opener = CallbackOpener::new(None);
        let transport = FakeTransport::new(&opener, "subject-123", DIRECT_PLAN_SCOPE);

        // When
        let state = disconnect(&storage, &transport)
            .await
            .expect("disconnect should clear unreadable credential");

        // Then
        assert_eq!(state.status, ChatGptConnectionStatus::Disconnected);
        assert!(state.client_registration_exists);
        let notice = state.notice.expect("remote revocation notice");
        assert_eq!(notice.code, ChatGptNoticeCode::RemoteRevocationFailed);
        assert!(!notice.message.contains("refresh-token-sentinel"));
        assert!(!credential_path.exists());
        assert_eq!(
            storage
                .load_registration()
                .expect("registration should load")
                .expect("registration should remain")
                .subject,
            "subject-123"
        );
        assert!(transport.requests().is_empty());
    });
}
