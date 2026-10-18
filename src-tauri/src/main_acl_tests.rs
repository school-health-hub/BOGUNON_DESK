use std::collections::BTreeMap;
use tauri::utils::{
    acl::{capability::Capability, manifest::Manifest, resolved::Resolved, ExecutionContext},
    platform::Target,
};

#[test]
fn generated_custom_acl_denies_non_main_webviews_even_inside_main_window() {
    // Given the actual compiler-generated manifests and merged capabilities.
    let manifests: BTreeMap<String, Manifest> =
        serde_json::from_str(include_str!("../gen/schemas/acl-manifests.json"))
            .expect("compiler-generated ACL manifests");
    let capabilities: BTreeMap<String, Capability> =
        serde_json::from_str(include_str!("../gen/schemas/capabilities.json"))
            .expect("compiler-generated capabilities");
    let app = &manifests["__app-acl__"];
    let set = &app.permission_sets["main-commands"];
    assert_eq!(set.permissions.len(), 50);
    assert_eq!(app.permissions.len(), 100);

    // When Tauri resolves its real merged ACL, using the locked platform resolver.
    let resolved = Resolved::resolve(&manifests, capabilities, Target::Windows)
        .expect("application ACL resolves");

    // Then the runtime's window OR webview matching rule admits only main webviews.
    assert!(resolved.has_app_acl);
    let custom_commands: Vec<_> = resolved
        .allowed_commands
        .iter()
        .filter(|(command, _)| !command.starts_with("plugin:"))
        .collect();
    assert_eq!(custom_commands.len(), 50);
    for (command, grants) in custom_commands {
        assert_eq!(grants.len(), 1, "{command}");
        for grant in grants {
            assert!(matches!(grant.context, ExecutionContext::Local));
            assert!(
                grant.windows.is_empty(),
                "{command}: window grants also admit child webviews"
            );
            assert_eq!(grant.webviews.len(), 1, "{command}");
            assert_eq!(grant.webviews[0].as_str(), "main", "{command}");
            for (window, webview, allowed) in [
                ("main", "main", true),
                ("main", "child", false),
                ("other", "other", false),
                ("other", "main-child", false),
            ] {
                let matches = grant
                    .webviews
                    .iter()
                    .any(|pattern| pattern.matches(webview))
                    || grant.windows.iter().any(|pattern| pattern.matches(window));
                assert_eq!(matches, allowed, "{command}: {window}/{webview}");
            }
        }
        assert!(!resolved.denied_commands.contains_key(command));
    }
}
