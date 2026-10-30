use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum SaveError {
    Stage,
    Validation,
    Commit,
    Cleanup,
}

impl std::fmt::Display for SaveError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Stage => "ODT 임시 파일을 만들거나 기록하지 못했습니다.",
            Self::Validation => "ODT 임시 파일 검증에 실패했습니다.",
            Self::Commit => {
                "ODT 파일을 안전하게 저장하지 못했습니다. 기존 파일은 변경하지 않았습니다."
            }
            Self::Cleanup => {
                "ODT 저장 실패 후 임시 파일 정리에 실패했습니다. 기존 파일은 변경하지 않았습니다."
            }
        })
    }
}

impl std::error::Error for SaveError {}

pub(crate) trait Committer {
    fn commit(&self, destination: &Path, bytes: &[u8]) -> Result<(), SaveError>;
}

pub(crate) trait Stager {
    fn stage(&self, parent: &Path, bytes: &[u8]) -> Result<Vec<u8>, SaveError>;
}

pub(crate) trait Replacer {
    fn replace(&self, staged: &Path, destination: &Path) -> Result<(), SaveError>;
    fn cleanup_staged(&self, staged: &Path) -> Result<(), SaveError>;
}

pub(crate) struct SavePolicy<S, V, C> {
    pub(crate) stager: S,
    pub(crate) validate: V,
    pub(crate) committer: C,
}

pub(crate) struct FilesystemStager;
pub(crate) struct SystemReplacer;
pub(crate) struct PlatformAtomicCommitter<R = SystemReplacer> {
    replacer: R,
}

impl Stager for FilesystemStager {
    fn stage(&self, parent: &Path, bytes: &[u8]) -> Result<Vec<u8>, SaveError> {
        let mut staged = tempfile::NamedTempFile::new_in(parent).map_err(|_| SaveError::Stage)?;
        staged.write_all(bytes).map_err(|_| SaveError::Stage)?;
        staged.flush().map_err(|_| SaveError::Stage)?;
        staged.as_file().sync_all().map_err(|_| SaveError::Stage)?;
        fs::read(staged.path()).map_err(|_| SaveError::Stage)
    }
}

impl Replacer for SystemReplacer {
    fn replace(&self, staged: &Path, destination: &Path) -> Result<(), SaveError> {
        replace_file(staged, destination)
    }

    fn cleanup_staged(&self, staged: &Path) -> Result<(), SaveError> {
        fs::remove_file(staged).map_err(|_| SaveError::Cleanup)
    }
}

impl PlatformAtomicCommitter {
    pub(crate) const fn new() -> Self {
        Self {
            replacer: SystemReplacer,
        }
    }
}

#[cfg(test)]
impl<R> PlatformAtomicCommitter<R> {
    pub(crate) const fn with_replacer(replacer: R) -> Self {
        Self { replacer }
    }
}

impl<R: Replacer> Committer for PlatformAtomicCommitter<R> {
    fn commit(&self, destination: &Path, bytes: &[u8]) -> Result<(), SaveError> {
        let parent = destination.parent().ok_or(SaveError::Commit)?;
        let staged = persisted_temp_file(parent, bytes)?;
        match self.replacer.replace(&staged, destination) {
            Ok(()) => Ok(()),
            Err(_) => self
                .replacer
                .cleanup_staged(&staged)
                .and(Err(SaveError::Commit)),
        }
    }
}

fn persisted_temp_file(parent: &Path, bytes: &[u8]) -> Result<PathBuf, SaveError> {
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|_| SaveError::Commit)?;
    file.write_all(bytes).map_err(|_| SaveError::Commit)?;
    file.flush().map_err(|_| SaveError::Commit)?;
    file.as_file().sync_all().map_err(|_| SaveError::Commit)?;
    let (handle, path) = file.keep().map_err(|_| SaveError::Commit)?;
    drop(handle);
    Ok(path)
}

#[cfg(windows)]
fn replace_file(staged: &Path, destination: &Path) -> Result<(), SaveError> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, destination: *const u16, flags: u32) -> i32;
    }

    let existing = staged
        .as_os_str()
        .encode_wide()
        .chain([0])
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain([0])
        .collect::<Vec<_>>();
    if existing[..existing.len() - 1].contains(&0)
        || destination[..destination.len() - 1].contains(&0)
    {
        return Err(SaveError::Commit);
    }

    // SAFETY: [Category 8 — FFI boundary]
    // Both pointers reference live, NUL-terminated UTF-16 buffers for the duration of the call.
    // MoveFileExW does not retain either pointer. Flags request same-volume replacement and a
    // write-through flush; Windows reports failure without consuming the staged path.
    let replaced = unsafe {
        MoveFileExW(
            existing.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    (replaced != 0).then_some(()).ok_or(SaveError::Commit)
}

#[cfg(not(windows))]
fn replace_file(staged: &Path, destination: &Path) -> Result<(), SaveError> {
    fs::rename(staged, destination).map_err(|_| SaveError::Commit)
}

pub(crate) fn replace_validated(
    destination: &Path,
    bytes: &[u8],
    policy: SavePolicy<impl Stager, impl FnOnce(&[u8]) -> Result<(), SaveError>, impl Committer>,
) -> Result<(), SaveError> {
    let parent = destination.parent().ok_or(SaveError::Stage)?;
    let staged_bytes = policy.stager.stage(parent, bytes)?;
    (policy.validate)(&staged_bytes)?;
    policy.committer.commit(destination, &staged_bytes)
}
