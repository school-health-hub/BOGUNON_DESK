//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn pick_and_extract_official_document(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<Option<OfficialDocumentImportResult>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::pick_and_extract_official_document(app).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn extract_official_document_path(
    caller: tauri::Webview,
    path: String,
) -> Result<OfficialDocumentImportResult, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::extract_official_document_path(path).await
    })
    .await
}
