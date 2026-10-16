use crate::gate::{opt_in, verify, Approval, GateError};
use std::{cell::Cell, path::Path};

fn approval() -> Approval {
    Approval {
        source_sha: "a".repeat(40),
        executable_path: "C:\\QA\\harness.exe".into(),
        sha256: "b".repeat(64),
        scope: "9B2C_READ_ONLY_OWN_WINDOWS".into(),
    }
}
#[test]
fn approved_manifest_matches_exact_artifact_and_source() {
    let approved = approval();
    assert_eq!(
        verify(
            &approved,
            (
                Path::new(&approved.executable_path),
                &approved.sha256,
                &approved.source_sha
            )
        ),
        Ok(())
    );
}
#[test]
fn wrong_hash_path_scope_or_source_prevents_native_entry() {
    for variant in 0..4 {
        let mut approved = approval();
        match variant {
            0 => approved.sha256 = "c".repeat(64),
            1 => approved.executable_path = "C:\\wrong.exe".into(),
            2 => approved.scope = "attach".into(),
            3 => approved.source_sha = "d".repeat(40),
            _ => unreachable!(),
        }
        let calls = Cell::new(0);
        if verify(
            &approved,
            (
                Path::new("C:\\QA\\harness.exe"),
                &"b".repeat(64),
                &"a".repeat(40),
            ),
        )
        .is_ok()
        {
            calls.set(calls.get() + 1);
        }
        assert_eq!(calls.get(), 0);
    }
}
#[test]
fn absent_or_inexact_opt_in_prevents_native_entry() {
    for value in [None, Some(""), Some("1"), Some("approved_9b2c")] {
        assert_eq!(opt_in(value), Err(GateError::OptIn));
    }
    assert_eq!(opt_in(Some("APPROVED_9B2C")), Ok(()));
}
#[test]
fn manifest_rejects_unknown_fields_and_never_self_approves() {
    let input = r#"{"source_sha":"a","executable_path":"C:\\QA\\harness.exe","sha256":"b","scope":"9B2C_READ_ONLY_OWN_WINDOWS","auto_approve":true}"#;
    assert!(serde_json::from_str::<Approval>(input).is_err());
    assert!(verify(
        &approval(),
        (Path::new("relative.exe"), &"b".repeat(64), &"a".repeat(40))
    )
    .is_err());
}
#[test]
fn gate_errors_carry_no_paths_handles_or_environment_values() {
    for error in [
        GateError::OptIn,
        GateError::Manifest,
        GateError::Artifact,
        GateError::Source,
        GateError::Environment,
    ] {
        let output = format!("{error:?}");
        assert!(!output.contains(':') && !output.contains('\\'));
    }
}
#[test]
fn default_source_does_not_include_live_modules_without_feature() {
    let root = include_str!("verification.rs");
    for module in ["live", "live_permissions", "test_window"] {
        assert!(!root.contains(&format!("mod {module};")));
    }
    let live = include_str!("live.rs");
    assert!(!live.contains("#[test]"));
    let manifest = include_str!("Cargo.toml");
    assert!(manifest
        .contains("required-features = [\"live-windows-skip-miri\"]\ntest = false\nbench = false"));
    assert!(!include_str!("synthetic_main.rs").contains("mod live;"));
    assert!(!include_str!("synthetic_main.rs").contains("mod test_window;"));
    assert!(
        live.find("gate::authorize()").unwrap() < live.find("NativeWindows::new(permit)").unwrap()
    );
}
#[test]
fn window_code_has_no_forbidden_mutation_calls_or_foreign_handle_input() {
    let native = include_str!("test_window.rs");
    for api in [
        "SetParent(",
        "SetWindowLongPtr",
        "SetWindowPos(",
        "SetWindowPlacement(",
        "SendMessage",
        "052C",
        "ShowWindow(",
        "SetForegroundWindow(",
    ] {
        assert!(!native.contains(api));
    }
    assert!(native.contains("new(_: LivePermit)"));
    assert!(!include_str!("live.rs").contains("std::env::args"));
}
