//! Portable, password-encrypted MY FINANCE backup envelope.
//! This module does not read files, expose Tauri commands, or access networks.
//! No financial data is persisted until the restore transaction layer exists.
use aes_gcm::{
    aead::{Aead, Payload},
    Aes256Gcm, KeyInit, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};

const MAGIC: &[u8; 8] = b"BGFNBK01";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 8 + SALT_LEN + NONCE_LEN;
const MAX_PLAINTEXT: usize = 64 * 1024 * 1024;
const MAX_BACKUP: usize = MAX_PLAINTEXT + HEADER_LEN + 16;
const MIN_PASSWORD_BYTES: usize = 12;

fn derive_key(password: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; 32], &'static str> {
    // 64 MiB, three iterations, single lane. Parameters are part of v1 format.
    let params = Params::new(64 * 1024, 3, 1, Some(32))
        .map_err(|_| "암호화 매개변수를 초기화하지 못했습니다.")?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; 32];
    argon2.hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| "백업 암호화 키를 생성하지 못했습니다.")?;
    Ok(key)
}

/// Encrypt arbitrary serialized snapshot bytes. Caller must validate the
/// snapshot schema and ensure no unencrypted temporary files are created.
pub(crate) fn seal(plaintext: &[u8], password: &str) -> Result<Vec<u8>, &'static str> {
    if password.as_bytes().len() < MIN_PASSWORD_BYTES {
        return Err("백업 비밀번호는 12바이트 이상이어야 합니다.");
    }
    if plaintext.is_empty() || plaintext.len() > MAX_PLAINTEXT {
        return Err("백업 데이터 크기가 허용 범위를 벗어났습니다.");
    }
    let salt: [u8; SALT_LEN] = rand::random();
    let nonce: [u8; NONCE_LEN] = rand::random();
    let mut key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "암호화를 초기화하지 못했습니다.")?;
    let mut header = Vec::with_capacity(HEADER_LEN);
    header.extend_from_slice(MAGIC);
    header.extend_from_slice(&salt);
    header.extend_from_slice(&nonce);
    let encrypted = cipher.encrypt(
        Nonce::from_slice(&nonce),
        Payload { msg: plaintext, aad: &header },
    );
    key.fill(0);
    let encrypted = encrypted.map_err(|_| "백업 암호화에 실패했습니다.")?;
    header.extend_from_slice(&encrypted);
    Ok(header)
}

/// Authenticates the entire header and payload before returning plaintext.
/// The caller must validate the decoded snapshot schema and version.
pub(crate) fn open(envelope: &[u8], password: &str) -> Result<Vec<u8>, &'static str> {
    if envelope.len() < HEADER_LEN + 16 || envelope.len() > MAX_BACKUP
        || &envelope[..MAGIC.len()] != MAGIC
    {
        return Err("지원하지 않거나 손상된 백업 파일입니다.");
    }
    let salt: [u8; SALT_LEN] = envelope[8..8 + SALT_LEN]
        .try_into().map_err(|_| "백업 형식 오류")?;
    let nonce: [u8; NONCE_LEN] = envelope[8 + SALT_LEN..HEADER_LEN]
        .try_into().map_err(|_| "백업 형식 오류")?;
    let mut key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| "복호화를 초기화하지 못했습니다.")?;
    let decrypted = cipher.decrypt(
        Nonce::from_slice(&nonce),
        Payload { msg: &envelope[HEADER_LEN..], aad: &envelope[..HEADER_LEN] },
    );
    key.fill(0);
    decrypted.map_err(|_| "비밀번호가 틀렸거나 백업 파일이 손상되었습니다.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypted_backup_roundtrip() {
        let input = br#"{"dataset":"local-only","grossKrw":400000}"#;
        let sealed = seal(input, "long-test-password-123").unwrap();
        assert_ne!(sealed, input);
        assert!(!sealed.windows(b"grossKrw".len()).any(|part| part == b"grossKrw"));
        assert_eq!(open(&sealed, "long-test-password-123").unwrap(), input);
    }

    #[test]
    fn wrong_password_and_tampering_are_rejected() {
        let mut sealed = seal(b"private finance data", "long-test-password-123").unwrap();
        assert!(open(&sealed, "another-password-123").is_err());
        sealed[8] ^= 1;
        assert!(open(&sealed, "long-test-password-123").is_err());
    }

    #[test]
    fn truncated_and_unsupported_backups_are_rejected() {
        assert!(open(b"garbage", "long-test-password-123").is_err());
        let mut sealed = seal(b"private finance data", "long-test-password-123").unwrap();
        sealed[0] = b'X';
        assert!(open(&sealed, "long-test-password-123").is_err());
    }

    #[test]
    fn repeated_backups_use_distinct_salt_and_nonce() {
        let a = seal(b"same input", "long-test-password-123").unwrap();
        let b = seal(b"same input", "long-test-password-123").unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn short_password_and_empty_data_are_rejected() {
        assert!(seal(b"data", "short").is_err());
        assert!(seal(b"", "long-test-password-123").is_err());
    }
}
