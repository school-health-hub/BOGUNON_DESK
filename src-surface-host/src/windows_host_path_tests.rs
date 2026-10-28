use std::{
    error::Error,
    ffi::OsStr,
    fs,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use super::{resolve_surface_bundle_mapping, webview_mapping_path, HostError};
use crate::windows_host::wide;

#[test]
fn converts_verbatim_local_drive_path_for_webview_mapping() -> Result<(), HostError> {
    // Given
    let canonical = Path::new(r"\\?\C:\surface\bundle");

    // When
    let mapping = webview_mapping_path(canonical);

    // Then
    assert_eq!(mapping?, Path::new(r"C:\surface\bundle"));
    Ok(())
}

#[test]
fn converts_verbatim_unc_path_for_webview_mapping() -> Result<(), HostError> {
    // Given
    let canonical = Path::new(r"\\?\UNC\server\share\surface\bundle");

    // When
    let mapping = webview_mapping_path(canonical);

    // Then
    assert_eq!(mapping?, Path::new(r"\\server\share\surface\bundle"));
    Ok(())
}

#[test]
fn preserves_ordinary_local_drive_absolute_path() -> Result<(), HostError> {
    // Given
    let ordinary = Path::new(r"C:\surface\bundle");

    // When
    let mapping = webview_mapping_path(ordinary);

    // Then
    assert_eq!(mapping?, ordinary);
    Ok(())
}

#[test]
fn preserves_ordinary_unc_absolute_path() -> Result<(), HostError> {
    // Given
    let ordinary = Path::new(r"\\server\share\surface\bundle");

    // When
    let mapping = webview_mapping_path(ordinary);

    // Then
    assert_eq!(mapping?, ordinary);
    Ok(())
}

#[test]
fn preserves_non_ascii_path_through_utf16_mapping() -> Result<(), HostError> {
    // Given
    let ordinary = Path::new(r"C:\표면\묶음");

    // When
    let mapping = webview_mapping_path(ordinary)?;
    let encoded = wide(mapping.as_os_str());

    // Then
    let expected = OsStr::new(r"C:\표면\묶음")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    assert_eq!(encoded, expected);
    Ok(())
}

#[test]
fn rejects_relative_mapping_path() {
    // Given
    let relative = Path::new(r"surface\bundle");

    // When
    let result = webview_mapping_path(relative);

    // Then
    assert!(matches!(result, Err(HostError::InvalidMappingPath)));
}

#[test]
fn rejects_non_normalized_absolute_mapping_path() {
    // Given
    let non_normalized = Path::new(r"C:\surface\..\bundle");

    // When
    let result = webview_mapping_path(non_normalized);

    // Then
    assert!(matches!(result, Err(HostError::InvalidMappingPath)));
}

#[test]
fn rejects_unsupported_device_mapping_path() {
    // Given
    let device = Path::new(r"\\.\PIPE\surface");

    // When
    let result = webview_mapping_path(device);

    // Then
    assert!(matches!(result, Err(HostError::InvalidMappingPath)));
}

#[test]
fn rejects_unsupported_verbatim_mapping_path() {
    // Given
    let device = Path::new(r"\\?\GLOBALROOT\Device\HarddiskVolume1\surface");

    // When
    let result = webview_mapping_path(device);

    // Then
    assert!(matches!(result, Err(HostError::InvalidMappingPath)));
}

#[test]
fn keeps_canonical_identity_separate_from_webview_mapping_path() -> Result<(), Box<dyn Error>> {
    // Given
    let fixture = FixtureDirectory::create()?;
    fs::write(fixture.path().join("surface.html"), b"<!doctype html>")?;

    // When
    let resolved = resolve_surface_bundle_mapping(fixture.path())?;

    // Then
    let canonical = fixture.path().canonicalize()?;
    assert_eq!(resolved, webview_mapping_path(&canonical)?);
    Ok(())
}

struct FixtureDirectory(PathBuf);

impl FixtureDirectory {
    fn create() -> Result<Self, Box<dyn Error>> {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let path =
            std::env::temp_dir().join(format!("bogunon-s2h36-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&path)?;
        Ok(Self(path))
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for FixtureDirectory {
    fn drop(&mut self) {
        drop(fs::remove_dir_all(&self.0));
    }
}
