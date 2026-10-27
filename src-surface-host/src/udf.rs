use std::path::{Component, Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectoryIdentity {
    pub volume: u64,
    pub file: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectoryObservation {
    pub path: PathBuf,
    pub identity: DirectoryIdentity,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum UdfError {
    #[error("path is not an absolute normalized path")]
    InvalidPath,
    #[error("main and surface directories overlap")]
    Overlap,
    #[error("main and surface directories resolve to one identity")]
    SharedIdentity,
    #[error("effective UDF differs from the requested directory")]
    EffectiveMismatch,
    #[error("profile is outside the effective Surface UDF")]
    ProfileOutsideUdf,
    #[error("a WebView2 override is present or cannot be observed")]
    OverrideUntrusted,
    #[error("directory observation could not be resolved")]
    ObservationFailed,
}

/// Verify paths returned by WebView2 against filesystem observations.
pub fn verify_effective_on_disk(
    requested: &DirectoryObservation,
    effective: &DirectoryObservation,
    profile: &Path,
) -> Result<(), UdfError> {
    validate_path(&requested.path)?;
    validate_path(&effective.path)?;
    validate_path(profile)?;
    if key(&requested.path) != key(&effective.path) || requested.identity != effective.identity {
        return Err(UdfError::EffectiveMismatch);
    }
    // Resolve aliases and reparse targets through the same filesystem boundary as
    // the UDF observations. In particular, Windows canonical paths use \\?\ syntax.
    let profile = profile
        .canonicalize()
        .map_err(|_| UdfError::ObservationFailed)?;
    if !profile.is_dir() {
        return Err(UdfError::ObservationFailed);
    }
    verify_effective(requested, effective, &profile)
}

pub fn preflight(
    main: &DirectoryObservation,
    requested: &DirectoryObservation,
    overrides_clear: bool,
) -> Result<(), UdfError> {
    if !overrides_clear {
        return Err(UdfError::OverrideUntrusted);
    }
    validate_path(&main.path)?;
    validate_path(&requested.path)?;
    let main_key = key(&main.path);
    let surface_key = key(&requested.path);
    if main_key.starts_with(&surface_key) || surface_key.starts_with(&main_key) {
        return Err(UdfError::Overlap);
    }
    if main.identity == requested.identity {
        return Err(UdfError::SharedIdentity);
    }
    Ok(())
}

pub fn verify_effective(
    requested: &DirectoryObservation,
    effective: &DirectoryObservation,
    profile: &Path,
) -> Result<(), UdfError> {
    validate_path(&requested.path)?;
    validate_path(&effective.path)?;
    validate_path(profile)?;
    if key(&requested.path) != key(&effective.path) || requested.identity != effective.identity {
        return Err(UdfError::EffectiveMismatch);
    }
    if key(profile) == key(&effective.path) || !key(profile).starts_with(key(&effective.path)) {
        return Err(UdfError::ProfileOutsideUdf);
    }
    Ok(())
}

fn validate_path(path: &Path) -> Result<(), UdfError> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err(UdfError::InvalidPath);
    }
    Ok(())
}

fn key(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().to_lowercase())
}

#[cfg(all(test, windows))]
#[path = "udf_path_tests.rs"]
mod path_tests;

#[cfg(test)]
mod tests {
    use super::*;
    fn observed(path: &str, file: u128) -> DirectoryObservation {
        DirectoryObservation {
            path: PathBuf::from(path),
            identity: DirectoryIdentity { volume: 1, file },
        }
    }
    #[test]
    fn rejects_overlap_alias_override_and_effective_mismatch() {
        let main = observed(r"C:\main", 1);
        let surface = observed(r"C:\surface", 2);
        assert_eq!(preflight(&main, &surface, true), Ok(()));
        assert_eq!(
            preflight(&main, &observed(r"C:\main\nested", 3), true),
            Err(UdfError::Overlap)
        );
        assert_eq!(
            preflight(&main, &observed(r"C:\surface", 1), true),
            Err(UdfError::SharedIdentity)
        );
        assert_eq!(
            preflight(&main, &surface, false),
            Err(UdfError::OverrideUntrusted)
        );
        assert_eq!(
            verify_effective(
                &surface,
                &observed(r"C:\other", 4),
                Path::new(r"C:\other\Default")
            ),
            Err(UdfError::EffectiveMismatch)
        );
    }
    #[test]
    fn accepts_only_a_profile_beneath_the_identical_effective_udf() {
        let requested = observed(r"C:\surface", 2);
        let effective = observed(r"c:\surface", 2);
        assert_eq!(
            verify_effective(&requested, &effective, Path::new(r"C:\surface\Default")),
            Ok(())
        );
        assert_eq!(
            verify_effective(&requested, &effective, Path::new(r"C:\main\Default")),
            Err(UdfError::ProfileOutsideUdf)
        );
    }
}
