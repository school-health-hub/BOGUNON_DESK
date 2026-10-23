//! Device-local reference packages only. No account, credential, finance, or cloud stores.
use atomic_write_file::AtomicWriteFile;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

const MAX_PACKAGE_BYTES: usize = 5 * 1024 * 1024;
const MAX_STORED_BYTES: usize = MAX_PACKAGE_BYTES + 256;
const STORAGE_ERROR: &str =
    "참고자료 로컬 저장소를 처리하지 못했습니다. 기존 자료는 임의로 삭제하지 않습니다.";
const INTEGRITY_ERROR: &str =
    "저장된 참고자료의 무결성을 확인하지 못했습니다. 다시 가져오거나 저장본을 삭제하세요.";
static ACCESS: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredPackage {
    version: u8,
    sha256: String,
    payload: serde_json::Value,
}

fn digest(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn safe_entry(path: &Path, directory: bool) -> Result<(), &'static str> {
    match fs::symlink_metadata(path) {
        Ok(metadata)
            if !is_reparse_point(&metadata)
                && if directory {
                    metadata.is_dir()
                } else {
                    metadata.is_file()
                } =>
        {
            Ok(())
        }
        Ok(_) => Err(STORAGE_ERROR),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(STORAGE_ERROR),
    }
}

fn package_path(root: &Path) -> Result<PathBuf, &'static str> {
    safe_entry(root, true)?;
    let path = root.join("package.json");
    safe_entry(&path, false)?;
    Ok(path)
}

fn read_at(root: &Path) -> Result<Option<String>, &'static str> {
    let path = package_path(root)?;
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(STORAGE_ERROR),
    };
    let mut bytes = Vec::new();
    file.take((MAX_STORED_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| STORAGE_ERROR)?;
    if bytes.len() > MAX_STORED_BYTES {
        return Err(INTEGRITY_ERROR);
    }
    let stored: StoredPackage = serde_json::from_slice(&bytes).map_err(|_| INTEGRITY_ERROR)?;
    let payload = serde_json::to_string(&stored.payload).map_err(|_| INTEGRITY_ERROR)?;
    if stored.version != 1
        || payload.len() > MAX_PACKAGE_BYTES
        || digest(payload.as_bytes()) != stored.sha256
    {
        return Err(INTEGRITY_ERROR);
    }
    Ok(Some(payload))
}

fn write_at(root: &Path, payload: &str) -> Result<(), &'static str> {
    if payload.len() > MAX_PACKAGE_BYTES {
        return Err(STORAGE_ERROR);
    }
    let value: serde_json::Value = serde_json::from_str(payload).map_err(|_| STORAGE_ERROR)?;
    let canonical = serde_json::to_vec(&value).map_err(|_| STORAGE_ERROR)?;
    let stored = StoredPackage {
        version: 1,
        sha256: digest(&canonical),
        payload: value,
    };
    let bytes = serde_json::to_vec(&stored).map_err(|_| STORAGE_ERROR)?;
    if bytes.len() > MAX_STORED_BYTES {
        return Err(STORAGE_ERROR);
    }
    let path = package_path(root)?;
    fs::create_dir_all(root).map_err(|_| STORAGE_ERROR)?;
    let mut file = AtomicWriteFile::open(path).map_err(|_| STORAGE_ERROR)?;
    file.write_all(&bytes).map_err(|_| STORAGE_ERROR)?;
    file.commit().map_err(|_| STORAGE_ERROR)
}

fn remove_at(root: &Path) -> Result<(), &'static str> {
    let path = package_path(root)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(STORAGE_ERROR),
    }
}

fn root(app: &AppHandle) -> Result<PathBuf, &'static str> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("official-document-references"))
        .map_err(|_| STORAGE_ERROR)
}

#[tauri::command]
pub fn read_official_reference_package(app: AppHandle) -> Result<Option<String>, String> {
    let _access = ACCESS.lock().map_err(|_| STORAGE_ERROR.to_owned())?;
    read_at(&root(&app)?).map_err(str::to_owned)
}

#[tauri::command]
pub fn write_official_reference_package(app: AppHandle, payload: String) -> Result<(), String> {
    let _access = ACCESS.lock().map_err(|_| STORAGE_ERROR.to_owned())?;
    write_at(&root(&app)?, &payload).map_err(str::to_owned)
}

#[tauri::command]
pub fn remove_official_reference_package(app: AppHandle) -> Result<(), String> {
    let _access = ACCESS.lock().map_err(|_| STORAGE_ERROR.to_owned())?;
    remove_at(&root(&app)?).map_err(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejected_replacement_preserves_existing_package() {
        let dir = tempfile::tempdir().unwrap();
        write_at(dir.path(), "{\"fixture\":\"synthetic\"}").unwrap();
        let original = fs::read(dir.path().join("package.json")).unwrap();
        assert!(write_at(dir.path(), "not json").is_err());
        assert_eq!(fs::read(dir.path().join("package.json")).unwrap(), original);
    }

    #[test]
    fn verifies_integrity_before_returning_saved_content() {
        let dir = tempfile::tempdir().unwrap();
        write_at(dir.path(), "{\"fixture\":\"synthetic\"}").unwrap();
        assert_eq!(
            read_at(dir.path()).unwrap(),
            Some("{\"fixture\":\"synthetic\"}".to_owned())
        );
        fs::write(
            dir.path().join("package.json"),
            "{\"version\":1,\"sha256\":\"wrong\",\"payload\":{}}",
        )
        .unwrap();
        assert!(read_at(dir.path()).is_err());
    }

    #[test]
    fn deletion_only_removes_owned_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("unrelated.json"), "synthetic").unwrap();
        write_at(dir.path(), "{}").unwrap();
        remove_at(dir.path()).unwrap();
        assert_eq!(read_at(dir.path()).unwrap(), None);
        assert!(dir.path().join("unrelated.json").exists());
    }
}
