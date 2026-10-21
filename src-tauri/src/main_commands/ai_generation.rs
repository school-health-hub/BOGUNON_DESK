//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn generate_ai_text(
    caller: tauri::Webview,
    provider: String,
    model: String,
    api_key: String,
    prompt: String,
) -> Result<String, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::generate_ai_text(provider, model, api_key, prompt).await
    })
    .await
}
