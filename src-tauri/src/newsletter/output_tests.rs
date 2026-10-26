use std::fs;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use tempfile::TempDir;

use super::{
    output_model::{CollisionPolicy, OperationStatus, OutputArtifactInput, OutputSaveRequest},
    output_recovery::{last_success, recover},
    output_storage::save_outputs,
};

fn artifact(id: &str, file_name: &str, bytes: &[u8]) -> OutputArtifactInput {
    OutputArtifactInput {
        stable_id: id.to_owned(),
        file_name: file_name.to_owned(),
        media_type: if file_name.ends_with(".pdf") {
            "application/pdf".to_owned()
        } else {
            "image/png".to_owned()
        },
        sha256: format!("{:x}", Sha256::digest(bytes)),
        bytes_base64: STANDARD.encode(bytes),
    }
}

fn request(operation_id: &str, artifacts: Vec<OutputArtifactInput>) -> OutputSaveRequest {
    let profile = if artifacts.len() == 7 {
        "card-pngs"
    } else if artifacts[0].file_name.ends_with(".pdf") {
        "a4-pdf"
    } else {
        "a4-png"
    };
    OutputSaveRequest {
        target_token: "native-selected-target".to_owned(),
        operation_id: operation_id.to_owned(),
        project_id: "newsletter-project".to_owned(),
        project_revision: 3,
        design_revision: 2,
        profile: profile.to_owned(),
        profile_version: 1,
        created_at: "2026-10-26T00:00:00.000Z".to_owned(),
        collision_policy: CollisionPolicy::Deny,
        artifacts,
    }
}

#[test]
fn save_outputs_when_request_is_valid_writes_bytes_and_success_ledger() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let expected = b"synthetic-png";

    let outcome = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "save-valid",
            vec![artifact("a4-page", "newsletter-a4.png", expected)],
        ),
    )
    .expect("save outputs");

    assert!(matches!(outcome.status, OperationStatus::Succeeded));
    assert_eq!(
        fs::read(target.path().join("newsletter-a4.png")).expect("saved bytes"),
        expected
    );
    assert!(last_success(ledger.path(), "newsletter-project")
        .expect("last success")
        .is_some());
}

#[test]
fn save_outputs_when_file_collides_preserves_existing_file() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let path = target.path().join("newsletter-a4.png");
    fs::write(&path, b"existing").expect("existing file");

    let outcome = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "collision-denied",
            vec![artifact("a4-page", "newsletter-a4.png", b"new")],
        ),
    )
    .expect("classified outcome");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert_eq!(fs::read(path).expect("existing bytes"), b"existing");
}

#[test]
fn save_outputs_when_replace_is_confirmed_backs_up_previous_file() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let path = target.path().join("newsletter-a4.png");
    fs::write(&path, b"previous").expect("existing file");
    let mut replacement = request(
        "replace-confirmed",
        vec![artifact("a4-page", "newsletter-a4.png", b"replacement")],
    );
    replacement.collision_policy = CollisionPolicy::Replace;

    let outcome = save_outputs(ledger.path(), target.path(), "QA output", replacement)
        .expect("replace output");

    assert!(matches!(outcome.status, OperationStatus::Succeeded));
    assert_eq!(fs::read(path).expect("replacement bytes"), b"replacement");
    assert_eq!(
        fs::read(
            ledger
                .path()
                .join("preserved/replace-confirmed/newsletter-a4.png")
        )
        .expect("preserved bytes"),
        b"previous"
    );
}

#[test]
fn save_outputs_when_declared_hash_differs_rejects_bytes() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let mut invalid = artifact("a4-page", "newsletter-a4.png", b"bytes");
    invalid.sha256 = "0".repeat(64);

    let outcome = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request("hash-mismatch", vec![invalid]),
    )
    .expect("classified outcome");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert!(!target.path().join("newsletter-a4.png").exists());
}

#[test]
fn save_outputs_when_batch_partially_fails_reports_partial() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    fs::write(target.path().join("02-card.png"), b"collision").expect("collision fixture");

    let outcome = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "partial-batch",
            (1..=7)
                .map(|index| {
                    artifact(
                        &format!("card-{index}"),
                        &format!("{index:02}-card.png"),
                        format!("card-{index}").as_bytes(),
                    )
                })
                .collect(),
        ),
    )
    .expect("classified outcome");

    assert!(matches!(outcome.status, OperationStatus::Partial));
    assert_eq!(
        fs::read(target.path().join("01-card.png")).expect("first card"),
        b"card-1"
    );
    assert_eq!(
        fs::read(target.path().join("02-card.png")).expect("second card"),
        b"collision"
    );
}

#[test]
fn save_outputs_when_operation_is_retried_is_idempotent() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let first = request(
        "same-operation",
        vec![artifact("a4-page", "newsletter-a4.png", b"first")],
    );
    let retry = request(
        "same-operation",
        vec![artifact("a4-page", "newsletter-a4.png", b"different")],
    );

    let initial =
        save_outputs(ledger.path(), target.path(), "QA output", first).expect("initial save");
    let repeated = save_outputs(ledger.path(), target.path(), "QA output", retry).expect("retry");

    assert_eq!(initial.files[0].sha256, repeated.files[0].sha256);
    assert_eq!(
        fs::read(target.path().join("newsletter-a4.png")).expect("saved file"),
        b"first"
    );
}

#[test]
fn save_outputs_when_file_name_traverses_rejects_request() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");

    let result = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "traversal",
            vec![artifact("a4-page", "../outside.png", b"blocked")],
        ),
    );

    assert!(result.is_err());
    assert!(!target
        .path()
        .parent()
        .expect("parent")
        .join("outside.png")
        .exists());
}

#[test]
fn recover_when_pending_file_hash_matches_marks_operation_successful() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let saved = request(
        "recover-operation",
        vec![artifact("a4-page", "newsletter-a4.png", b"recover")],
    );
    let outcome =
        save_outputs(ledger.path(), target.path(), "QA output", saved).expect("seed output");
    assert!(matches!(outcome.status, OperationStatus::Succeeded));
    let current = ledger.path().join("output-ledger.json");
    let text = fs::read_to_string(&current).expect("ledger text");
    fs::write(&current, text.replace("\"succeeded\"", "\"pending\"")).expect("pending fixture");

    let report = recover(ledger.path()).expect("recover output");

    assert_eq!(report.inspected, 1);
    assert_eq!(report.recovered, 1);
    assert_eq!(report.reconciliation_required, 0);
}

#[test]
fn ledger_when_current_is_corrupted_uses_last_known_good() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "lkg-operation",
            vec![artifact("a4-page", "newsletter-a4.png", b"stable")],
        ),
    )
    .expect("seed output");
    fs::write(ledger.path().join("output-ledger.json"), b"not-json").expect("corrupt current");

    let restored = last_success(ledger.path(), "newsletter-project").expect("load last known good");

    assert!(restored.is_some());
}
