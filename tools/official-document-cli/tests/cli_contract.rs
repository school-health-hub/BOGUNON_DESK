use std::{path::PathBuf, process::Command};

use serde_json::Value;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(name)
}

#[test]
fn emits_bounded_json_when_import_succeeds() {
    // Given
    let path = fixture("synthetic-document.hwpx");

    // When
    let output = Command::new(env!("CARGO_BIN_EXE_official-document-cli"))
        .args(["import", path.to_str().expect("UTF-8 fixture path")])
        .output()
        .expect("CLI process");

    // Then
    assert!(output.status.success());
    assert!(output.stdout.len() <= 2 * 1024 * 1024 + 1024);
    let response: Value = serde_json::from_slice(&output.stdout).expect("JSON response");
    assert_eq!(response["ok"], true);
    assert_eq!(response["result"]["sourceName"], "synthetic-document.hwpx");
    assert_eq!(response["result"]["text"], "합성 공문 HWPX 본문입니다.");
}

#[test]
fn emits_path_free_json_when_import_fails() {
    // Given
    let path = fixture("unsupported-document.txt");

    // When
    let output = Command::new(env!("CARGO_BIN_EXE_official-document-cli"))
        .args(["import", path.to_str().expect("UTF-8 fixture path")])
        .output()
        .expect("CLI process");

    // Then
    assert!(!output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("UTF-8 response");
    assert_eq!(
        stdout.trim(),
        r#"{"ok":false,"error":"PDF, ODT 또는 HWPX 파일만 가져올 수 있습니다."}"#
    );
    assert!(!stdout.contains(
        path.parent()
            .expect("fixture parent")
            .to_string_lossy()
            .as_ref()
    ));
}
