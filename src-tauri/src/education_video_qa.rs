use crate::education_video;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

const QA_IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.educationvideoqa";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QaInfo {
    identifier: String,
    source_sha: &'static str,
    local_data: PathBuf,
    integrations_disabled: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct QaReport {
    passed: u8,
    failed: u8,
    checks: Vec<String>,
}

fn ensure_qa(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if app.config().identifier != QA_IDENTIFIER {
        return Err("QA identity mismatch".to_owned());
    }
    app.path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())
}

fn library_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(ensure_qa(app)?.join("education-video").join("library.json"))
}

#[tauri::command]
fn education_video_qa_info(app: tauri::AppHandle) -> Result<QaInfo, String> {
    Ok(QaInfo {
        identifier: app.config().identifier.clone(),
        source_sha: env!("BOGUNON_QA_SOURCE_SHA"),
        local_data: ensure_qa(&app)?,
        integrations_disabled: true,
    })
}

#[tauri::command]
fn education_video_qa_reset(app: tauri::AppHandle) -> Result<(), String> {
    let directory = ensure_qa(&app)?.join("education-video");
    if directory.exists() {
        fs::remove_dir_all(directory).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn education_video_qa_corrupt_primary(app: tauri::AppHandle) -> Result<(), String> {
    fs::write(library_path(&app)?, b"{corrupt-qa-primary").map_err(|error| error.to_string())
}

#[tauri::command]
fn education_video_qa_complete(app: tauri::AppHandle, report: QaReport) -> Result<PathBuf, String> {
    if report.failed != 0 || report.passed != 7 || report.checks.len() != 7 {
        return Err("QA report is incomplete".to_owned());
    }
    let path = ensure_qa(&app)?.join("finder-ipc-qa-report.json");
    let bytes = serde_json::to_vec_pretty(&report).map_err(|error| error.to_string())?;
    fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(path)
}

pub fn run() {
    let context = tauri::generate_context!();
    assert_eq!(context.config().identifier, QA_IDENTIFIER);
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            education_video_qa_info,
            education_video_qa_reset,
            education_video_qa_corrupt_primary,
            education_video_qa_complete,
            education_video::education_video_library_load,
            education_video::education_video_library_save,
            education_video::education_video_library_import,
            education_video::education_video_library_export,
            education_video::education_video_library_recover,
            education_video::education_video_search,
        ])
        .run(context)
        .expect("Finder IPC QA startup failed");
}
