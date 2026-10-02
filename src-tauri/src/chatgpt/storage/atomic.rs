use std::{fs, io::Write, path::Path};

use atomic_write_file::AtomicWriteFile;

use super::StorageError;

pub(crate) trait AtomicFileWriter {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), StorageError>;
}

#[derive(Clone, Copy)]
pub(crate) struct SystemAtomicFileWriter;

impl AtomicFileWriter for SystemAtomicFileWriter {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
        let parent = path.parent().ok_or(StorageError::Io)?;
        fs::create_dir_all(parent).map_err(|_| StorageError::Io)?;
        let mut file = AtomicWriteFile::open(path).map_err(|_| StorageError::Io)?;
        file.write_all(bytes).map_err(|_| StorageError::Io)?;
        file.commit().map_err(|_| StorageError::Io)
    }
}
