use super::{
    finder_home_qa_library::{self as library, QaLibrary},
    finder_home_qa_paths::{QaPaths, IDENTIFIER, PATH_ERROR},
};
use std::{fs, path::Path, sync::Mutex};
use tauri::{webview::NewWindowResponse, Manager, WebviewUrl, WebviewWindowBuilder};

fn paths() -> Result<QaPaths, &'static str> {
    let root = std::env::var("BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT").map_err(|_| PATH_ERROR)?;
    QaPaths::new(Path::new(&root), env!("BOGUNON_FINDER_HOME_QA_SOURCE_SHA"))
}

#[tauri::command]
fn finder_home_qa_metadata() -> Result<serde_json::Value, &'static str> {
    let paths = paths()?;
    Ok(serde_json::json!({
        "identifier": IDENTIFIER,
        "sourceSha": env!("BOGUNON_FINDER_HOME_QA_SOURCE_SHA"),
        "sourceDirty": env!("BOGUNON_FINDER_HOME_QA_SOURCE_DIRTY") == "true",
        "outputRoot": paths.root(),
        "localData": paths.library().parent(),
        "webviewData": paths.directory("webview"),
        "networkEnabled": false,
        "authEnabled": false,
        "externalConnections": false,
        "syntheticOnly": true
    }))
}

fn local_navigation(url: &tauri::Url) -> bool {
    matches!(
        (url.scheme(), url.host_str(), url.path()),
        (
            "http" | "https",
            Some("tauri.localhost"),
            "/" | "/index.html"
        ) | ("tauri", Some("localhost"), "/" | "/index.html")
    ) && url.port().is_none()
        && url.query().is_none()
}

pub fn run() {
    let context = tauri::generate_context!();
    if context.config().identifier != IDENTIFIER {
        eprintln!("Finder QA identity mismatch");
        return;
    }
    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            finder_home_qa_metadata,
            library::finder_home_qa_library_load,
            library::finder_home_qa_library_save,
            library::finder_home_qa_library_import,
            library::finder_home_qa_library_export,
            library::finder_home_qa_library_recover,
            library::finder_home_qa_library_metadata_delete,
            library::finder_home_qa_library_metadata_refresh
        ])
        .setup(|app| {
            let paths = paths()?;
            fs::create_dir_all(paths.directory("webview"))?;
            fs::create_dir_all(paths.library().parent().ok_or(PATH_ERROR)?)?;
            paths.verify()?;
            app.manage(QaLibrary(Mutex::new(paths.clone())));
            WebviewWindowBuilder::new(app, "finder-home-qa", WebviewUrl::App("index.html".into()))
                .title("BOGUNON DESK Finder HOME QA — 합성 자료 전용")
                .inner_size(1440.0, 900.0)
                .min_inner_size(980.0, 700.0)
                .data_directory(paths.directory("webview"))
                .disable_drag_drop_handler()
                .on_navigation(local_navigation)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(context);
    if result.is_err() {
        eprintln!("Finder QA startup failed; no production fallback was attempted");
    }
}
