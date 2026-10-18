use super::identity::{dispatch, dispatch_async, Identity, Observed, Pinned};
use std::{cell::Cell, sync::Arc};

fn check_command(name: &str, source: &str) {
    let definition = source
        .split("#[tauri::command]")
        .skip(1)
        .find(|part| {
            part.split('{')
                .next()
                .unwrap()
                .contains(&format!("fn {name}("))
        })
        .unwrap_or_else(|| panic!("command definition missing: {name}"));
    let (signature, body) = definition.split_once('{').unwrap();
    assert!(
        signature.contains("caller: tauri::Webview"),
        "{name}: injected identity missing"
    );
    let asynchronous = signature.contains("async fn");
    let expected = if asynchronous {
        "crate::main_caller::run_async(&caller,"
    } else {
        "crate::main_caller::run(&caller,"
    };
    assert!(
        body.trim_start().starts_with(expected),
        "{name}: body precedes guard"
    );
    let pinned = Pinned {
        webview: Arc::new(Identity),
        window: Arc::new(Identity),
    };
    for scenario in 0..6 {
        let mut observed = Observed {
            webview_label: "main",
            window_label: "main",
            caller_webview: Some(Arc::clone(&pinned.webview)),
            caller_window: Some(Arc::clone(&pinned.window)),
            registered_webview: Some(Arc::clone(&pinned.webview)),
            registered_window: Some(Arc::clone(&pinned.window)),
        };
        match scenario {
            0 => {}
            1 => observed.webview_label = "surface",
            2 => observed.caller_webview = Some(Arc::new(Identity)),
            3 => observed.caller_window = Some(Arc::new(Identity)),
            4 => observed.registered_webview = Some(Arc::new(Identity)),
            5 => observed.registered_window = Some(Arc::new(Identity)),
            _ => unreachable!(),
        }
        let effects = Cell::new([0; 4]);
        let factory = Cell::new(0);
        let authorization = pinned.authorize(observed);
        let result = if asynchronous {
            poll_ready(dispatch_async(authorization, || {
                factory.set(1);
                async {
                    effects.set([1; 4]);
                    Ok::<_, String>(17)
                }
            }))
        } else {
            dispatch(authorization, || {
                effects.set([1; 4]);
                Ok::<_, String>(17)
            })
        };
        if scenario == 0 {
            assert!(matches!(result, Ok(17)), "{name}: Main rejected");
            assert_eq!(effects.get(), [1; 4]);
        } else {
            assert!(result.is_err(), "{name}: invalid identity admitted");
            assert_eq!(
                effects.get(),
                [0; 4],
                "{name}: credential/file/network/state effect"
            );
            assert_eq!(factory.get(), 0, "{name}: denied future constructed");
        }
    }
}
struct NoWake;
impl std::task::Wake for NoWake {
    fn wake(self: Arc<Self>) {}
}
fn poll_ready<T>(future: impl std::future::Future<Output = T>) -> T {
    let waker = std::task::Waker::from(Arc::new(NoWake));
    let mut context = std::task::Context::from_waker(&waker);
    match std::pin::pin!(future).poll(&mut context) {
        std::task::Poll::Ready(value) => value,
        std::task::Poll::Pending => panic!("pure dispatch pending"),
    }
}
macro_rules! command_case {
    ($name:ident, $source:literal) => {
        #[test]
        fn $name() {
            check_command(stringify!($name), include_str!($source));
        }
    };
}
command_case!(register_main_channel, "main_channel.rs");
command_case!(unregister_main_channel, "main_channel.rs");
command_case!(validate_ai_connection, "ai.rs");
command_case!(generate_ai_text, "ai_generation.rs");
command_case!(chatgpt_get_connection_state, "chatgpt/commands.rs");
command_case!(chatgpt_start_sign_in, "chatgpt/commands.rs");
command_case!(chatgpt_disconnect, "chatgpt/commands.rs");
command_case!(chatgpt_list_models, "chatgpt/commands.rs");
command_case!(chatgpt_generate_text, "chatgpt/commands.rs");
command_case!(execute_desktop_action, "lib.rs");
command_case!(open_bogunon_search_result, "lib.rs");
command_case!(open_quick_memo_url, "launcher.rs");
command_case!(pick_and_analyze_purchase_files, "purchase_helper.rs");
command_case!(analyze_purchase_paths, "purchase_helper.rs");
command_case!(apply_purchase_column_mapping, "purchase_helper.rs");
command_case!(save_purchase_export, "purchase_helper.rs");
command_case!(save_purchase_edufine_export, "purchase_helper.rs");
command_case!(save_purchase_settlement_export, "purchase_settlement.rs");
command_case!(set_purchase_helper_active, "purchase_helper.rs");
command_case!(invalidate_purchase_helper_analysis, "purchase_helper.rs");
command_case!(
    pick_and_extract_official_document,
    "official_document_import.rs"
);
command_case!(
    extract_official_document_path,
    "official_document_import.rs"
);
command_case!(
    pick_and_extract_record_helper_reports,
    "record_helper_import/mod.rs"
);
command_case!(extract_record_helper_paths, "record_helper_import/mod.rs");
command_case!(get_autostart_enabled, "lib.rs");
command_case!(set_autostart_enabled, "lib.rs");
command_case!(set_close_to_tray, "lib.rs");
command_case!(get_desktop_surface_probe, "desktop_surface/mod.rs");
command_case!(get_notification_settings, "notifications.rs");
command_case!(set_workspace_notifications_enabled, "notifications.rs");
command_case!(set_workspace_notification_reasons, "notifications.rs");
command_case!(mark_daily_summary_sent, "notifications.rs");
command_case!(open_auth_url, "auth.rs");
command_case!(secure_session_get, "auth.rs");
command_case!(secure_session_set, "auth.rs");
command_case!(secure_session_remove, "auth.rs");
command_case!(secure_session_clear, "auth.rs");
command_case!(get_launcher_settings, "launcher.rs");
command_case!(save_launcher_url, "launcher.rs");
command_case!(save_work_portal_url, "launcher.rs");
command_case!(save_work_portal_auto_open_delay, "launcher.rs");
command_case!(replace_account_launcher_links, "launcher.rs");
command_case!(get_work_folder_favorites, "work_folders.rs");
command_case!(pick_work_folder_favorite, "work_folders.rs");
command_case!(rename_work_folder_favorite, "work_folders.rs");
command_case!(delete_work_folder_favorite, "work_folders.rs");
command_case!(reorder_work_folder_favorites, "work_folders.rs");
command_case!(open_work_folder_favorite, "work_folders.rs");
command_case!(fetch_bogunon_meal, "meal.rs");
command_case!(fetch_bogunon_weather, "weather.rs");

#[test]
fn inventory_covers_every_registered_command() {
    let sources = [
        include_str!("lib.rs"),
        include_str!("ai.rs"),
        include_str!("ai_generation.rs"),
        include_str!("auth.rs"),
        include_str!("chatgpt/commands.rs"),
        include_str!("launcher.rs"),
        include_str!("purchase_helper.rs"),
        include_str!("purchase_settlement.rs"),
        include_str!("official_document_import.rs"),
        include_str!("record_helper_import/mod.rs"),
        include_str!("desktop_surface/mod.rs"),
        include_str!("notifications.rs"),
        include_str!("work_folders.rs"),
        include_str!("meal.rs"),
        include_str!("weather.rs"),
        include_str!("main_channel.rs"),
    ];
    let handler = sources[0]
        .split(".invoke_handler(tauri::generate_handler![")
        .nth(1)
        .unwrap()
        .split("])")
        .next()
        .unwrap();
    let registered: std::collections::BTreeSet<_> = handler
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.rsplit("::").next().unwrap())
        .collect();
    let mut definitions = std::collections::BTreeSet::new();
    for source in sources {
        for part in source.split("#[tauri::command]").skip(1) {
            let name = part.split("fn ").nth(1).unwrap().split('(').next().unwrap();
            assert!(definitions.insert(name));
            check_command(name, source);
        }
    }
    assert_eq!(registered.len(), 50);
    assert_eq!(
        registered
            .iter()
            .filter(|name| !["register_main_channel", "unregister_main_channel"].contains(name))
            .count(),
        48
    );
    assert_eq!(registered, definitions);
    let cases = include_str!("main_caller_command_tests.rs");
    for name in registered {
        assert!(
            cases.contains(&format!("command_case!({name},"))
                || cases.contains(&format!("    {name},")),
            "missing per-command case: {name}"
        );
    }
}
