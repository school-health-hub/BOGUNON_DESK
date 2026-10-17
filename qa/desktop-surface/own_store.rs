use crate::{
    evidence_paths,
    own_approval::Paths,
    own_result::{Error, Evidence},
};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    os::windows::fs::OpenOptionsExt,
};

pub struct Store {
    paths: Paths,
    guards: Vec<File>,
    staged: Option<File>,
}
impl Store {
    pub fn open(paths: Paths, mut guards: Vec<File>) -> Result<Self, Error> {
        guards.extend(evidence_paths::lock_directories(&paths.output).map_err(|()| Error::Gate)?);
        for path in [&paths.output, &paths.staging, &paths.claim] {
            match fs::symlink_metadata(path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Ok(_) | Err(_) => return Err(Error::Gate),
            }
        }
        Ok(Self {
            paths,
            guards,
            staged: None,
        })
    }
    pub fn claim(&mut self) -> Result<(), Error> {
        let mut claim = OpenOptions::new()
            .write(true)
            .create_new(true)
            .share_mode(1)
            .open(&self.paths.claim)
            .map_err(|_| Error::Gate)?;
        claim
            .write_all(b"9B2O_ONE_PROCESS_ATTEMPT\n")
            .map_err(|_| Error::Gate)?;
        claim.sync_all().map_err(|_| Error::Gate)?;
        self.guards.push(claim);
        Ok(())
    }
    pub fn save(&mut self, record: &Evidence) -> Result<(), Error> {
        let bytes = serde_json::to_vec(record).map_err(|_| Error::Evidence)?;
        let _: Evidence = serde_json::from_slice(&bytes).map_err(|_| Error::Evidence)?;
        if bytes.len() > 16384 || self.staged.is_some() {
            return Err(Error::Evidence);
        }
        self.staged = Some(
            OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .share_mode(1)
                .open(&self.paths.staging)
                .map_err(|_| Error::Evidence)?,
        );
        let file = self.staged.as_mut().ok_or(Error::Evidence)?;
        file.write_all(&bytes).map_err(|_| Error::Evidence)?;
        file.flush().map_err(|_| Error::Evidence)?;
        file.sync_all().map_err(|_| Error::Evidence)?;
        file.seek(SeekFrom::Start(0)).map_err(|_| Error::Evidence)?;
        let mut actual = Vec::new();
        file.take(16385)
            .read_to_end(&mut actual)
            .map_err(|_| Error::Evidence)?;
        if bytes != actual {
            return Err(Error::Evidence);
        }
        fs::hard_link(&self.paths.staging, &self.paths.output).map_err(|_| Error::Evidence)
    }
}
