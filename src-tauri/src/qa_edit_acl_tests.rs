//! Uses this build's generated Tauri Context; no App, Window or WebView is created.
use tauri::ipc::Origin;

#[test]
fn generated_qa_context_grants_only_three_edits_to_main_webview(
) -> Result<(), Box<dyn std::error::Error>> {
    let mut context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    assert_eq!(
        context.config().identifier,
        "kr.sungandi.schoolhealthdesk.surfaceqa"
    );
    let authority = context.runtime_authority_mut();
    let commands = [
        "begin_desktop_surface_edit",
        "complete_desktop_surface_edit",
        "cancel_desktop_surface_edit",
    ];
    for command in commands {
        assert!(authority
            .resolve_access(command, "main", "main", &Origin::Local)
            .is_some());
        for (window, view) in [
            ("main", "surface"),
            ("main", "other"),
            ("surface", "surface"),
            ("other", "other"),
        ] {
            assert!(authority
                .resolve_access(command, window, view, &Origin::Local)
                .is_none());
        }
        let remote = Origin::Remote {
            url: "https://example.invalid/".parse()?,
        };
        assert!(authority
            .resolve_access(command, "main", "main", &remote)
            .is_none());
    }
    // Enumerate every resolved permission, including plugin/core, not a sample.
    let manifests = serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/acl-manifests.json"
    )))?;
    let raw = serde_json::from_str(include_str!(concat!(env!("OUT_DIR"), "/capabilities.json")))?;
    let effective = tauri::utils::acl::get_capabilities(context.config(), raw, None)?;
    assert_eq!(effective.len(), 1);
    for cap in effective.values() {
        assert!(cap.windows.is_empty());
        assert_eq!(cap.webviews, ["main"]);
        assert!(cap.local && cap.remote.is_none());
    }
    let resolved = tauri::utils::acl::resolved::Resolved::resolve(
        &manifests,
        effective,
        tauri::utils::platform::Target::Windows,
    )?;
    assert!(resolved.has_app_acl);
    let actual: std::collections::BTreeSet<_> = resolved
        .allowed_commands
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(actual, commands.into_iter().collect());
    for denied in [
        "my_finance_load_snapshot",
        "get_desktop_surface_probe",
        "plugin:store|load",
        "plugin:window|close",
        "unknown",
    ] {
        assert!(context
            .runtime_authority_mut()
            .resolve_access(denied, "main", "main", &Origin::Local)
            .is_none());
    }
    Ok(())
}
