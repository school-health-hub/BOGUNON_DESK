//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn get_work_folder_favorites(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<Vec<WorkFolderFavorite>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::get_work_folder_favorites(app))
}

#[tauri::command]
pub(crate) fn pick_work_folder_favorite(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<Option<Vec<WorkFolderFavorite>>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::pick_work_folder_favorite(app))
}

#[tauri::command]
pub(crate) fn rename_work_folder_favorite(
    caller: tauri::Webview,
    app: AppHandle,
    id: String,
    name: String,
) -> Result<Vec<WorkFolderFavorite>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::rename_work_folder_favorite(app, id, name)
    })
}

#[tauri::command]
pub(crate) fn delete_work_folder_favorite(
    caller: tauri::Webview,
    app: AppHandle,
    id: String,
) -> Result<Vec<WorkFolderFavorite>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::delete_work_folder_favorite(app, id))
}

#[tauri::command]
pub(crate) fn reorder_work_folder_favorites(
    caller: tauri::Webview,
    app: AppHandle,
    ids: Vec<String>,
) -> Result<Vec<WorkFolderFavorite>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::reorder_work_folder_favorites(app, ids))
}

#[tauri::command]
pub(crate) fn open_work_folder_favorite(
    caller: tauri::Webview,
    app: AppHandle,
    id: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::open_work_folder_favorite(app, id))
}
