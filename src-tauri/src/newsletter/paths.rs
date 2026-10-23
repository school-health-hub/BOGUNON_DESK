use super::error::RepositoryError;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(super) struct RepositoryPaths {
    root: PathBuf,
}
pub(super) struct ProjectPaths {
    pub(super) directory: PathBuf,
    pub(super) current: PathBuf,
    pub(super) last_known_good: PathBuf,
    pub(super) revisions: PathBuf,
    pub(super) quarantine: PathBuf,
}

impl RepositoryPaths {
    pub(super) fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
        }
    }
    pub(super) fn project(&self, project_id: &str) -> Result<ProjectPaths, RepositoryError> {
        let directory = self.root.join("projects").join(project_id);
        self.ensure_safe_directory(&directory)?;
        Ok(ProjectPaths {
            current: directory.join("current.json"),
            last_known_good: directory.join("last-known-good.json"),
            revisions: directory.join("revisions"),
            quarantine: directory.join("quarantine"),
            directory,
        })
    }
    pub(super) fn ensure_safe_directory(&self, directory: &Path) -> Result<(), RepositoryError> {
        if !directory.starts_with(&self.root) {
            return Err(RepositoryError::Unavailable);
        }
        if !self.root.exists() {
            return Ok(());
        }
        reject_link(&self.root)?;
        let canonical_root =
            fs::canonicalize(&self.root).map_err(|_| RepositoryError::Unavailable)?;
        for candidate in [self.root.join("projects"), directory.to_path_buf()] {
            if candidate.exists() {
                reject_link(&candidate)?;
                let canonical =
                    fs::canonicalize(candidate).map_err(|_| RepositoryError::Unavailable)?;
                if !canonical.starts_with(&canonical_root) {
                    return Err(RepositoryError::Unavailable);
                }
            }
        }
        if directory.exists() {
            inspect_tree(directory, &canonical_root)?;
        }
        Ok(())
    }
}

fn inspect_tree(directory: &Path, canonical_root: &Path) -> Result<(), RepositoryError> {
    for entry in fs::read_dir(directory).map_err(|_| RepositoryError::Unavailable)? {
        let path = entry.map_err(|_| RepositoryError::Unavailable)?.path();
        reject_link(&path)?;
        let canonical = fs::canonicalize(&path).map_err(|_| RepositoryError::Unavailable)?;
        if !canonical.starts_with(canonical_root) {
            return Err(RepositoryError::Unavailable);
        }
        if path.is_dir() {
            inspect_tree(&path, canonical_root)?;
        }
    }
    Ok(())
}

fn reject_link(path: &Path) -> Result<(), RepositoryError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| RepositoryError::Unavailable)?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        Err(RepositoryError::Unavailable)
    } else {
        Ok(())
    }
}
#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}
#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
