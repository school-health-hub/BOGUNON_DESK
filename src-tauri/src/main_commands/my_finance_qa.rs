//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn my_finance_qa_info(
    caller: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run(&caller, || super::my_finance_qa_info(app))
}
