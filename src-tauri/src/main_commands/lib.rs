//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn execute_desktop_action(
    caller: tauri::Webview,
    app: AppHandle,
    action_id: String,
) -> Result<DesktopActionOutcome, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::execute_desktop_action(app, action_id))
}

#[tauri::command]
pub(crate) fn open_bogunon_search_result(
    caller: tauri::Webview,
    app: AppHandle,
    kind: launcher::BogunonSearchResultKind,
    id: String,
    date: Option<String>,
) -> Result<DesktopActionOutcome, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::open_bogunon_search_result(app, kind, id, date)
    })
}

#[tauri::command]
pub(crate) fn get_autostart_enabled(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<bool, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::get_autostart_enabled(app))
}

#[tauri::command]
pub(crate) fn set_autostart_enabled(
    caller: tauri::Webview,
    app: AppHandle,
    enabled: bool,
) -> Result<bool, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::set_autostart_enabled(app, enabled))
}

#[tauri::command]
pub(crate) fn set_close_to_tray(
    caller: tauri::Webview,
    state: State<'_, DesktopState>,
    enabled: bool,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        Ok::<(), String>(super::set_close_to_tray(state, enabled))
    })
}
