use super::{
    model::{LibraryEntry, LibraryError, LoadResult, ProviderMetadata},
    request_core, store,
    wire::{SearchError, SearchRequest, SearchResponse},
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
    operation(&path).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn education_video_library_load(app: AppHandle) -> Result<LoadResult, String> {
    with_library(&app, store::load)
}
#[tauri::command]
pub fn education_video_library_save(
    app: AppHandle,
    entry: LibraryEntry,
) -> Result<LoadResult, String> {
    with_library(&app, |path| store::save_entry(path, entry))
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
#[tauri::command]
pub fn education_video_library_metadata_delete(
    app: AppHandle,
    video_id: String,
) -> Result<LoadResult, String> {
    with_library(&app, |path| store::delete_metadata(path, &video_id))
}
#[tauri::command]
pub fn education_video_library_metadata_refresh(
    app: AppHandle,
    video_id: String,
    provider: ProviderMetadata,
) -> Result<LoadResult, String> {
    with_library(&app, |path| {
        store::refresh_metadata(path, &video_id, provider)
    })
}
#[derive(serde::Serialize)]
pub struct SearchFailure {
    code: SearchError,
    message: &'static str,
}
#[tauri::command]
pub fn education_video_search(
    request: SearchRequest,
    access_token: String,
    request_id: String,
) -> Result<SearchResponse, SearchFailure> {
    // Intentionally no environment switch can enable real dispatch in this phase.
    request_core::disabled_dispatch(&request, &access_token, &request_id).map_err(|code| {
        SearchFailure {
            code,
            message: request_core::safe_message(code),
        }
    })
}
