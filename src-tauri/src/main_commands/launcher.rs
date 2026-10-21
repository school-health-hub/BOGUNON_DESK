//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn open_quick_memo_url(
    caller: tauri::Webview,
    app: AppHandle,
    url: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::open_quick_memo_url(app, url))
}

#[tauri::command]
pub(crate) fn get_launcher_settings(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<LauncherSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::get_launcher_settings(app))
}

#[tauri::command]
pub(crate) fn save_launcher_url(
    caller: tauri::Webview,
    app: AppHandle,
    action_id: String,
    url: String,
) -> Result<LauncherSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::save_launcher_url(app, action_id, url))
}

#[tauri::command]
pub(crate) fn save_work_portal_url(
    caller: tauri::Webview,
    app: AppHandle,
    url: Option<String>,
) -> Result<LauncherSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::save_work_portal_url(app, url))
}

#[tauri::command]
pub(crate) fn save_work_portal_auto_open_delay(
    caller: tauri::Webview,
    app: AppHandle,
    delay: WorkPortalAutoOpenDelay,
) -> Result<LauncherSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::save_work_portal_auto_open_delay(app, delay)
    })
}

#[tauri::command]
pub(crate) fn replace_account_launcher_links(
    caller: tauri::Webview,
    app: AppHandle,
    launcher_links: AccountLauncherLinks,
) -> Result<LauncherSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::replace_account_launcher_links(app, launcher_links)
    })
}
