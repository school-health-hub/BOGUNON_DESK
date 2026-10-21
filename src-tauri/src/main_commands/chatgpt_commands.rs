//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn chatgpt_get_connection_state(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
) -> Result<ChatGptConnectionStateDto, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::chatgpt_get_connection_state(app, state))
}

#[tauri::command]
pub(crate) async fn chatgpt_start_sign_in(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
    credential_state: State<'_, ChatGptCredentialMutationState>,
) -> Result<ChatGptConnectionStateDto, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::chatgpt_start_sign_in(app, state, credential_state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn chatgpt_disconnect(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, ChatGptAuthState>,
    credential_state: State<'_, ChatGptCredentialMutationState>,
) -> Result<ChatGptConnectionStateDto, crate::main_caller::CommandError<String>> {
    crate::main_caller::run_async(&caller, || async {
        super::chatgpt_disconnect(app, state, credential_state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn chatgpt_list_models(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
) -> Result<Vec<ChatGptModelDto>, crate::main_caller::CommandError<ChatGptPlanErrorDto>> {
    crate::main_caller::run_async(&caller, || async {
        super::chatgpt_list_models(app, state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn chatgpt_generate_text(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, ChatGptCredentialMutationState>,
    model: String,
    prompt: String,
) -> Result<String, crate::main_caller::CommandError<ChatGptPlanErrorDto>> {
    crate::main_caller::run_async(&caller, || async {
        super::chatgpt_generate_text(app, state, model, prompt).await
    })
    .await
}
