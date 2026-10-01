use super::StorageError;

pub(crate) trait ByteProtector: Send + Sync {
    fn protect(&self, plaintext: &[u8]) -> Result<Vec<u8>, StorageError>;
    fn unprotect(&self, protected: &[u8]) -> Result<Vec<u8>, StorageError>;
}

#[derive(Clone, Copy)]
pub(crate) struct DpapiProtector;

#[cfg(windows)]
impl ByteProtector for DpapiProtector {
    fn protect(&self, plaintext: &[u8]) -> Result<Vec<u8>, StorageError> {
        windows_dpapi::encrypt_data(plaintext, windows_dpapi::Scope::User, None)
            .map_err(|_| StorageError::Unavailable)
    }

    fn unprotect(&self, protected: &[u8]) -> Result<Vec<u8>, StorageError> {
        windows_dpapi::decrypt_data(protected, windows_dpapi::Scope::User, None)
            .map_err(|_| StorageError::Corrupted)
    }
}

#[cfg(not(windows))]
impl ByteProtector for DpapiProtector {
    fn protect(&self, _plaintext: &[u8]) -> Result<Vec<u8>, StorageError> {
        Err(StorageError::Unavailable)
    }

    fn unprotect(&self, _protected: &[u8]) -> Result<Vec<u8>, StorageError> {
        Err(StorageError::Unavailable)
    }
}
