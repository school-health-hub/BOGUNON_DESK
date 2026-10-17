use crate::own_approval::{parse, Actual, EVIDENCE_SCOPE, SCOPE};
use std::path::Path;

fn packet() -> (Vec<u8>, Vec<u8>) {
    use sha2::{Digest, Sha256};
    let runtime = serde_json::json!({
        "source_sha": "a".repeat(40), "executable_path": "C:\\QA\\own.exe",
        "sha256": "b".repeat(64), "scope": SCOPE
    });
    let bytes = serde_json::to_vec(&runtime).unwrap();
    let descriptor = serde_json::json!({
        "runtime_manifest_sha256": format!("{:x}", Sha256::digest(&bytes)),
        "evidence_path": "C:\\QA\\own-evidence.json",
        "staging_path": "C:\\QA\\own-evidence.staging.json",
        "run_claim_path": "C:\\QA\\own-run.claim", "scope": EVIDENCE_SCOPE
    });
    (bytes, serde_json::to_vec(&descriptor).unwrap())
}
fn accepted(runtime: &[u8], descriptor: &[u8]) -> bool {
    parse(
        runtime,
        descriptor,
        Actual {
            executable: Path::new("C:\\QA\\own.exe"),
            artifact_sha: &"b".repeat(64),
            source_sha: &"a".repeat(40),
            descriptor: Path::new("C:\\QA\\descriptor.json"),
        },
    )
    .is_ok()
}
#[test]
fn own_packet_accepts_exact_scope_and_hash_link() {
    // Given an independently reviewable fixed packet, when parsed, then linkage is accepted.
    let (runtime, descriptor) = packet();
    assert!(accepted(&runtime, &descriptor));
}
#[test]
fn own_packet_rejects_old_runner_scope() {
    let (runtime, descriptor) = packet();
    let runtime = String::from_utf8(runtime)
        .unwrap()
        .replace(SCOPE, "9B2C_READ_ONLY_OWN_WINDOWS");
    assert!(!accepted(runtime.as_bytes(), &descriptor));
}
#[test]
fn own_packet_rejects_unknown_fields() {
    let (runtime, descriptor) = packet();
    let mut value: serde_json::Value = serde_json::from_slice(&descriptor).unwrap();
    value["approved"] = true.into();
    assert!(!accepted(&runtime, &serde_json::to_vec(&value).unwrap()));
}
#[test]
fn own_packet_rejects_manifest_replacement() {
    let (mut runtime, descriptor) = packet();
    runtime.push(b' ');
    assert!(!accepted(&runtime, &descriptor));
}
#[test]
fn own_packet_rejects_output_outside_descriptor_parent() {
    let (runtime, descriptor) = packet();
    let descriptor = String::from_utf8(descriptor).unwrap().replace(
        "C:\\\\QA\\\\own-evidence.json",
        "C:\\\\OTHER\\\\own-evidence.json",
    );
    assert!(!accepted(&runtime, descriptor.as_bytes()));
}
#[test]
fn own_packet_rejects_unembedded_source() {
    let (runtime, descriptor) = packet();
    assert!(parse(
        &runtime,
        &descriptor,
        Actual {
            executable: Path::new("C:\\QA\\own.exe"),
            artifact_sha: &"b".repeat(64),
            source_sha: "UNSET",
            descriptor: Path::new("C:\\QA\\descriptor.json"),
        }
    )
    .is_err());
}
