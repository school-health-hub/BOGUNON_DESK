use crate::{
    evidence_approval::{absolute_disk_path, parse},
    evidence_paths,
};
use sha2::{Digest, Sha256};
use std::path::Path;

fn approval() -> serde_json::Value {
    serde_json::json!({
        "runtime_manifest_sha256": format!("{:x}", Sha256::digest(b"runtime")),
        "evidence_path": "C:\\QA\\evidence.json",
        "staging_path": "C:\\QA\\evidence.staging.json",
        "scope": "9B2F_SANITIZED_EVIDENCE_V1"
    })
}
fn accepted(value: &serde_json::Value, runtime: &[u8]) -> bool {
    parse(
        &serde_json::to_vec(value).expect("synthetic JSON"),
        runtime,
        Path::new("C:\\QA\\approval.json"),
    )
    .is_ok()
}
#[test]
fn approval_is_bound_to_manifest_bytes_and_scope() {
    let mut value = approval();
    assert!(accepted(&value, b"runtime"));
    assert!(!accepted(&value, b"changed"));
    value["scope"] = "APPROVED".into();
    assert!(!accepted(&value, b"runtime"));
}
#[test]
fn missing_or_extra_fields_are_rejected() {
    for key in ["evidence_path", "staging_path"] {
        let mut value = approval();
        value.as_object_mut().expect("object").remove(key);
        assert!(!accepted(&value, b"runtime"));
    }
    let mut value = approval();
    value["auto_approve"] = true.into();
    assert!(!accepted(&value, b"runtime"));
}
#[test]
fn only_explicit_fixed_names_in_approval_directory_are_allowed() {
    for path in [
        "C:\\Other\\evidence.json",
        "C:\\QA\\..\\evidence.json",
        "C:\\QA\\artifact.exe",
        "evidence.json",
    ] {
        let mut value = approval();
        value["evidence_path"] = path.into();
        assert!(!accepted(&value, b"runtime"));
    }
}
#[test]
fn unsafe_windows_path_spellings_are_rejected() {
    for path in [
        "relative",
        "\\\\host\\share\\file",
        "\\\\?\\C:\\QA\\file",
        "C:\\QA\\file:stream",
        "C:\\QA.\\file",
        "C:\\QA \\file",
        "C:\\QA\\.\\file",
    ] {
        assert!(absolute_disk_path(Path::new(path)).is_err());
    }
}
#[test]
fn reparse_attributes_are_fail_closed_without_following_links() {
    assert!(evidence_paths::ordinary_attributes(0).is_ok());
    assert!(evidence_paths::ordinary_attributes(0x400).is_err());
    assert!(evidence_paths::ordinary_attributes(0x410).is_err());
}
#[test]
fn evidence_gate_precedes_native_session_and_never_self_approves() {
    let live = include_str!("live.rs");
    assert!(
        live.find("gate::authorize").expect("gate")
            < live.find("EvidenceSink::from_environment").expect("sink")
    );
    assert!(
        live.find("EvidenceSink::from_environment").expect("sink")
            < live.find("NativeWindows::new").expect("native")
    );
    let store = include_str!("evidence_store.rs");
    assert!(!store.contains("create_dir"));
    assert!(!store.contains("set_var"));
}
