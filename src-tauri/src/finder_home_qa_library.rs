use super::finder_home_qa_paths::QaPaths;
use super::finder_home_qa_synthetic as synthetic;
use crate::education_video::{
    model::{LibraryEntry, LibraryError, LoadResult, ProviderMetadata},
    store,
};
use std::{path::Path, sync::Mutex};
use tauri::State;

pub struct QaLibrary(pub Mutex<QaPaths>);

fn checked_result(result: LoadResult) -> Result<LoadResult, LibraryError> {
    synthetic::library(&serde_json::to_value(&result.library).map_err(|_| LibraryError::Invalid)?)?;
    Ok(result)
}

fn with_library<T>(
    state: &QaLibrary,
    operation: impl FnOnce(&Path) -> Result<T, LibraryError>,
) -> Result<T, String> {
    let paths = state.0.lock().map_err(|_| "Finder QA library is busy")?;
    paths.verify().map_err(str::to_owned)?;
    operation(&paths.library()).map_err(|error| error.to_string())
}

#[tauri::command(rename = "education_video_library_load")]
pub fn finder_home_qa_library_load(state: State<'_, QaLibrary>) -> Result<LoadResult, String> {
    with_library(&state, |path| checked_result(store::load(path)?))
}

#[tauri::command(rename = "education_video_library_save")]
pub fn finder_home_qa_library_save(
    state: State<'_, QaLibrary>,
    entry: LibraryEntry,
) -> Result<LoadResult, String> {
    with_library(&state, |path| {
        synthetic::entry(&serde_json::to_value(&entry).map_err(|_| LibraryError::Invalid)?)?;
        checked_result(store::save_entry(path, entry)?)
    })
}

#[tauri::command(rename = "education_video_library_import")]
pub fn finder_home_qa_library_import(
    state: State<'_, QaLibrary>,
    json: String,
) -> Result<LoadResult, String> {
    with_library(&state, |path| {
        synthetic::import_json(&json)?;
        checked_result(store::import(path, &json)?)
    })
}

#[tauri::command(rename = "education_video_library_export")]
pub fn finder_home_qa_library_export(state: State<'_, QaLibrary>) -> Result<String, String> {
    with_library(&state, |path| {
        let json = store::export(path)?;
        synthetic::import_json(&json)?;
        Ok(json)
    })
}

#[tauri::command(rename = "education_video_library_recover")]
pub fn finder_home_qa_library_recover(state: State<'_, QaLibrary>) -> Result<LoadResult, String> {
    with_library(&state, |path| checked_result(store::recover(path)?))
}

#[tauri::command(rename = "education_video_library_metadata_delete")]
pub fn finder_home_qa_library_metadata_delete(
    state: State<'_, QaLibrary>,
    video_id: String,
) -> Result<LoadResult, String> {
    with_library(&state, |path| {
        if video_id != synthetic::VIDEO_ID {
            return Err(LibraryError::Invalid);
        }
        checked_result(store::delete_metadata(path, &video_id)?)
    })
}

#[tauri::command(rename = "education_video_library_metadata_refresh")]
pub fn finder_home_qa_library_metadata_refresh(
    state: State<'_, QaLibrary>,
    video_id: String,
    provider: ProviderMetadata,
) -> Result<LoadResult, String> {
    with_library(&state, |path| {
        if video_id != synthetic::VIDEO_ID {
            return Err(LibraryError::Invalid);
        }
        synthetic::provider(&serde_json::to_value(&provider).map_err(|_| LibraryError::Invalid)?)?;
        checked_result(store::refresh_metadata(path, &video_id, provider)?)
    })
}
