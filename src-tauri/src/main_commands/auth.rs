//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn open_auth_url(
    caller: tauri::Webview,
    app: AppHandle,
    url: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::open_auth_url(app, url))
}

#[tauri::command]
pub(crate) fn secure_session_get(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
) -> Result<Option<String>, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::secure_session_get(app, state, key))
}

#[tauri::command]
pub(crate) fn secure_session_set(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
    value: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::secure_session_set(app, state, key, value)
    })
}

#[tauri::command]
pub(crate) fn secure_session_remove(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, SecureSessionState>,
    key: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::secure_session_remove(app, state, key))
}

#[tauri::command]
pub(crate) fn secure_session_clear(
    caller: tauri::Webview,
    app: AppHandle,
    state: State<'_, SecureSessionState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::secure_session_clear(app, state))
}
