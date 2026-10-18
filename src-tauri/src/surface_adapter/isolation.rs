//! Configuration observations only. Registry/policy overrides and effective WebView2 UDF
//! remain unobserved; no filesystem/environment snapshot can issue a runtime permit.
use std::{
    ffi::OsString,
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum IsolationError {
    InvalidPath,
    FilesystemUnknown,
    ReparseAncestor,
    SharedDirectory,
    OverridePresent,
    EnvironmentUnknown,
    EnvironmentChanged,
}

pub(super) struct Configured {
    main: PathBuf,
    surface: PathBuf,
}
impl Configured {
    pub(super) const fn effective_admitted(&self) -> bool {
        false
    }
    pub(super) fn canonical_directories(&self) -> (&Path, &Path) {
        (&self.main, &self.surface)
    }
}

type Environment = Vec<(OsString, OsString)>;

pub(super) fn preflight(main: &Path, surface: &Path) -> Result<Configured, IsolationError> {
    preflight_observed(main, surface, || Ok(std::env::vars_os().collect()))
}

fn preflight_observed(
    main: &Path,
    surface: &Path,
    mut environment: impl FnMut() -> Result<Environment, IsolationError>,
) -> Result<Configured, IsolationError> {
    let before = overrides(environment()?)?;
    if !before.is_empty() {
        return Err(IsolationError::OverridePresent);
    }
    let main = canonical_directory(main)?;
    let surface = canonical_directory(surface)?;
    let main_key = comparison_key(&main)?;
    let surface_key = comparison_key(&surface)?;
    if main_key.starts_with(&surface_key) || surface_key.starts_with(&main_key) {
        return Err(IsolationError::SharedDirectory);
    }
    let after = overrides(environment()?)?;
    if before != after {
        return Err(IsolationError::EnvironmentChanged);
    }
    // Recheck the observed paths, without claiming atomic filesystem stability.
    if canonical_directory(&main)? != main || canonical_directory(&surface)? != surface {
        return Err(IsolationError::FilesystemUnknown);
    }
    Ok(Configured { main, surface })
}

fn overrides(environment: Environment) -> Result<Environment, IsolationError> {
    let mut relevant = Vec::new();
    for (key, value) in environment {
        let key_text = key.to_str().ok_or(IsolationError::EnvironmentUnknown)?;
        if key_text.to_ascii_uppercase().starts_with("WEBVIEW2_") {
            relevant.push((key, value));
        }
    }
    relevant.sort();
    Ok(relevant)
}

fn comparison_key(path: &Path) -> Result<PathBuf, IsolationError> {
    let text = path.to_str().ok_or(IsolationError::InvalidPath)?;
    Ok(PathBuf::from(text.to_lowercase()))
}

fn canonical_directory(path: &Path) -> Result<PathBuf, IsolationError> {
    if !path.is_absolute() || path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(IsolationError::InvalidPath);
    }
    for ancestor in path.ancestors() {
        let metadata =
            fs::symlink_metadata(ancestor).map_err(|_| IsolationError::FilesystemUnknown)?;
        if reparse(&metadata) {
            return Err(IsolationError::ReparseAncestor);
        }
        if !metadata.is_dir() {
            return Err(IsolationError::InvalidPath);
        }
    }
    fs::canonicalize(path).map_err(|_| IsolationError::FilesystemUnknown)
}

#[cfg(windows)]
fn reparse(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    reparse_attributes(metadata.file_attributes())
}
#[cfg(windows)]
const fn reparse_attributes(attributes: u32) -> bool {
    attributes & 0x400 != 0
}
#[cfg(not(windows))]
fn reparse(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(1);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "bogunon-isolation-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&root).unwrap();
            fs::create_dir(root.join("main")).unwrap();
            fs::create_dir(root.join("surface")).unwrap();
            Self(root)
        }
        fn run(&self) -> Result<Configured, IsolationError> {
            preflight_observed(&self.0.join("main"), &self.0.join("surface"), || {
                Ok(Vec::new())
            })
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn separate_existing_directories_are_configuration_not_effective_udf_proof() {
        let fixture = Fixture::new();
        let configured = fixture.run().unwrap();
        assert_ne!(
            configured.canonical_directories().0,
            configured.canonical_directories().1
        );
        assert!(!configured.effective_admitted());
    }
    #[test]
    fn same_and_nested_directories_are_rejected() {
        let fixture = Fixture::new();
        let main = fixture.0.join("main");
        let nested = main.join("nested");
        fs::create_dir(&nested).unwrap();
        for (a, b) in [(&main, &main), (&main, &nested), (&nested, &main)] {
            assert!(matches!(
                preflight_observed(a, b, || Ok(Vec::new())),
                Err(IsolationError::SharedDirectory)
            ));
        }
    }
    #[test]
    fn missing_relative_and_parent_traversal_paths_fail_closed() {
        let fixture = Fixture::new();
        for path in [
            PathBuf::from("relative"),
            fixture.0.join("missing"),
            fixture.0.join("main/../surface"),
        ] {
            assert!(preflight_observed(&fixture.0.join("main"), &path, || Ok(Vec::new())).is_err());
        }
    }
    #[test]
    fn overrides_are_rejected_even_when_empty_or_mixed_case() {
        let fixture = Fixture::new();
        for key in [
            "WEBVIEW2_USER_DATA_FOLDER",
            "WebView2_Additional_Browser_Arguments",
            "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
        ] {
            assert!(matches!(
                preflight_observed(&fixture.0.join("main"), &fixture.0.join("surface"), || Ok(
                    vec![(key.into(), OsString::new())]
                )),
                Err(IsolationError::OverridePresent)
            ));
        }
    }
    #[test]
    fn environment_changes_and_unavailable_snapshots_fail_closed() {
        let fixture = Fixture::new();
        let mut calls = 0;
        let changed =
            preflight_observed(&fixture.0.join("main"), &fixture.0.join("surface"), || {
                calls += 1;
                Ok(if calls == 1 {
                    Vec::new()
                } else {
                    vec![("WEBVIEW2_USER_DATA_FOLDER".into(), "override".into())]
                })
            });
        assert!(matches!(changed, Err(IsolationError::EnvironmentChanged)));
        assert!(matches!(
            preflight_observed(&fixture.0.join("main"), &fixture.0.join("surface"), || Err(
                IsolationError::EnvironmentUnknown
            )),
            Err(IsolationError::EnvironmentUnknown)
        ));
    }
    #[cfg(windows)]
    #[test]
    fn junction_and_symlink_reparse_attributes_fail_closed() {
        assert!(reparse_attributes(0x400));
        assert!(reparse_attributes(0x410));
        assert!(!reparse_attributes(0x10));
    }
    #[test]
    fn component_comparison_avoids_sibling_prefix_false_positive() {
        assert!(!Path::new("root/profile-new").starts_with("root/profile"));
    }
}
