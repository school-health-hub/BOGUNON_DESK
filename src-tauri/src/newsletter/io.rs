use std::{
    fs,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use atomic_write_file::AtomicWriteFile;

use super::{error::RepositoryError, model::ProjectDocument, validation::parse_document};

pub(super) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), RepositoryError> {
    let parent = path.parent().ok_or(RepositoryError::Unavailable)?;
    fs::create_dir_all(parent).map_err(|_| RepositoryError::Unavailable)?;
    let mut file = AtomicWriteFile::open(path).map_err(|_| RepositoryError::Unavailable)?;
    file.write_all(bytes)
        .map_err(|_| RepositoryError::Unavailable)?;
    file.flush().map_err(|_| RepositoryError::Unavailable)?;
    file.as_file()
        .sync_all()
        .map_err(|_| RepositoryError::Unavailable)?;
    file.commit().map_err(|_| RepositoryError::Unavailable)
}

pub(super) fn read_document(path: &Path) -> Result<ProjectDocument, RepositoryError> {
    let bytes = fs::read(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            RepositoryError::NotFound
        } else {
            RepositoryError::Unavailable
        }
    })?;
    let value = serde_json::from_slice(&bytes).map_err(|_| RepositoryError::Corrupted)?;
    parse_document(value).map_err(|error| match error {
        RepositoryError::UnsupportedVersion => RepositoryError::UnsupportedVersion,
        RepositoryError::InvalidProject
        | RepositoryError::NotFound
        | RepositoryError::Conflict
        | RepositoryError::Corrupted
        | RepositoryError::Unavailable => RepositoryError::Corrupted,
    })
}

pub(super) fn quarantine_copy(source: &Path, quarantine: &Path) -> Result<(), RepositoryError> {
    fs::create_dir_all(quarantine).map_err(|_| RepositoryError::Unavailable)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| RepositoryError::Unavailable)?
        .as_nanos();
    let destination = quarantine.join(format!("corrupt-{nonce}.json"));
    fs::copy(source, destination).map_err(|_| RepositoryError::Unavailable)?;
    Ok(())
}

pub(super) fn quarantine_move(source: &Path, quarantine: &Path) -> Result<(), RepositoryError> {
    fs::create_dir_all(quarantine).map_err(|_| RepositoryError::Unavailable)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| RepositoryError::Unavailable)?
        .as_nanos();
    fs::rename(source, quarantine.join(format!("prepared-{nonce}.json")))
        .map_err(|_| RepositoryError::Unavailable)
}
