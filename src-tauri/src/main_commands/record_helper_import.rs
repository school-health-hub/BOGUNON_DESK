//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn pick_and_extract_record_helper_reports(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<RecordHelperImportBatch, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::pick_and_extract_record_helper_reports(app).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn extract_record_helper_paths(
    caller: tauri::Webview,
    paths: Vec<String>,
) -> Result<RecordHelperImportBatch, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::extract_record_helper_paths(paths).await
    })
    .await
}
