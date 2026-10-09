use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;

mod ai;
mod ai_generation;
mod auth;
mod browser_launcher;
mod chatgpt;
mod launcher;
mod meal;
mod notifications;
mod official_document_import;
mod purchase_helper;
mod purchase_settlement;
mod record_helper_import;
mod weather;
mod work_folders;

const MAIN_WINDOW_LABEL: &str = "main";
const DESKTOP_NAVIGATE_EVENT: &str = "desktop:navigate";
const DESKTOP_NOTICE_EVENT: &str = "desktop:notice";

struct DesktopState {
    close_to_tray: AtomicBool,
    quitting: AtomicBool,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            close_to_tray: AtomicBool::new(true),
            quitting: AtomicBool::new(false),
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopActionOutcome {
    status: &'static str,
    message: Option<&'static str>,
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "메인 창을 찾을 수 없습니다.".to_owned())?;
    window.show().map_err(|error| error.to_string())?;
    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }
    window.set_focus().map_err(|error| error.to_string())
}

fn navigate_main_window(app: &AppHandle, action_id: &str) -> Result<(), String> {
    show_main_window(app)?;
    app.emit(DESKTOP_NAVIGATE_EVENT, action_id)
        .map_err(|error| error.to_string())
}

fn execute_registered_action(
    app: &AppHandle,
    action_id: &str,
) -> Result<DesktopActionOutcome, String> {
    match action_id {
        "home" | "today-tasks" | "inbox" | "quick-memo" | "work-folder" | "settings" => {
            navigate_main_window(app, action_id)?;
            Ok(DesktopActionOutcome {
                status: "completed",
                message: None,
            })
        }
        "online-health-room"
        | "bogunon"
        | "aed-check"
        | "record-helper"
        | "bogunon-school-settings"
        | "checkup-tools" => {
            let message = launcher::open_registered_url(app, action_id)?;
            Ok(DesktopActionOutcome {
                status: if message.is_some() {
                    "unavailable"
                } else {
                    "completed"
                },
                message,
            })
        }
        "work-portal" => {
            let message = launcher::open_work_portal(app)?;
            Ok(DesktopActionOutcome {
                status: if message.is_some() {
                    "unavailable"
                } else {
                    "completed"
                },
                message,
            })
        }
        _ => Err("등록되지 않은 Desktop action입니다.".to_owned()),
    }
}

#[tauri::command]
fn execute_desktop_action(
    app: AppHandle,
    action_id: String,
) -> Result<DesktopActionOutcome, String> {
    execute_registered_action(&app, &action_id)
}

#[tauri::command]
fn open_bogunon_search_result(
    app: AppHandle,
    kind: launcher::BogunonSearchResultKind,
    id: String,
    date: Option<String>,
) -> Result<DesktopActionOutcome, String> {
    let message = launcher::open_bogunon_search_result(&app, kind, &id, date.as_deref())?;
    Ok(DesktopActionOutcome {
        status: if message.is_some() {
            "unavailable"
        } else {
            "completed"
        },
        message,
    })
}

#[tauri::command]
fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|error| error.to_string())?;
    } else {
        manager.disable().map_err(|error| error.to_string())?;
    }
    manager.is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_close_to_tray(state: State<'_, DesktopState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::SeqCst);
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "BOGUNON DESK 열기", true, None::<&str>)?;
    let today_tasks = MenuItem::with_id(app, "today-tasks", "오늘의 보건업무", true, None::<&str>)?;
    let inbox = MenuItem::with_id(app, "inbox", "미처리 업무", true, None::<&str>)?;
    let online_health_room = MenuItem::with_id(
        app,
        "online-health-room",
        "온라인 보건실",
        true,
        None::<&str>,
    )?;
    let bogunon = MenuItem::with_id(app, "bogunon", "BOGUNON", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "설정", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &today_tasks,
            &inbox,
            &online_health_room,
            &bogunon,
            &settings,
            &separator,
            &quit,
        ],
    )?;

    let mut tray = TrayIconBuilder::with_id("school-health-desk")
        .tooltip("BOGUNON DESK")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                let _ = show_main_window(app);
            }
            "quit" => {
                if let Some(state) = app.try_state::<DesktopState>() {
                    state.quitting.store(true, Ordering::SeqCst);
                }
                app.exit(0);
            }
            action_id => {
                if let Ok(outcome) = execute_registered_action(app, action_id) {
                    if let Some(message) = outcome.message {
                        let _ = show_main_window(app);
                        let _ = app.emit(DESKTOP_NOTICE_EVENT, message);
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        let _ = show_main_window(app);
    }));
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(DesktopState::default())
        .manage(chatgpt::commands::ChatGptAuthState::default())
        .manage(chatgpt::credential::ChatGptCredentialMutationState::default())
        .manage(launcher::WorkPortalAutoOpenState::default())
        .manage(auth::SecureSessionState::default())
        .manage(purchase_helper::PurchaseHelperState::default())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            ai::validate_ai_connection,
            ai_generation::generate_ai_text,
            chatgpt::commands::chatgpt_get_connection_state,
            chatgpt::commands::chatgpt_start_sign_in,
            chatgpt::commands::chatgpt_disconnect,
            chatgpt::commands::chatgpt_list_models,
            chatgpt::commands::chatgpt_generate_text,
            execute_desktop_action,
            open_bogunon_search_result,
            launcher::open_quick_memo_url,
            purchase_helper::pick_and_analyze_purchase_files,
            purchase_helper::apply_purchase_column_mapping,
            purchase_helper::save_purchase_export,
            purchase_helper::save_purchase_edufine_export,
            purchase_settlement::save_purchase_settlement_export,
            purchase_helper::set_purchase_helper_active,
            purchase_helper::invalidate_purchase_helper_analysis,
            official_document_import::pick_and_extract_official_document,
            record_helper_import::pick_and_extract_record_helper_reports,
            get_autostart_enabled,
            set_autostart_enabled,
            set_close_to_tray,
            notifications::get_notification_settings,
            notifications::set_workspace_notifications_enabled,
            notifications::set_workspace_notification_reasons,
            notifications::mark_daily_summary_sent,
            auth::open_auth_url,
            auth::secure_session_get,
            auth::secure_session_set,
            auth::secure_session_remove,
            auth::secure_session_clear,
            launcher::get_launcher_settings,
            launcher::save_launcher_url,
            launcher::save_work_portal_url,
            launcher::save_work_portal_auto_open_delay,
            launcher::replace_account_launcher_links,
            work_folders::get_work_folder_favorites,
            work_folders::pick_work_folder_favorite,
            work_folders::rename_work_folder_favorite,
            work_folders::delete_work_folder_favorite,
            work_folders::reorder_work_folder_favorites,
            work_folders::open_work_folder_favorite,
            meal::fetch_bogunon_meal,
            weather::fetch_bogunon_weather
        ])
        .setup(|app| {
            #[cfg(all(debug_assertions, windows))]
            app.deep_link().register_all()?;
            create_tray(app.handle())?;
            let state = app.state::<launcher::WorkPortalAutoOpenState>();
            let _ = launcher::schedule_work_portal_auto_open(app.handle(), &state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let state = window.state::<purchase_helper::PurchaseHelperState>();
                if state.is_active() {
                    let generation = state.begin_analysis();
                    let _ = window.emit("purchase:analysis-start", generation);
                    let paths = paths.clone();
                    let templates = state.templates();
                    let window = window.clone();
                    tauri::async_runtime::spawn(async move {
                        let analysis =
                            purchase_helper::analyze_paths_in_background(paths, templates).await;
                        let state = window.state::<purchase_helper::PurchaseHelperState>();
                        if let Some(analysis) = state.complete_analysis(generation, analysis) {
                            match analysis {
                                Ok(result) => {
                                    let _ = window.emit(
                                        "purchase:analysis",
                                        purchase_helper::AnalysisEvent { generation, result },
                                    );
                                }
                                Err(message) => {
                                    let _ = window.emit(
                                        "purchase:analysis-error",
                                        purchase_helper::AnalysisErrorEvent {
                                            generation,
                                            message,
                                        },
                                    );
                                }
                            }
                        }
                    });
                }
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<DesktopState>();
                if state.close_to_tray.load(Ordering::SeqCst)
                    && !state.quitting.load(Ordering::SeqCst)
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
