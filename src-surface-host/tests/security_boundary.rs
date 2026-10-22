const MANIFEST: &str = include_str!("../Cargo.toml");
const MAIN: &str = include_str!("../src/main.rs");

#[test]
fn host_has_no_tauri_plugin_finance_or_network_client_dependency() {
    for forbidden in [
        "tauri",
        "plugin",
        "sqlcipher",
        "reqwest",
        "tokio-tungstenite",
    ] {
        assert!(!MANIFEST.to_ascii_lowercase().contains(forbidden));
    }
}

#[test]
fn executable_does_not_start_the_native_runtime() {
    assert!(!MAIN.contains("create_hidden"));
    assert!(!MAIN.contains("EnvironmentRequest::begin"));
    assert!(MAIN.contains("not runtime-authorized"));
}

#[test]
fn renderer_is_local_static_content_without_main_authority() {
    let html = bogunon_desktop_surface_host::renderer::HTML;
    for forbidden in [
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "__TAURI__",
        "Finance",
    ] {
        assert!(!html.contains(forbidden));
    }
}
