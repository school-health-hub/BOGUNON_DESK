use std::{cell::Cell, fs, io::Write, path::Path};

#[cfg(windows)]
use std::process::Command;

use atomic_write_file::AtomicWriteFile;
use tempfile::TempDir;

use super::{artifact, request};
use crate::newsletter::{
    output_ledger::OutputLedger,
    output_model::{CollisionPolicy, OperationRecord, OperationStatus},
    output_paths::safe_target,
    output_recovery::{last_success, recover},
    output_storage::{save_outputs, save_outputs_with_test_io},
};

fn atomic_write_fixture(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = AtomicWriteFile::open(path).map_err(|error| error.to_string())?;
    file.write_all(bytes).map_err(|error| error.to_string())?;
    file.flush().map_err(|error| error.to_string())?;
    file.as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    file.commit().map_err(|error| error.to_string())
}

fn fail_after_atomic_open(path: &Path, reason: &str) -> Result<(), String> {
    let _uncommitted = AtomicWriteFile::open(path).map_err(|error| error.to_string())?;
    Err(reason.to_owned())
}

#[test]
fn ledger_when_current_and_last_known_good_are_corrupted_rejects_load() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "corrupt-both-ledgers",
            vec![artifact("a4-page", "newsletter-a4.png", b"stable")],
        ),
    )
    .expect("seed output");
    fs::write(ledger.path().join("output-ledger.json"), b"not-json")
        .expect("corrupt current ledger");
    fs::write(
        ledger.path().join("output-ledger.last-known-good.json"),
        b"not-json",
    )
    .expect("corrupt last known good ledger");

    let result = last_success(ledger.path(), "newsletter-project");

    assert!(result.is_err());
}

#[test]
fn save_outputs_when_ledger_root_is_file_rejects_before_writing_output() {
    let ledger_parent = TempDir::new().expect("ledger parent temp directory");
    let ledger_file = ledger_parent.path().join("ledger-file");
    fs::write(&ledger_file, b"not-a-directory").expect("ledger file fixture");
    let target = TempDir::new().expect("target temp directory");

    let result = save_outputs(
        &ledger_file,
        target.path(),
        "QA output",
        request(
            "ledger-write-failure",
            vec![artifact("a4-page", "newsletter-a4.png", b"output")],
        ),
    );

    assert!(result.is_err());
    assert!(!target.path().join("newsletter-a4.png").exists());
}

#[test]
fn save_outputs_when_backup_path_is_blocked_preserves_existing_file() {
    let ledger = TempDir::new().expect("ledger temp directory");
    fs::write(ledger.path().join("preserved"), b"blocked-directory")
        .expect("blocked backup path fixture");
    let target = TempDir::new().expect("target temp directory");
    let existing_path = target.path().join("newsletter-a4.png");
    fs::write(&existing_path, b"existing").expect("existing output fixture");
    let mut replacement = request(
        "blocked-backup",
        vec![artifact("a4-page", "newsletter-a4.png", b"replacement")],
    );
    replacement.collision_policy = CollisionPolicy::Replace;

    let outcome = save_outputs(ledger.path(), target.path(), "QA output", replacement)
        .expect("classified output failure");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert_eq!(
        fs::read(existing_path).expect("preserved existing output"),
        b"existing"
    );
}

#[test]
fn save_outputs_when_destination_is_directory_classifies_failure() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let destination = target.path().join("newsletter-a4.png");
    fs::create_dir(&destination).expect("non-file destination fixture");

    let outcome = save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "invalid-destination",
            vec![artifact("a4-page", "newsletter-a4.png", b"output")],
        ),
    )
    .expect("classified destination failure");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert!(destination.is_dir());
}

#[cfg(windows)]
#[test]
fn safe_target_when_directory_is_junction_rejects_reparse_point() {
    let fixture = TempDir::new().expect("junction fixture directory");
    let target = TempDir::new().expect("junction target directory");
    let junction = fixture.path().join("output-junction");
    let status = Command::new("cmd")
        .arg("/C")
        .arg("mklink")
        .arg("/J")
        .arg(&junction)
        .arg(target.path())
        .status()
        .expect("run mklink junction command");
    assert!(status.success(), "Windows junction fixture creation failed");

    let result = safe_target(&junction);

    assert!(result.is_err());
    fs::remove_dir(&junction).expect("remove junction fixture");
}

#[test]
fn save_outputs_when_file_succeeds_then_ledger_fails_requires_reconciliation() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    save_outputs(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "last-normal-output",
            vec![artifact("a4-page", "last-normal.png", b"normal")],
        ),
    )
    .expect("seed last normal output");

    let output_committed = Cell::new(false);
    let mut save_ledger = |ledger: &OutputLedger<'_>, operations: Vec<OperationRecord>| {
        if output_committed.get() {
            Err("Newsletter 출력 원장을 저장할 수 없습니다.".to_owned())
        } else {
            ledger.save(operations)
        }
    };
    let mut write_output = |path: &Path, bytes: &[u8]| {
        atomic_write_fixture(path, bytes)?;
        output_committed.set(true);
        Ok(())
    };
    let outcome = save_outputs_with_test_io(
        ledger.path(),
        target.path(),
        "QA output",
        request(
            "ledger-after-output",
            vec![artifact("a4-page", "needs-recovery.png", b"recoverable")],
        ),
        &mut save_ledger,
        &mut write_output,
    )
    .expect("classified ledger failure");

    assert!(matches!(
        outcome.status,
        OperationStatus::ReconciliationRequired
    ));
    assert_eq!(
        fs::read(target.path().join("needs-recovery.png")).expect("committed output"),
        b"recoverable"
    );
    let previous = last_success(ledger.path(), "newsletter-project")
        .expect("last successful output")
        .expect("seed output record");
    assert_eq!(previous.operation_id, "last-normal-output");

    let report = recover(ledger.path()).expect("reconcile committed output");

    assert_eq!(report.inspected, 1);
    assert_eq!(report.recovered, 1);
    assert_eq!(report.reconciliation_required, 0);
    let recovered = last_success(ledger.path(), "newsletter-project")
        .expect("recovered output query")
        .expect("recovered output record");
    assert_eq!(recovered.operation_id, "ledger-after-output");
}

#[test]
fn save_outputs_when_permission_is_denied_preserves_existing_file_and_records_failure() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let existing_path = target.path().join("protected.png");
    fs::write(&existing_path, b"existing").expect("existing output fixture");
    let mut replacement = request(
        "permission-denied",
        vec![artifact("a4-page", "protected.png", b"replacement")],
    );
    replacement.collision_policy = CollisionPolicy::Replace;

    let mut save_ledger =
        |ledger: &OutputLedger<'_>, operations: Vec<OperationRecord>| ledger.save(operations);
    let mut write_output = |path: &Path, _bytes: &[u8]| {
        fail_after_atomic_open(path, "Newsletter 출력 파일을 기록할 권한이 없습니다.")
    };
    let outcome = save_outputs_with_test_io(
        ledger.path(),
        target.path(),
        "QA output",
        replacement,
        &mut save_ledger,
        &mut write_output,
    )
    .expect("classified permission failure");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert_eq!(
        outcome.files[0].failure_reason.as_deref(),
        Some("Newsletter 출력 파일을 기록할 권한이 없습니다.")
    );
    assert_eq!(
        fs::read(&existing_path).expect("preserved existing output"),
        b"existing"
    );
    assert!(last_success(ledger.path(), "newsletter-project")
        .expect("last success query")
        .is_none());
    assert_eq!(
        fs::read_dir(target.path())
            .expect("target directory")
            .count(),
        1
    );
}

#[test]
fn save_outputs_when_storage_is_full_preserves_existing_file_and_records_failure() {
    let ledger = TempDir::new().expect("ledger temp directory");
    let target = TempDir::new().expect("target temp directory");
    let existing_path = target.path().join("protected.png");
    fs::write(&existing_path, b"existing").expect("existing output fixture");
    let mut replacement = request(
        "storage-full",
        vec![artifact("a4-page", "protected.png", b"replacement")],
    );
    replacement.collision_policy = CollisionPolicy::Replace;

    let mut save_ledger =
        |ledger: &OutputLedger<'_>, operations: Vec<OperationRecord>| ledger.save(operations);
    let mut write_output = |path: &Path, _bytes: &[u8]| {
        fail_after_atomic_open(path, "Newsletter 출력 저장 공간이 부족합니다.")
    };
    let outcome = save_outputs_with_test_io(
        ledger.path(),
        target.path(),
        "QA output",
        replacement,
        &mut save_ledger,
        &mut write_output,
    )
    .expect("classified storage full failure");

    assert!(matches!(outcome.status, OperationStatus::Failed));
    assert_eq!(
        outcome.files[0].failure_reason.as_deref(),
        Some("Newsletter 출력 저장 공간이 부족합니다.")
    );
    assert_eq!(
        fs::read(&existing_path).expect("preserved existing output"),
        b"existing"
    );
    assert!(last_success(ledger.path(), "newsletter-project")
        .expect("last success query")
        .is_none());
    assert_eq!(
        fs::read_dir(target.path())
            .expect("target directory")
            .count(),
        1
    );
}
