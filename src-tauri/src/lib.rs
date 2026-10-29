use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg(all(feature = "my-finance-qa", feature = "desktop-surface-qa"))]
compile_error!("MY FINANCE QA and Desktop Surface QA features are mutually exclusive");

mod ai;
mod ai_generation;
mod auth;
mod browser_launcher;
mod main_caller;
mod main_lifetime;
mod main_events;
mod main_channel;
mod main_security;
mod main_window_events;
mod chatgpt;
mod desktop_surface;
mod surface_boundary;
mod surface_broker;
mod launcher;
mod meal;
mod my_finance_backup;
mod my_finance_codec;
mod my_finance_snapshot;
mod my_finance_store;
mod my_finance_commands;
mod my_finance_transfer;
mod notifications;
mod official_document_import;
mod purchase_helper;
mod purchase_settlement;
mod record_helper_import;
mod weather;
mod work_folders;


#[cfg(windows)]
mod main_restore_ipc;
#[cfg(windows)]
mod surface_runtime;
#[cfg(all(windows, feature = "desktop-surface-qa"))]
mod qa_main_startup_diagnostic;
#[cfg(all(test, windows, feature = "desktop-surface-qa"))]
mod qa_main_startup_diagnostic_tests;

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
    let window = main_events::capture(app)?.main(app)?;
    window.show().map_err(|error| error.to_string())?;
    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }
    window.set_focus().map_err(|error| error.to_string())
}

fn navigate_main_window(app: &AppHandle, action_id: &str) -> Result<(), String> {
    show_main_window(app)?;
    main_events::emit(app, main_events::BusinessEvent::Navigate, action_id)
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

fn execute_desktop_action(
    app: AppHandle,
    action_id: String,
) -> Result<DesktopActionOutcome, String> {
    execute_registered_action(&app, &action_id)
}

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

fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|error| error.to_string())?;
    } else {
        manager.disable().map_err(|error| error.to_string())?;
    }
    manager.is_enabled().map_err(|error| error.to_string())
}

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
                        let _ = main_events::emit(app, main_events::BusinessEvent::Notice, message);
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

#[cfg(feature = "my-finance-qa")]
mod my_finance_qa;
#[cfg(feature = "my-finance-qa")]
pub use my_finance_qa::run;

#[cfg(feature = "desktop-surface-qa")]
mod desktop_surface_qa;
#[cfg(feature = "desktop-surface-qa")]
pub use desktop_surface_qa::run;

#[cfg(not(any(feature = "my-finance-qa", feature = "desktop-surface-qa")))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = main_security::configure(tauri::Builder::default());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        let _ = show_main_window(app);
    }));
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(windows)]
    let builder = builder.manage(surface_runtime::SurfaceRuntimeState::inactive());

    builder
        .manage(DesktopState::default())
        .manage(my_finance_commands::FinanceState::default())
        .manage(desktop_surface::DesktopSurfaceCoordinator::default())
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
            main_channel::register_main_channel,
            main_channel::unregister_main_channel,
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
            my_finance_commands::main_commands::my_finance_cancel_backup,
            ai::main_commands::validate_ai_connection,
            ai_generation::main_commands::generate_ai_text,
            chatgpt::commands::main_commands::chatgpt_get_connection_state,
            chatgpt::commands::main_commands::chatgpt_start_sign_in,
            chatgpt::commands::main_commands::chatgpt_disconnect,
            chatgpt::commands::main_commands::chatgpt_list_models,
            chatgpt::commands::main_commands::chatgpt_generate_text,
            main_commands::execute_desktop_action,
            main_commands::open_bogunon_search_result,
            launcher::main_commands::open_quick_memo_url,
            purchase_helper::main_commands::pick_and_analyze_purchase_files,
            purchase_helper::main_commands::analyze_purchase_paths,
            purchase_helper::main_commands::apply_purchase_column_mapping,
            purchase_helper::main_commands::save_purchase_export,
            purchase_helper::main_commands::save_purchase_edufine_export,
            purchase_settlement::main_commands::save_purchase_settlement_export,
            purchase_helper::main_commands::set_purchase_helper_active,
            purchase_helper::main_commands::invalidate_purchase_helper_analysis,
            official_document_import::main_commands::pick_and_extract_official_document,
            official_document_import::main_commands::extract_official_document_path,
            record_helper_import::main_commands::pick_and_extract_record_helper_reports,
            record_helper_import::main_commands::extract_record_helper_paths,
            main_commands::get_autostart_enabled,
            main_commands::set_autostart_enabled,
            main_commands::set_close_to_tray,
            desktop_surface::main_commands::get_desktop_surface_probe,
            desktop_surface::main_commands::begin_desktop_surface_edit,
            desktop_surface::main_commands::complete_desktop_surface_edit,
            desktop_surface::main_commands::cancel_desktop_surface_edit,
            notifications::main_commands::get_notification_settings,
            notifications::main_commands::set_workspace_notifications_enabled,
            notifications::main_commands::set_workspace_notification_reasons,
            notifications::main_commands::mark_daily_summary_sent,
            auth::main_commands::open_auth_url,
            auth::main_commands::secure_session_get,
            auth::main_commands::secure_session_set,
            auth::main_commands::secure_session_remove,
            auth::main_commands::secure_session_clear,
            launcher::main_commands::get_launcher_settings,
            launcher::main_commands::save_launcher_url,
            launcher::main_commands::save_work_portal_url,
            launcher::main_commands::save_work_portal_auto_open_delay,
            launcher::main_commands::replace_account_launcher_links,
            work_folders::main_commands::get_work_folder_favorites,
            work_folders::main_commands::pick_work_folder_favorite,
            work_folders::main_commands::rename_work_folder_favorite,
            work_folders::main_commands::delete_work_folder_favorite,
            work_folders::main_commands::reorder_work_folder_favorites,
            work_folders::main_commands::open_work_folder_favorite,
            meal::main_commands::fetch_bogunon_meal,
            weather::main_commands::fetch_bogunon_weather
        ])
        .setup(|app| {
            main_security::install(app.handle())?;
            #[cfg(all(debug_assertions, windows))]
            app.deep_link().register_all()?;
            create_tray(app.handle())?;
            #[cfg(windows)]
            {
                let state = app.state::<surface_runtime::SurfaceRuntimeState>();
                surface_runtime::launch_qa_surface(app.handle(), &state)
                    .map_err(|error| std::io::Error::other(error))?;
            }
            let state = app.state::<launcher::WorkPortalAutoOpenState>();
            let _ = launcher::schedule_work_portal_auto_open(app.handle(), &state);
            Ok(())
        })
        .on_window_event(main_window_events::handle)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[path = "main_commands/lib.rs"]
pub(crate) mod main_commands;
