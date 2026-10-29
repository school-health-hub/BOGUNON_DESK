use super::{dispatch, dispatch_async, Identity, Observed, Pinned};
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
command_case!(
    my_finance_load_snapshot,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_list_income,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_create_income,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_update_income,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_delete_income,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_replace_phase2,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_export_backup,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_select_backup,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_inspect_backup,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_restore_backup,
    "main_commands/my_finance_commands.rs"
);
command_case!(
    my_finance_cancel_backup,
    "main_commands/my_finance_commands.rs"
);
command_case!(validate_ai_connection, "main_commands/ai.rs");
command_case!(generate_ai_text, "main_commands/ai_generation.rs");
command_case!(
    chatgpt_get_connection_state,
    "main_commands/chatgpt_commands.rs"
);
command_case!(chatgpt_start_sign_in, "main_commands/chatgpt_commands.rs");
command_case!(chatgpt_disconnect, "main_commands/chatgpt_commands.rs");
command_case!(chatgpt_list_models, "main_commands/chatgpt_commands.rs");
command_case!(chatgpt_generate_text, "main_commands/chatgpt_commands.rs");
command_case!(execute_desktop_action, "main_commands/lib.rs");
command_case!(open_bogunon_search_result, "main_commands/lib.rs");
command_case!(open_quick_memo_url, "main_commands/launcher.rs");
command_case!(
    pick_and_analyze_purchase_files,
    "main_commands/purchase_helper.rs"
);
command_case!(analyze_purchase_paths, "main_commands/purchase_helper.rs");
command_case!(
    apply_purchase_column_mapping,
    "main_commands/purchase_helper.rs"
);
command_case!(save_purchase_export, "main_commands/purchase_helper.rs");
command_case!(
    save_purchase_edufine_export,
    "main_commands/purchase_helper.rs"
);
command_case!(
    save_purchase_settlement_export,
    "main_commands/purchase_settlement.rs"
);
command_case!(
    set_purchase_helper_active,
    "main_commands/purchase_helper.rs"
);
command_case!(
    invalidate_purchase_helper_analysis,
    "main_commands/purchase_helper.rs"
);
command_case!(
    pick_and_extract_official_document,
    "main_commands/official_document_import.rs"
);
command_case!(
    extract_official_document_path,
    "main_commands/official_document_import.rs"
);
command_case!(
    pick_and_extract_record_helper_reports,
    "main_commands/record_helper_import.rs"
);
command_case!(
    extract_record_helper_paths,
    "main_commands/record_helper_import.rs"
);
command_case!(get_autostart_enabled, "main_commands/lib.rs");
command_case!(set_autostart_enabled, "main_commands/lib.rs");
command_case!(set_close_to_tray, "main_commands/lib.rs");
command_case!(
    get_desktop_surface_probe,
    "main_commands/desktop_surface.rs"
);
command_case!(
    begin_desktop_surface_edit,
    "main_commands/desktop_surface.rs"
);
command_case!(
    complete_desktop_surface_edit,
    "main_commands/desktop_surface.rs"
);
command_case!(
    cancel_desktop_surface_edit,
    "main_commands/desktop_surface.rs"
);
command_case!(get_notification_settings, "main_commands/notifications.rs");
command_case!(
    set_workspace_notifications_enabled,
    "main_commands/notifications.rs"
);
command_case!(
    set_workspace_notification_reasons,
    "main_commands/notifications.rs"
);
command_case!(mark_daily_summary_sent, "main_commands/notifications.rs");
command_case!(open_auth_url, "main_commands/auth.rs");
command_case!(secure_session_get, "main_commands/auth.rs");
command_case!(secure_session_set, "main_commands/auth.rs");
command_case!(secure_session_remove, "main_commands/auth.rs");
command_case!(secure_session_clear, "main_commands/auth.rs");
command_case!(get_launcher_settings, "main_commands/launcher.rs");
command_case!(save_launcher_url, "main_commands/launcher.rs");
command_case!(save_work_portal_url, "main_commands/launcher.rs");
command_case!(
    save_work_portal_auto_open_delay,
    "main_commands/launcher.rs"
);
command_case!(replace_account_launcher_links, "main_commands/launcher.rs");
command_case!(get_work_folder_favorites, "main_commands/work_folders.rs");
command_case!(pick_work_folder_favorite, "main_commands/work_folders.rs");
command_case!(rename_work_folder_favorite, "main_commands/work_folders.rs");
command_case!(delete_work_folder_favorite, "main_commands/work_folders.rs");
command_case!(
    reorder_work_folder_favorites,
    "main_commands/work_folders.rs"
);
command_case!(open_work_folder_favorite, "main_commands/work_folders.rs");
command_case!(fetch_bogunon_meal, "main_commands/meal.rs");
command_case!(fetch_bogunon_weather, "main_commands/weather.rs");
command_case!(my_finance_qa_info, "main_commands/my_finance_qa.rs");
command_case!(register_main_channel, "main_channel.rs");
command_case!(unregister_main_channel, "main_channel.rs");
