use super::{
    lifecycle,
    model::{ChatGptConnectionStateDto, CredentialRecord, HostRecord, RegistrationRecord},
    storage::{ChatGptCredentialStorage, DefaultChatGptStorage, DpapiProtector, StorageError},
};
use std::path::Path;

pub(crate) struct ReadOnlyStorage(DefaultChatGptStorage);
impl ReadOnlyStorage {
    pub(crate) fn new(production_root: &Path) -> Self {
        Self(DefaultChatGptStorage::new(production_root, DpapiProtector))
    }
    pub(crate) fn connection_state(&self) -> Result<ChatGptConnectionStateDto, String> {
        lifecycle::connection_state(self, false, None).map_err(|error| error.to_string())
    }
}
impl ChatGptCredentialStorage for ReadOnlyStorage {
    fn load_or_create_host(&self) -> Result<HostRecord, StorageError> {
        Err(StorageError::Unavailable)
    }
    fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError> {
        self.0.load_registration()
    }
    fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError> {
        self.0.load_credential()
    }
    fn save_registration(&self, _: &RegistrationRecord) -> Result<(), StorageError> {
        Err(StorageError::Unavailable)
    }
    fn save_credential(&self, _: &CredentialRecord) -> Result<(), StorageError> {
        Err(StorageError::Unavailable)
    }
    fn clear_credential(&self) -> Result<(), StorageError> {
        Err(StorageError::Unavailable)
    }
}
