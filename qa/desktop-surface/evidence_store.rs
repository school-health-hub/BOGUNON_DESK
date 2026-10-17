use crate::{evidence_approval::ApprovedPaths, evidence_paths, evidence_record::Record};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    os::windows::fs::OpenOptionsExt,
};

#[derive(Debug, PartialEq, Eq)]
pub enum SaveError {
    Serialize,
    Write,
    Verify,
    Publish,
}

pub trait Publication {
    fn encode(&mut self, record: &Record) -> Result<Vec<u8>, SaveError> {
        let bytes = serde_json::to_vec(record).map_err(|_| SaveError::Serialize)?;
        crate::evidence_schema::decode(&bytes).map_err(|_| SaveError::Serialize)?;
        Ok(bytes)
    }
    fn stage_verified(&mut self, bytes: &[u8]) -> Result<(), SaveError>;
    fn publish(&mut self) -> Result<(), SaveError>;
}
pub fn save(publication: &mut impl Publication, record: &Record) -> Result<(), SaveError> {
    let bytes = publication.encode(record)?;
    if bytes.len() > 16384 {
        return Err(SaveError::Serialize);
    }
    publication.stage_verified(&bytes)?;
    publication.publish()
}

pub struct EvidenceSink {
    paths: ApprovedPaths,
    file: Option<File>,
    _guards: Vec<File>,
}
impl EvidenceSink {
    pub fn open(paths: ApprovedPaths) -> Result<Self, ()> {
        let guards = evidence_paths::lock_directories(&paths.output)?;
        for path in [&paths.output, &paths.staging] {
            match fs::symlink_metadata(path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Ok(_) | Err(_) => return Err(()),
            }
        }
        Ok(Self {
            paths,
            file: None,
            _guards: guards,
        })
    }

    #[cfg(all(feature = "live-windows-skip-miri", not(test)))]
    pub fn from_environment(_: &crate::gate::LivePermit) -> Result<Self, ()> {
        use std::path::Path;
        let descriptor = std::env::var_os("BOGUNON_SURFACE_EVIDENCE_APPROVAL").ok_or(())?;
        let runtime = std::env::var_os("BOGUNON_SURFACE_APPROVED_MANIFEST").ok_or(())?;
        let descriptor = Path::new(&descriptor);
        let runtime = Path::new(&runtime);
        let mut guards = evidence_paths::lock_directories(descriptor)?;
        guards.extend(evidence_paths::lock_directories(runtime)?);
        let (descriptor_file, text) = evidence_paths::read_locked(descriptor)?;
        let (runtime_file, runtime_bytes) = evidence_paths::read_locked(runtime)?;
        let paths = crate::evidence_approval::parse(&text, &runtime_bytes, descriptor)?;
        let mut sink = Self::open(paths)?;
        guards.extend([descriptor_file, runtime_file]);
        sink._guards.extend(guards);
        Ok(sink)
    }
}
impl Publication for EvidenceSink {
    fn stage_verified(&mut self, bytes: &[u8]) -> Result<(), SaveError> {
        if self.file.is_some() {
            return Err(SaveError::Write);
        }
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .share_mode(1)
            .open(&self.paths.staging)
            .map_err(|_| SaveError::Write)?;
        self.file = Some(file);
        let file = self.file.as_mut().ok_or(SaveError::Write)?;
        file.write_all(bytes).map_err(|_| SaveError::Write)?;
        file.flush().map_err(|_| SaveError::Write)?;
        file.sync_all().map_err(|_| SaveError::Write)?;
        file.seek(SeekFrom::Start(0))
            .map_err(|_| SaveError::Verify)?;
        let mut actual = Vec::new();
        file.take(16385)
            .read_to_end(&mut actual)
            .map_err(|_| SaveError::Verify)?;
        if actual != bytes {
            return Err(SaveError::Verify);
        }
        Ok(())
    }
    fn publish(&mut self) -> Result<(), SaveError> {
        if self.file.is_none() {
            return Err(SaveError::Publish);
        }
        fs::hard_link(&self.paths.staging, &self.paths.output).map_err(|_| SaveError::Publish)
    }
}
