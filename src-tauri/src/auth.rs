use std::{
    collections::BTreeMap,
    fmt, fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::Deserialize;
use tauri::{AppHandle, Manager, State, Url};
use tauri_plugin_opener::OpenerExt;

const SESSION_FILE: &str = "auth-session.bin";
const PRODUCTION_SUPABASE_CONFIG: &str = include_str!("../../config/production-supabase.json");

#[derive(Deserialize)]
struct ProductionSupabaseConfig {
    origin: String,
}

pub struct SecureSessionState(Mutex<()>);

impl Default for SecureSessionState {
    fn default() -> Self {
        Self(Mutex::new(()))
    }
}

#[derive(Debug)]
enum AuthStorageError {
    InvalidKey,
    InvalidOAuthUrl,
    StorageUnavailable,
    StorageCorrupted,
    Io,
}

impl fmt::Display for AuthStorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidKey => formatter.write_str("인증 저장소 키가 올바르지 않습니다."),
            Self::InvalidOAuthUrl => formatter.write_str("Google 로그인 주소가 올바르지 않습니다."),
            Self::StorageUnavailable => {
                formatter.write_str("Windows 보안 저장소를 사용할 수 없습니다.")
            }
            Self::StorageCorrupted => {
                formatter.write_str("저장된 로그인 정보를 읽을 수 없습니다. 다시 로그인해 주세요.")
            }
            Self::Io => formatter.write_str("로그인 정보를 저장하지 못했습니다."),
        }
    }
}

fn session_path(app: &AppHandle) -> Result<PathBuf, AuthStorageError> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join(SESSION_FILE))
        .map_err(|_| AuthStorageError::StorageUnavailable)
}

fn valid_storage_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 512
        && key.starts_with("sb-")
        && key.contains("-auth-token")
        && key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b':' | b'_' | b'-'))
}

fn valid_oauth_flow_id(value: &str) -> bool {
    (8..=64).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

fn valid_redirect_target(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    let mut query = url.query_pairs();
    let has_valid_flow_id = query
        .next()
        .is_some_and(|(key, value)| key == "sb_flow_id" && valid_oauth_flow_id(&value));
    url.scheme() == "school-health-desk"
        && url.host_str() == Some("auth")
        && url.path() == "/callback"
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && has_valid_flow_id
        && query.next().is_none()
}

fn parse_oauth_url(value: &str) -> Result<Url, AuthStorageError> {
    let url = Url::parse(value).map_err(|_| AuthStorageError::InvalidOAuthUrl)?;
    let production_config: ProductionSupabaseConfig =
        serde_json::from_str(PRODUCTION_SUPABASE_CONFIG)
            .map_err(|_| AuthStorageError::InvalidOAuthUrl)?;
    let expected_origin =
        Url::parse(&production_config.origin).map_err(|_| AuthStorageError::InvalidOAuthUrl)?;
    let has_expected_origin = url.origin() == expected_origin.origin();
    let has_google_provider = url
        .query_pairs()
        .any(|(key, value)| key == "provider" && value == "google");
    let has_expected_redirect = url
        .query_pairs()
        .any(|(key, value)| key == "redirect_to" && valid_redirect_target(&value));
    if url.scheme() != "https"
        || !has_expected_origin
        || url.path() != "/auth/v1/authorize"
        || !has_google_provider
        || !has_expected_redirect
    {
        return Err(AuthStorageError::InvalidOAuthUrl);
    }
    Ok(url)
}

#[cfg(windows)]
fn protect(data: &[u8]) -> Result<Vec<u8>, AuthStorageError> {
    windows_dpapi::encrypt_data(data, windows_dpapi::Scope::User, None)
        .map_err(|_| AuthStorageError::StorageUnavailable)
}

#[cfg(windows)]
fn unprotect(data: &[u8]) -> Result<Vec<u8>, AuthStorageError> {
    windows_dpapi::decrypt_data(data, windows_dpapi::Scope::User, None)
        .map_err(|_| AuthStorageError::StorageCorrupted)
}

#[cfg(not(windows))]
fn protect(_data: &[u8]) -> Result<Vec<u8>, AuthStorageError> {
    Err(AuthStorageError::StorageUnavailable)
}

#[cfg(not(windows))]
fn unprotect(_data: &[u8]) -> Result<Vec<u8>, AuthStorageError> {
    Err(AuthStorageError::StorageUnavailable)
}

fn read_entries(path: &Path) -> Result<BTreeMap<String, String>, AuthStorageError> {
    let encrypted = match fs::read(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(BTreeMap::new()),
        Err(_) => return Err(AuthStorageError::Io),
    };
    let plaintext = unprotect(&encrypted)?;
    serde_json::from_slice(&plaintext).map_err(|_| AuthStorageError::StorageCorrupted)
}

fn read_entries_for_update(path: &Path) -> Result<BTreeMap<String, String>, AuthStorageError> {
    match read_entries(path) {
        Ok(entries) => Ok(entries),
        Err(AuthStorageError::StorageCorrupted) => Ok(BTreeMap::new()),
        Err(error) => Err(error),
    }
}

fn write_entries(path: &Path, entries: &BTreeMap<String, String>) -> Result<(), AuthStorageError> {
    if entries.is_empty() {
        return match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(AuthStorageError::Io),
        };
    }

    let parent = path.parent().ok_or(AuthStorageError::Io)?;
    fs::create_dir_all(parent).map_err(|_| AuthStorageError::Io)?;
    let serialized = serde_json::to_vec(entries).map_err(|_| AuthStorageError::Io)?;
    let encrypted = protect(&serialized)?;
    fs::write(path, encrypted).map_err(|_| AuthStorageError::Io)
}

#[tauri::command]
pub fn open_auth_url(app: AppHandle, url: String) -> Result<(), String> {
    let target = parse_oauth_url(&url).map_err(|error| error.to_string())?;
    app.opener()
        .open_url(target.as_str(), None::<&str>)
        .map_err(|_| "Windows 기본 브라우저를 열지 못했습니다.".to_owned())
}

#[tauri::command]
pub fn secure_session_get(
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
) -> Result<Option<String>, String> {
    if !valid_storage_key(&key) {
        return Err(AuthStorageError::InvalidKey.to_string());
    }
    let _guard = state
        .0
        .lock()
        .map_err(|_| AuthStorageError::StorageUnavailable.to_string())?;
    let entries = read_entries(&session_path(&app).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    Ok(entries.get(&key).cloned())
}

#[tauri::command]
pub fn secure_session_set(
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
    value: String,
) -> Result<(), String> {
    if !valid_storage_key(&key) {
        return Err(AuthStorageError::InvalidKey.to_string());
    }
    let _guard = state
        .0
        .lock()
        .map_err(|_| AuthStorageError::StorageUnavailable.to_string())?;
    let path = session_path(&app).map_err(|error| error.to_string())?;
    let mut entries = read_entries_for_update(&path).map_err(|error| error.to_string())?;
    entries.insert(key, value);
    write_entries(&path, &entries).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn secure_session_remove(
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
) -> Result<(), String> {
    if !valid_storage_key(&key) {
        return Err(AuthStorageError::InvalidKey.to_string());
    }
    let _guard = state
        .0
        .lock()
        .map_err(|_| AuthStorageError::StorageUnavailable.to_string())?;
    let path = session_path(&app).map_err(|error| error.to_string())?;
    let mut entries = read_entries_for_update(&path).map_err(|error| error.to_string())?;
    entries.remove(&key);
    write_entries(&path, &entries).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn secure_session_clear(
    app: AppHandle,
    state: State<'_, SecureSessionState>,
) -> Result<(), String> {
    let _guard = state
        .0
        .lock()
        .map_err(|_| AuthStorageError::StorageUnavailable.to_string())?;
    write_entries(
        &session_path(&app).map_err(|error| error.to_string())?,
        &BTreeMap::new(),
    )
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests;
