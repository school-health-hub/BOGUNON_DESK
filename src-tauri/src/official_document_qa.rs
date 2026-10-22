use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::Manager;

use crate::{official_document_import, official_reference_package};

const QA_IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.officialdocumentqa";
const QA_WEBVIEW_DIRECTORY: &str = "official-document-qa-webview";
const QA_PATH_ERROR: &str = "QA data path is not isolated";

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn reject_reparse_point(path: &Path) -> Result<(), &'static str> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if is_reparse_point(&metadata) => Err(QA_PATH_ERROR),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(QA_PATH_ERROR),
    }
}

fn reject_reparse_ancestors(path: &Path) -> Result<(), &'static str> {
    for ancestor in path.ancestors() {
        reject_reparse_point(ancestor)?;
    }
    Ok(())
}

fn verify_identifier_root(actual: &Path) -> Result<PathBuf, &'static str> {
    if actual.file_name().and_then(|name| name.to_str()) != Some(QA_IDENTIFIER) {
        return Err(QA_PATH_ERROR);
    }
    reject_reparse_ancestors(actual)?;
    reject_reparse_ancestors(&actual.join("official-document-references"))?;
    Ok(actual.to_path_buf())
}

fn verify_webview_root(app_data: &Path) -> Result<PathBuf, &'static str> {
    let verified_app_data = verify_identifier_root(app_data)?;
    let window_root = verified_app_data.join("main");
    reject_reparse_ancestors(&window_root)?;
    let webview_root = window_root.join(QA_WEBVIEW_DIRECTORY);
    reject_reparse_ancestors(&webview_root)?;
    Ok(webview_root)
}

#[tauri::command]
fn official_document_qa_info(app: tauri::AppHandle) -> Result<serde_json::Value, &'static str> {
    if app.config().identifier != QA_IDENTIFIER {
        return Err("QA identity mismatch");
    }
    let local_data = app.path().app_local_data_dir().map_err(|_| QA_PATH_ERROR)?;
    let app_data = app.path().app_data_dir().map_err(|_| QA_PATH_ERROR)?;
    let verified_local_data = verify_identifier_root(&local_data)?;
    let verified_webview_data = verify_webview_root(&app_data)?;
    Ok(serde_json::json!({
        "identifier": app.config().identifier,
        "sourceSha": env!("BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA"),
        "localData": verified_local_data,
        "webviewData": verified_webview_data,
        "networkEnabled": false,
        "loginEnabled": false,
        "chatGptEnabled": false,
        "aiEnabled": false,
        "accountSyncEnabled": false,
        "updaterEnabled": false,
        "deepLinkEnabled": false,
        "autostartEnabled": false,
        "trayEnabled": false,
        "externalUrlEnabled": false
    }))
}

pub fn run() {
    let context = tauri::generate_context!();
    assert_eq!(context.config().identifier, QA_IDENTIFIER);
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            official_document_qa_info,
            official_reference_package::read_official_reference_package,
            official_reference_package::write_official_reference_package,
            official_reference_package::remove_official_reference_package,
            official_document_import::pick_and_extract_official_document,
            official_document_import::extract_official_document_path
        ])
        .setup(|app| {
            let local_data = app.path().app_local_data_dir().map_err(|_| QA_PATH_ERROR)?;
            let app_data = app.path().app_data_dir().map_err(|_| QA_PATH_ERROR)?;
            verify_identifier_root(&local_data)?;
            verify_webview_root(&app_data)?;
            Ok(())
        })
        .run(context)
        .expect("Official document QA startup failed");
}
