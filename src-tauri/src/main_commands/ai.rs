//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn validate_ai_connection(
    caller: tauri::Webview,
    provider: String,
    model: String,
    api_key: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::validate_ai_connection(provider, model, api_key).await
    })
    .await
}
