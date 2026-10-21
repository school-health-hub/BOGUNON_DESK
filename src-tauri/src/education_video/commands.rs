use super::{
    model::{LibraryError, LibraryItem, LoadResult},
    store,
};
use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Manager};

static LIBRARY_LOCK: Mutex<()> = Mutex::new(());

fn with_library<T>(
    app: &AppHandle,
    operation: impl FnOnce(&Path) -> Result<T, LibraryError>,
) -> Result<T, String> {
    let _guard = LIBRARY_LOCK
        .lock()
        .map_err(|_| LibraryError::Busy.to_string())?;
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| LibraryError::Io.to_string())?
        .join("education-video")
        .join("library.json");
    operation(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn education_video_library_load(app: AppHandle) -> Result<LoadResult, String> {
    with_library(&app, store::load)
}
#[tauri::command]
pub fn education_video_library_save(
    app: AppHandle,
    item: LibraryItem,
) -> Result<LoadResult, String> {
    with_library(&app, |path| store::save_item(path, item))
}
#[tauri::command]
pub fn education_video_library_import(app: AppHandle, json: String) -> Result<LoadResult, String> {
    with_library(&app, |path| store::import(path, &json))
}
#[tauri::command]
pub fn education_video_library_export(app: AppHandle) -> Result<String, String> {
    with_library(&app, store::export)
}
#[tauri::command]
pub fn education_video_library_recover(app: AppHandle) -> Result<LoadResult, String> {
    with_library(&app, store::recover)
}
