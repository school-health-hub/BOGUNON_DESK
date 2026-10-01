use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "desktop-folder-favorites.json";
const FAVORITES_KEY: &str = "favorites";
const LEGACY_STORE_FILE: &str = "desktop-launchers.json";
const LEGACY_WORK_FOLDER_KEY: &str = "workFolderPath";
const MAX_FAVORITES: usize = 12;
const MAX_NAME_CHARS: usize = 40;
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredWorkFolderFavorite {
    id: String,
    name: String,
    path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkFolderFavorite {
    id: String,
    name: String,
    path: String,
    display_path: String,
    available: bool,
}

fn validate_name(input: &str) -> Result<String, String> {
    let name = input.trim();
    if name.is_empty() {
        return Err("폴더 이름을 입력해 주세요.".to_owned());
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err("폴더 이름은 40자 이내로 입력해 주세요.".to_owned());
    }
    Ok(name.to_owned())
}

fn validate_id(input: &str) -> Result<&str, String> {
    if input.is_empty()
        || input.len() > 96
        || !input
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("업무 폴더 즐겨찾기를 찾을 수 없습니다.".to_owned());
    }
    Ok(input)
}

fn create_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("folder-{timestamp:x}-{counter:x}")
}

fn canonical_key(path: &Path) -> Result<String, String> {
    let canonical =
        std::fs::canonicalize(path).map_err(|_| "선택한 폴더를 사용할 수 없습니다.".to_owned())?;
    if !canonical.is_dir() {
        return Err("선택한 폴더를 사용할 수 없습니다.".to_owned());
    }
    Ok(canonical.to_string_lossy().to_lowercase())
}

fn default_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(validate_name)
        .transpose()?
        .ok_or_else(|| "폴더 이름을 확인할 수 없습니다.".to_owned())
}

fn display_path(path: &str) -> String {
    let parts = Path::new(path)
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>();
    if parts.len() <= 3 {
        path.to_owned()
    } else {
        format!("...\\{}", parts[parts.len() - 3..].join("\\"))
    }
}

fn to_public(value: StoredWorkFolderFavorite) -> WorkFolderFavorite {
    let available = Path::new(&value.path).is_dir();
    WorkFolderFavorite {
        display_path: display_path(&value.path),
        available,
        id: value.id,
        name: value.name,
        path: value.path,
    }
}

fn load_stored(app: &AppHandle) -> Result<Vec<StoredWorkFolderFavorite>, String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    match store.get(FAVORITES_KEY) {
        Some(value) => serde_json::from_value(value.clone()).map_err(|error| error.to_string()),
        None => Ok(Vec::new()),
    }
}

fn save_stored(app: &AppHandle, favorites: &[StoredWorkFolderFavorite]) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let value = serde_json::to_value(favorites).map_err(|error| error.to_string())?;
    store.set(FAVORITES_KEY, value);
    store.save().map_err(|error| error.to_string())
}

fn migrate_legacy(
    app: &AppHandle,
    favorites: Vec<StoredWorkFolderFavorite>,
) -> Result<Vec<StoredWorkFolderFavorite>, String> {
    if !favorites.is_empty() {
        return Ok(favorites);
    }
    let legacy_store = app
        .store(LEGACY_STORE_FILE)
        .map_err(|error| error.to_string())?;
    let Some(path) = legacy_store
        .get(LEGACY_WORK_FOLDER_KEY)
        .and_then(|value| value.as_str().map(str::to_owned))
    else {
        return Ok(favorites);
    };
    let path_buf = PathBuf::from(&path);
    if canonical_key(&path_buf).is_err() {
        return Ok(favorites);
    }
    let migrated = vec![StoredWorkFolderFavorite {
        id: create_id(),
        name: default_name(&path_buf)?,
        path,
    }];
    save_stored(app, &migrated)?;
    legacy_store.delete(LEGACY_WORK_FOLDER_KEY);
    legacy_store.save().map_err(|error| error.to_string())?;
    Ok(migrated)
}

fn load_and_migrate(app: &AppHandle) -> Result<Vec<StoredWorkFolderFavorite>, String> {
    let favorites = load_stored(app)?;
    migrate_legacy(app, favorites)
}

#[tauri::command]
pub fn get_work_folder_favorites(app: AppHandle) -> Result<Vec<WorkFolderFavorite>, String> {
    load_and_migrate(&app).map(|items| items.into_iter().map(to_public).collect())
}

#[tauri::command]
pub fn pick_work_folder_favorite(
    app: AppHandle,
) -> Result<Option<Vec<WorkFolderFavorite>>, String> {
    let Some(selection) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = selection.into_path().map_err(|error| error.to_string())?;
    let selected_key = canonical_key(&path)?;
    let mut favorites = load_and_migrate(&app)?;
    if favorites.len() >= MAX_FAVORITES {
        return Err("업무 폴더는 최대 12개까지 등록할 수 있습니다.".to_owned());
    }
    if favorites.iter().any(|favorite| {
        canonical_key(Path::new(&favorite.path)).is_ok_and(|key| key == selected_key)
    }) {
        return Err("이미 등록된 폴더입니다.".to_owned());
    }
    favorites.push(StoredWorkFolderFavorite {
        id: create_id(),
        name: default_name(&path)?,
        path: path.to_string_lossy().into_owned(),
    });
    save_stored(&app, &favorites)?;
    Ok(Some(favorites.into_iter().map(to_public).collect()))
}

#[tauri::command]
pub fn rename_work_folder_favorite(
    app: AppHandle,
    id: String,
    name: String,
) -> Result<Vec<WorkFolderFavorite>, String> {
    validate_id(&id)?;
    let name = validate_name(&name)?;
    let mut favorites = load_and_migrate(&app)?;
    let favorite = favorites
        .iter_mut()
        .find(|favorite| favorite.id == id)
        .ok_or_else(|| "업무 폴더 즐겨찾기를 찾을 수 없습니다.".to_owned())?;
    favorite.name = name;
    save_stored(&app, &favorites)?;
    Ok(favorites.into_iter().map(to_public).collect())
}

#[tauri::command]
pub fn delete_work_folder_favorite(
    app: AppHandle,
    id: String,
) -> Result<Vec<WorkFolderFavorite>, String> {
    validate_id(&id)?;
    let mut favorites = load_and_migrate(&app)?;
    let original_len = favorites.len();
    favorites.retain(|favorite| favorite.id != id);
    if favorites.len() == original_len {
        return Err("업무 폴더 즐겨찾기를 찾을 수 없습니다.".to_owned());
    }
    save_stored(&app, &favorites)?;
    Ok(favorites.into_iter().map(to_public).collect())
}

#[tauri::command]
pub fn reorder_work_folder_favorites(
    app: AppHandle,
    ids: Vec<String>,
) -> Result<Vec<WorkFolderFavorite>, String> {
    let favorites = load_and_migrate(&app)?;
    if ids.len() != favorites.len() || ids.iter().any(|id| validate_id(id).is_err()) {
        return Err("업무 폴더 순서를 저장할 수 없습니다.".to_owned());
    }
    let mut reordered = Vec::with_capacity(favorites.len());
    for id in ids {
        let Some(favorite) = favorites.iter().find(|favorite| favorite.id == id) else {
            return Err("업무 폴더 순서를 저장할 수 없습니다.".to_owned());
        };
        if reordered
            .iter()
            .any(|item: &StoredWorkFolderFavorite| item.id == favorite.id)
        {
            return Err("업무 폴더 순서를 저장할 수 없습니다.".to_owned());
        }
        reordered.push(favorite.clone());
    }
    save_stored(&app, &reordered)?;
    Ok(reordered.into_iter().map(to_public).collect())
}

#[tauri::command]
pub fn open_work_folder_favorite(app: AppHandle, id: String) -> Result<(), String> {
    validate_id(&id)?;
    let favorites = load_and_migrate(&app)?;
    let favorite = favorites
        .iter()
        .find(|favorite| favorite.id == id)
        .ok_or_else(|| "업무 폴더 즐겨찾기를 찾을 수 없습니다.".to_owned())?;
    if !Path::new(&favorite.path).is_dir() {
        return Err("폴더를 찾을 수 없습니다.".to_owned());
    }
    app.opener()
        .open_path(&favorite.path, None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_names_at_device_boundary() {
        assert_eq!(validate_name("  검진  "), Ok("검진".to_owned()));
        assert!(validate_name(" ").is_err());
        assert!(validate_name(&"가".repeat(41)).is_err());
    }

    #[test]
    fn rejects_unsafe_favorite_ids() {
        assert!(validate_id("folder-safe-1").is_ok());
        assert!(validate_id("../folder").is_err());
    }

    #[test]
    fn shortens_display_paths_without_losing_leaf_names() {
        let shown = display_path(r"C:\Users\teacher\Documents\학교\2026\검진");
        assert_eq!(shown, r"...\학교\2026\검진");
    }
}
