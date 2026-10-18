use super::approval::{Binding, Error};
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::windows::fs::OpenOptionsExt,
};

pub(super) struct Claim {
    _file: File,
    _directories: Vec<File>,
}
impl Claim {
    pub(super) fn hold(&mut self, guards: Vec<File>) {
        self._directories.extend(guards);
    }
    pub(super) fn create(binding: &Binding) -> Result<Self, Error> {
        let mut directories = Vec::new();
        for path in [
            &binding.claim_path,
            &binding.evidence_path,
            &binding.staging_path,
        ] {
            directories
                .extend(crate::evidence_paths::lock_directories(path).map_err(|()| Error::Path)?);
        }
        for path in [&binding.evidence_path, &binding.staging_path] {
            match std::fs::symlink_metadata(path) {
                Ok(_) => return Err(Error::Path),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => return Err(Error::Path),
            }
        }
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .share_mode(1)
            .open(&binding.claim_path)
            .map_err(create_error)?;
        persist(
            &mut file,
            format!(
                "{}
{}
{}
",
                binding.runner_id, binding.descriptor_sha256, binding.executable_sha256
            )
            .as_bytes(),
        )?;
        Ok(Self {
            _file: file,
            _directories: directories,
        })
    }
}
// No deletion in Drop. Even a failed attempt permanently consumes this approved claim path.

fn create_error(error: std::io::Error) -> Error {
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        Error::ClaimExists
    } else {
        Error::ClaimCreate
    }
}
trait SyncClaim: Write {
    fn sync_claim(&mut self) -> std::io::Result<()>;
}
impl SyncClaim for File {
    fn sync_claim(&mut self) -> std::io::Result<()> {
        self.sync_all()
    }
}
fn persist<W: SyncClaim>(file: &mut W, bytes: &[u8]) -> Result<(), Error> {
    file.write_all(bytes)
        .and_then(|()| file.flush())
        .and_then(|()| file.sync_claim())
        .map_err(|_| Error::ClaimSync)
}
#[cfg(test)]
mod tests {
    use super::*;
    struct FailedSync {
        bytes: Vec<u8>,
    }
    impl Write for FailedSync {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.bytes.extend(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    impl SyncClaim for FailedSync {
        fn sync_claim(&mut self) -> std::io::Result<()> {
            Err(std::io::ErrorKind::Other.into())
        }
    }
    #[test]
    fn claim_create_failure_is_distinct_from_collision() {
        assert_eq!(
            create_error(std::io::ErrorKind::PermissionDenied.into()),
            Error::ClaimCreate
        );
        assert_eq!(
            create_error(std::io::ErrorKind::AlreadyExists.into()),
            Error::ClaimExists
        );
    }
    #[test]
    fn claim_sync_failure_cannot_produce_claim() {
        let mut file = FailedSync { bytes: Vec::new() };
        assert_eq!(persist(&mut file, b"claim"), Err(Error::ClaimSync));
        assert_eq!(file.bytes, b"claim");
    }
}
