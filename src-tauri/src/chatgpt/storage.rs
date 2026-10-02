use std::{
    error::Error,
    fmt, fs,
    path::{Path, PathBuf},
};

use uuid::{Uuid, Version};

use super::model::{CredentialRecord, HostRecord, RegistrationRecord};

mod atomic;
mod protector;

use atomic::{AtomicFileWriter, SystemAtomicFileWriter};
pub(crate) use protector::{ByteProtector, DpapiProtector};

const HOST_FILE: &str = "chatgpt-host.json";
const REGISTRATION_FILE: &str = "chatgpt-registration.bin";
const CREDENTIAL_FILE: &str = "chatgpt-auth.bin";

#[derive(Clone)]
pub(crate) struct StoragePaths {
    host: PathBuf,
    registration: PathBuf,
    credential: PathBuf,
}

impl StoragePaths {
    pub(crate) fn for_app_local_data(root: &Path) -> Self {
        Self {
            host: root.join(HOST_FILE),
            registration: root.join(REGISTRATION_FILE),
            credential: root.join(CREDENTIAL_FILE),
        }
    }
}

pub(crate) struct ChatGptStorage<P, W = SystemAtomicFileWriter> {
    paths: StoragePaths,
    protector: P,
    writer: W,
}

pub(crate) type DefaultChatGptStorage = ChatGptStorage<DpapiProtector>;

pub(crate) trait ChatGptCredentialStorage {
    fn load_or_create_host(&self) -> Result<HostRecord, StorageError>;
    fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError>;
    fn save_registration(&self, registration: &RegistrationRecord) -> Result<(), StorageError>;
    fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError>;
    fn save_credential(&self, credential: &CredentialRecord) -> Result<(), StorageError>;
    fn clear_credential(&self) -> Result<(), StorageError>;
}

impl<P> ChatGptStorage<P, SystemAtomicFileWriter>
where
    P: ByteProtector,
{
    pub(crate) fn new(root: &Path, protector: P) -> Self {
        Self::with_writer(
            StoragePaths::for_app_local_data(root),
            protector,
            SystemAtomicFileWriter,
        )
    }
}

impl<P, W> ChatGptStorage<P, W>
where
    P: ByteProtector,
    W: AtomicFileWriter,
{
    pub(crate) const fn with_writer(paths: StoragePaths, protector: P, writer: W) -> Self {
        Self {
            paths,
            protector,
            writer,
        }
    }

    pub(crate) fn load_or_create_host(&self) -> Result<HostRecord, StorageError> {
        match fs::read(&self.paths.host) {
            Ok(bytes) => match serde_json::from_slice::<HostRecord>(&bytes) {
                Ok(host) if valid_host_id(&host.ext_agent_host_id) => Ok(host),
                Ok(_) | Err(_) => self.create_host(),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => self.create_host(),
            Err(_) => Err(StorageError::Io),
        }
    }

    pub(crate) fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError> {
        self.read_protected(&self.paths.registration, |plaintext| {
            serde_json::from_slice(plaintext).map_err(|_| StorageError::Corrupted)
        })
    }

    pub(crate) fn save_registration(
        &self,
        registration: &RegistrationRecord,
    ) -> Result<(), StorageError> {
        let plaintext = serde_json::to_vec(registration).map_err(|_| StorageError::Encoding)?;
        self.write_protected(&self.paths.registration, &plaintext)
    }

    pub(crate) fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError> {
        self.read_protected(&self.paths.credential, |plaintext| {
            CredentialRecord::from_storage_json(plaintext).map_err(|_| StorageError::Corrupted)
        })
    }

    pub(crate) fn save_credential(
        &self,
        credential: &CredentialRecord,
    ) -> Result<(), StorageError> {
        let plaintext = credential
            .to_storage_json()
            .map_err(|_| StorageError::Encoding)?;
        self.write_protected(&self.paths.credential, &plaintext)
    }

    pub(crate) fn clear_credential(&self) -> Result<(), StorageError> {
        match fs::remove_file(&self.paths.credential) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(StorageError::Io),
        }
    }

    fn create_host(&self) -> Result<HostRecord, StorageError> {
        let host = HostRecord {
            ext_agent_host_id: format!("urn:uuid:{}", Uuid::new_v4()),
        };
        let bytes = serde_json::to_vec(&host).map_err(|_| StorageError::Encoding)?;
        self.writer.write(&self.paths.host, &bytes)?;
        Ok(host)
    }

    fn read_protected<T>(
        &self,
        path: &Path,
        decode: impl FnOnce(&[u8]) -> Result<T, StorageError>,
    ) -> Result<Option<T>, StorageError> {
        let protected = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(StorageError::Io),
        };
        let plaintext = self.protector.unprotect(&protected)?;
        decode(&plaintext).map(Some)
    }

    fn write_protected(&self, path: &Path, plaintext: &[u8]) -> Result<(), StorageError> {
        let protected = self.protector.protect(plaintext)?;
        self.writer.write(path, &protected)
    }
}

impl<P, W> ChatGptCredentialStorage for ChatGptStorage<P, W>
where
    P: ByteProtector,
    W: AtomicFileWriter,
{
    fn load_or_create_host(&self) -> Result<HostRecord, StorageError> {
        Self::load_or_create_host(self)
    }

    fn load_registration(&self) -> Result<Option<RegistrationRecord>, StorageError> {
        Self::load_registration(self)
    }

    fn save_registration(&self, registration: &RegistrationRecord) -> Result<(), StorageError> {
        Self::save_registration(self, registration)
    }

    fn load_credential(&self) -> Result<Option<CredentialRecord>, StorageError> {
        Self::load_credential(self)
    }

    fn save_credential(&self, credential: &CredentialRecord) -> Result<(), StorageError> {
        Self::save_credential(self, credential)
    }

    fn clear_credential(&self) -> Result<(), StorageError> {
        Self::clear_credential(self)
    }
}

fn valid_host_id(value: &str) -> bool {
    value
        .strip_prefix("urn:uuid:")
        .and_then(|uuid| Uuid::parse_str(uuid).ok())
        .is_some_and(|uuid| uuid.get_version() == Some(Version::Random))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum StorageError {
    Unavailable,
    Corrupted,
    Encoding,
    Io,
}

impl fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Unavailable => "Windows 보안 저장소를 사용할 수 없습니다.",
            Self::Corrupted => "저장된 ChatGPT 연결 정보를 읽을 수 없습니다.",
            Self::Encoding => "ChatGPT 연결 정보를 저장할 수 없습니다.",
            Self::Io => "ChatGPT 연결 저장소에 접근할 수 없습니다.",
        };
        formatter.write_str(message)
    }
}

impl Error for StorageError {}

#[cfg(test)]
#[path = "storage/tests.rs"]
mod tests;
