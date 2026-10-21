//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn get_notification_settings(
    caller: tauri::Webview,
    app: AppHandle,
) -> Result<NotificationSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::get_notification_settings(app))
}

#[tauri::command]
pub(crate) fn set_workspace_notifications_enabled(
    caller: tauri::Webview,
    app: AppHandle,
    enabled: bool,
) -> Result<NotificationSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::set_workspace_notifications_enabled(app, enabled)
    })
}

#[tauri::command]
pub(crate) fn set_workspace_notification_reasons(
    caller: tauri::Webview,
    app: AppHandle,
    reasons: NotificationReasonSettings,
) -> Result<NotificationSettings, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        super::set_workspace_notification_reasons(app, reasons)
    })
}

#[tauri::command]
pub(crate) fn mark_daily_summary_sent(
    caller: tauri::Webview,
    app: AppHandle,
    date: String,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || super::mark_daily_summary_sent(app, date))
}
