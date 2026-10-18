//! Approved-path-only, create-new publication. Staging is retained on every failure.
use super::{
    approval,
    evidence::{Evidence, Provenance},
    gate::Attempt,
};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    os::windows::fs::OpenOptionsExt,
};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Binding,
    Paths,
    Duplicate,
    Serialize,
    Staging,
    Write,
    Flush,
    Sync,
    Reread,
    HashMismatch,
    Publish,
}
#[derive(Debug)]
pub struct Stored {
    sha256: String,
}
impl Stored {
    pub fn sha256(&self) -> &str {
        &self.sha256
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Point {
    Write,
    Flush,
    Sync,
    Reread,
    Publish,
}
/// Narrow I/O checkpoint seam; faults never replace the real filesystem operations.
trait Checkpoint {
    fn check(&mut self, point: Point) -> Result<(), Error>;
    fn reread(&mut self, bytes: &mut Vec<u8>);
}
struct Actual;
impl Checkpoint for Actual {
    fn check(&mut self, _: Point) -> Result<(), Error> {
        Ok(())
    }
    fn reread(&mut self, _: &mut Vec<u8>) {}
}
pub struct Store<'a> {
    attempt: &'a Attempt,
    guards: Vec<File>,
    staged: Option<File>,
    attempted: bool,
}
impl<'a> Store<'a> {
    pub fn new(attempt: &'a Attempt) -> Result<Self, Error> {
        let paths = attempt.binding();
        let guards = crate::evidence_paths::lock_directories(&paths.evidence_path)
            .map_err(|()| Error::Paths)?;
        Ok(Self {
            attempt,
            guards,
            staged: None,
            attempted: false,
        })
    }
    pub fn save<P: Provenance>(&mut self, evidence: &Evidence<P>) -> Result<Stored, Error> {
        self.save_checked(evidence, &mut Actual)
    }
    fn save_checked<P: Provenance>(
        &mut self,
        evidence: &Evidence<P>,
        checkpoint: &mut impl Checkpoint,
    ) -> Result<Stored, Error> {
        if self.attempted {
            return Err(Error::Duplicate);
        }
        self.attempted = true;
        if !evidence.matches(self.attempt) {
            return Err(Error::Binding);
        }
        let bytes = serde_json::to_vec(evidence).map_err(|_| Error::Serialize)?;
        if bytes.len() > 16384 {
            return Err(Error::Serialize);
        }
        let paths = self.attempt.binding();
        // Directory handles disallow replacement; the created file denies write/delete sharing.
        if self.guards.is_empty() {
            return Err(Error::Paths);
        }
        self.staged = Some(
            OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .share_mode(1)
                .open(&paths.staging_path)
                .map_err(|_| Error::Staging)?,
        );
        let file = self.staged.as_mut().ok_or(Error::Staging)?;
        checkpoint.check(Point::Write)?;
        file.write_all(&bytes).map_err(|_| Error::Write)?;
        checkpoint.check(Point::Flush)?;
        file.flush().map_err(|_| Error::Flush)?;
        checkpoint.check(Point::Sync)?;
        file.sync_all().map_err(|_| Error::Sync)?;
        checkpoint.check(Point::Reread)?;
        file.seek(SeekFrom::Start(0)).map_err(|_| Error::Reread)?;
        let mut reread = Vec::new();
        file.take(16385)
            .read_to_end(&mut reread)
            .map_err(|_| Error::Reread)?;
        checkpoint.reread(&mut reread);
        let sha256 = approval::digest(&bytes);
        if sha256 != approval::digest(&reread) {
            return Err(Error::HashMismatch);
        }
        checkpoint.check(Point::Publish)?;
        fs::hard_link(&paths.staging_path, &paths.evidence_path).map_err(|_| Error::Publish)?;
        Ok(Stored { sha256 })
    }
}
#[cfg(test)]
#[path = "integrated_store_tests.rs"]
mod tests;
