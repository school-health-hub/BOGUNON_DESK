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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct QaSearchRequest {
    topic: String,
    audience: String,
    desired_minutes: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QaSearchVideo {
    video_id: &'static str,
    title: String,
    channel_id: &'static str,
    channel_title: &'static str,
    duration_seconds: u32,
    url: &'static str,
    official: bool,
    official_evidence: Option<&'static str>,
    synthetic: bool,
}

#[derive(Serialize)]
struct QaSearchResponse {
    source: &'static str,
    notice: &'static str,
    results: Vec<QaSearchVideo>,
}

#[derive(Serialize)]
struct QaSearchFailure {
    code: &'static str,
    message: &'static str,
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
fn education_video_qa_search(
    app: tauri::AppHandle,
    request: QaSearchRequest,
    access_token: String,
) -> Result<serde_json::Value, QaSearchFailure> {
    ensure_qa(&app).map_err(|_| QaSearchFailure {
        code: "FORBIDDEN",
        message: "QA identity mismatch",
    })?;
    if access_token != "synthetic-finder-qa-token" {
        return Err(QaSearchFailure {
            code: "UNAUTHORIZED",
            message: "Synthetic QA token required",
        });
    }
    if request.topic.trim().is_empty()
        || request.topic.chars().count() > 100
        || request.audience.trim().is_empty()
        || request.audience.chars().count() > 100
        || !(1..=180).contains(&request.desired_minutes)
    {
        return Err(QaSearchFailure {
            code: "INVALID_REQUEST",
            message: "Invalid synthetic QA request",
        });
    }
    if request.topic.trim() == "QA timeout" {
        return Err(QaSearchFailure {
            code: "TIMEOUT",
            message: "Synthetic QA timeout",
        });
    }
    if request.topic.trim() == "QA 잘못된 응답" {
        return Ok(serde_json::json!({"source":"synthetic-mock","notice":7,"results":[]}));
    }
    let results = if request.topic.trim() == "QA 결과 없음" {
        Vec::new()
    } else {
        [
            (
                "qaVideo0001",
                "합성 보건교육 채널",
                0_i32,
                "https://www.youtube.com/watch?v=qaVideo0001",
            ),
            (
                "qaVideo0002",
                "합성 학교교육 채널",
                2_i32,
                "https://www.youtube.com/watch?v=qaVideo0002",
            ),
            (
                "qaVideo0003",
                "합성 안전교육 채널",
                -2_i32,
                "https://www.youtube.com/watch?v=qaVideo0003",
            ),
        ]
        .into_iter()
        .map(|(video_id, channel_title, offset, url)| QaSearchVideo {
            video_id,
            title: format!(
                "{} · {} 합성 교육영상",
                request.topic.trim(),
                request.audience.trim()
            ),
            channel_id: "qa-synthetic-channel",
            channel_title,
            duration_seconds: u32::from(request.desired_minutes)
                .saturating_mul(60)
                .saturating_add_signed(offset.saturating_mul(60))
                .max(30),
            url,
            official: false,
            official_evidence: None,
            synthetic: true,
        })
        .collect()
    };
    serde_json::to_value(QaSearchResponse {
        source: "synthetic-mock",
        notice: "합성 Tauri IPC 검색 결과입니다. 실제 YouTube 요청은 발생하지 않았습니다.",
        results,
    })
    .map_err(|_| QaSearchFailure {
        code: "INVALID_RESPONSE",
        message: "Synthetic QA serialization failed",
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
            education_video_qa_search,
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
