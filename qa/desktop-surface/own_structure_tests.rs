#[test]
fn own_target_is_feature_gated_and_never_executed_by_test_targets() {
    let cargo = include_str!("Cargo.toml");
    let target = cargo
        .split("name = \"desktop-surface-own-window\"")
        .nth(1)
        .unwrap()
        .split("[[")
        .next()
        .unwrap();
    assert!(target.contains("required-features = [\"own-window-qa-skip-miri\"]"));
    assert!(target.contains("test = false"));
    assert!(target.contains("bench = false"));
    let fixture = include_str!("own_synthetic_main.rs");
    for module in [
        "own_native",
        "own_callbacks",
        "own_gate",
        "live",
        "test_window",
        "read_only_windows",
    ] {
        assert!(!fixture.contains(&format!("mod {module};")));
    }
    let subprocess = include_str!("own_protocol_subprocess.rs");
    assert!(!subprocess.contains("CARGO_BIN_EXE_desktop-surface-own-window"));
    assert!(subprocess.contains("CARGO_BIN_EXE_desktop-surface-own-synthetic"));
}
#[test]
fn own_native_call_surface_excludes_shell_and_foreign_window_mutations() {
    for source in [
        include_str!("own_main.rs"),
        include_str!("own_native.rs"),
        include_str!("own_native_observation.rs"),
    ] {
        for forbidden in [
            "SetParent(",
            "SetWindowLongPtr",
            "SetWindowPos(",
            "SetWindowPlacement(",
            "ShowWindow(",
            "GetShellWindow(",
            "FindWindowEx",
            "EnumWindows(",
            "SendMessage",
            "PostMessage",
            "0x052C",
            "TerminateProcess(",
            "SetForegroundWindow(",
            "tauri::",
            "WebView",
            "app_data_dir",
            "read_only_topology",
            "mod live;",
        ] {
            assert!(!source.contains(forbidden), "forbidden path {forbidden}");
        }
    }
}
#[test]
fn own_qa_never_writes_or_generates_approval_files() {
    let gate = include_str!("own_gate.rs");
    assert!(!gate.contains("create_new"));
    assert!(!gate.contains("fs::write"));
    assert!(!gate.contains("serde_json::to_"));
    let store = include_str!("own_store.rs");
    assert!(store.contains("create_new(true)"));
    assert!(store.contains("hard_link"));
    assert!(!store.contains("create_dir"));
    assert!(!store.contains("remove_file"));
}
