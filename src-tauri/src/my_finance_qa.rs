//! Separate native entry: no school/auth/updater/deep-link/autostart/tray handlers.
use crate::my_finance_commands::{self, FinanceState};
use tauri::Manager;
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
    crate::main_security::configure(tauri::Builder::default())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Ok(window) = crate::main_events::capture(app).and_then(|lease| lease.main(app)) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(FinanceState::default())
        .invoke_handler(tauri::generate_handler![
            main_commands::my_finance_qa_info,
            my_finance_commands::main_commands::my_finance_load_snapshot,
            my_finance_commands::main_commands::my_finance_list_income,
            my_finance_commands::main_commands::my_finance_create_income,
            my_finance_commands::main_commands::my_finance_update_income,
            my_finance_commands::main_commands::my_finance_delete_income,
            my_finance_commands::main_commands::my_finance_replace_phase2,
            my_finance_commands::main_commands::my_finance_export_backup,
            my_finance_commands::main_commands::my_finance_select_backup,
            my_finance_commands::main_commands::my_finance_inspect_backup,
            my_finance_commands::main_commands::my_finance_restore_backup,
            my_finance_commands::main_commands::my_finance_cancel_backup
        ])
        .setup(|app| {
            crate::main_security::install(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                crate::main_lifetime::retire(window);
                window.state::<crate::main_events::MainEvents>().retire_window(window);
            }
        })
        .run(context)
        .expect("MY FINANCE QA startup failed");
}

#[path = "main_commands/my_finance_qa.rs"]
pub(crate) mod main_commands;
