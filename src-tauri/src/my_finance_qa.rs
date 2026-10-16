//! Separate native entry: no school/auth/updater/deep-link/autostart/tray handlers.
use crate::my_finance_commands::{self, FinanceState};
use tauri::Manager;
#[tauri::command]
fn my_finance_qa_info(app: tauri::AppHandle) -> Result<serde_json::Value, &'static str> {
    if app.config().identifier != "kr.sungandi.schoolhealthdesk.myfinanceqa" {
        return Err("QA identity mismatch");
    }
    Ok(serde_json::json!({
        "identifier": app.config().identifier,
        "sourceSha": env!("BOGUNON_QA_SOURCE_SHA"),
        "localData": app.path().app_local_data_dir().map_err(|_| "QA path unavailable")?,
        "settingsData": app.path().app_data_dir().map_err(|_| "QA path unavailable")?,
        "loginEnabled": false, "updaterEnabled": false, "deepLinkEnabled": false,
        "autostartEnabled": false, "trayEnabled": false
    }))
}
pub fn run() {
    let context = tauri::generate_context!();
    assert_eq!(
        context.config().identifier,
        "kr.sungandi.schoolhealthdesk.myfinanceqa"
    );
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(FinanceState::default())
        .invoke_handler(tauri::generate_handler![
            my_finance_qa_info,
            my_finance_commands::my_finance_load_snapshot,
            my_finance_commands::my_finance_list_income,
            my_finance_commands::my_finance_create_income,
            my_finance_commands::my_finance_update_income,
            my_finance_commands::my_finance_delete_income,
            my_finance_commands::my_finance_export_backup,
            my_finance_commands::my_finance_select_backup,
            my_finance_commands::my_finance_inspect_backup,
            my_finance_commands::my_finance_restore_backup,
            my_finance_commands::my_finance_cancel_backup
        ])
        .run(context)
        .expect("MY FINANCE QA startup failed");
}
