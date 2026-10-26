use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use super::{
    output_model::{OutputSaveOutcome, OutputSaveRequest, RecoveryReport, SelectedOutputTarget},
    output_recovery::{last_success, recover},
    output_storage::save_outputs,
};

static TARGETS: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();
static SAVE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn ledger_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|root| root.join("newsletter-output-ledger"))
        .map_err(|_| "Newsletter 출력 원장을 사용할 수 없습니다.".to_owned())
}

fn target_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("선택한 폴더")
        .to_owned()
}

#[tauri::command]
pub(crate) async fn newsletter_output_pick_target(
    app: AppHandle,
) -> Result<Option<SelectedOutputTarget>, String> {
    let selected = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| {
            path.into_path()
                .map_err(|_| "선택한 출력 위치를 사용할 수 없습니다.".to_owned())
        })
        .transpose()?;
    let Some(path) = selected else {
        return Ok(None);
    };
    let token = Uuid::new_v4().to_string();
    let label = target_label(&path);
    TARGETS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| "출력 위치 선택 상태를 사용할 수 없습니다.".to_owned())?
        .insert(token.clone(), path);
    Ok(Some(SelectedOutputTarget { token, label }))
}

#[tauri::command]
pub(crate) fn newsletter_output_save(
    app: AppHandle,
    request: OutputSaveRequest,
) -> Result<OutputSaveOutcome, String> {
    let _guard = SAVE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "다른 Newsletter 출력 작업을 확인할 수 없습니다.".to_owned())?;
    let target = TARGETS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| "출력 위치 선택 상태를 사용할 수 없습니다.".to_owned())?
        .get(&request.target_token)
        .cloned()
        .ok_or_else(|| "출력 위치를 다시 선택해 주세요.".to_owned())?;
    save_outputs(
        &ledger_root(&app)?,
        &target,
        &target_label(&target),
        request,
    )
}

#[tauri::command]
pub(crate) fn newsletter_output_last_success(
    app: AppHandle,
    project_id: String,
) -> Result<Option<OutputSaveOutcome>, String> {
    last_success(&ledger_root(&app)?, &project_id)
}

#[tauri::command]
pub(crate) fn newsletter_output_recover(app: AppHandle) -> Result<RecoveryReport, String> {
    recover(&ledger_root(&app)?)
}
