use crate::{
    evidence_approval,
    evidence_record::Record,
    evidence_store::{self, EvidenceSink, Publication, SaveError},
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
fn directory() -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "surface-evidence-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&path).expect("new synthetic directory");
    path
}
fn paths(dir: &Path) -> evidence_approval::ApprovedPaths {
    let value = serde_json::json!({
        "runtime_manifest_sha256": format!("{:x}", Sha256::digest(b"runtime")),
        "evidence_path": dir.join("evidence.json"),
        "staging_path": dir.join("evidence.staging.json"),
        "scope": "9B2F_SANITIZED_EVIDENCE_V1"
    });
    evidence_approval::parse(
        &serde_json::to_vec(&value).expect("JSON"),
        b"runtime",
        &dir.join("approval.json"),
    )
    .expect("explicit synthetic approval")
}
fn clean(dir: &Path) {
    for name in ["evidence.json", "evidence.staging.json"] {
        let path = dir.join(name);
        if path.exists() {
            fs::remove_file(path).expect("own synthetic file");
        }
    }
    fs::remove_dir(dir).expect("own empty synthetic directory");
}
#[test]
fn real_filesystem_publication_verifies_and_retains_identical_staging() {
    let dir = directory();
    let mut sink = EvidenceSink::open(paths(&dir)).expect("approved directory");
    assert!(!dir.join("evidence.json").exists());
    assert_eq!(evidence_store::save(&mut sink, &Record::default()), Ok(()));
    let bytes = fs::read(dir.join("evidence.json")).expect("published");
    assert_eq!(
        bytes,
        fs::read(dir.join("evidence.staging.json")).expect("staging")
    );
    let value: serde_json::Value = serde_json::from_slice(&bytes).expect("fixed JSON");
    assert_eq!(value["schema_version"], 2);
    assert_eq!(
        evidence_store::save(&mut sink, &Record::default()),
        Err(SaveError::Write)
    );
    drop(sink);
    clean(&dir);
}
#[test]
fn existing_output_or_staging_is_never_overwritten() {
    for name in ["evidence.json", "evidence.staging.json"] {
        let dir = directory();
        fs::write(dir.join(name), b"original").expect("synthetic original");
        assert!(EvidenceSink::open(paths(&dir)).is_err());
        assert_eq!(fs::read(dir.join(name)).expect("original"), b"original");
        clean(&dir);
    }
}
#[test]
fn missing_parent_and_approval_file_fail_without_creating_paths() {
    let dir = directory();
    let missing = dir.join("not-created");
    assert!(EvidenceSink::open(paths(&missing)).is_err());
    assert!(!missing.exists());
    assert!(crate::evidence_paths::read_locked(&dir.join("approval.json")).is_err());
    assert!(!dir.join("approval.json").exists());
    clean(&dir);
}
#[test]
fn destination_created_after_gate_is_not_overwritten() {
    let dir = directory();
    let mut sink = EvidenceSink::open(paths(&dir)).expect("sink");
    fs::write(dir.join("evidence.json"), b"original").expect("collision");
    assert_eq!(
        evidence_store::save(&mut sink, &Record::default()),
        Err(SaveError::Publish)
    );
    assert_eq!(
        fs::read(dir.join("evidence.json")).expect("original"),
        b"original"
    );
    drop(sink);
    clean(&dir);
}
#[test]
fn staging_created_after_gate_is_not_overwritten() {
    let dir = directory();
    let mut sink = EvidenceSink::open(paths(&dir)).expect("sink");
    fs::write(dir.join("evidence.staging.json"), b"original").expect("collision");
    assert_eq!(
        evidence_store::save(&mut sink, &Record::default()),
        Err(SaveError::Write)
    );
    assert!(!dir.join("evidence.json").exists());
    drop(sink);
    clean(&dir);
}
struct Fault {
    phase: SaveError,
    trace: Vec<&'static str>,
    partial: Vec<u8>,
}
impl Publication for Fault {
    fn encode(&mut self, record: &Record) -> Result<Vec<u8>, SaveError> {
        self.trace.push("encode");
        if self.phase == SaveError::Serialize {
            return Err(SaveError::Serialize);
        }
        serde_json::to_vec(record).map_err(|_| SaveError::Serialize)
    }
    fn stage_verified(&mut self, bytes: &[u8]) -> Result<(), SaveError> {
        self.trace.push("stage");
        self.partial.extend_from_slice(&bytes[..2]);
        match self.phase {
            SaveError::Write => Err(SaveError::Write),
            SaveError::Verify => Err(SaveError::Verify),
            _ => Ok(()),
        }
    }
    fn publish(&mut self) -> Result<(), SaveError> {
        self.trace.push("publish");
        Err(SaveError::Publish)
    }
}
#[test]
fn serialization_partial_write_verification_and_publish_faults_stop_in_order() {
    for phase in [
        SaveError::Serialize,
        SaveError::Write,
        SaveError::Verify,
        SaveError::Publish,
    ] {
        let expected = format!("{phase:?}");
        let mut fault = Fault {
            phase,
            trace: vec![],
            partial: vec![],
        };
        let error = evidence_store::save(&mut fault, &Record::default()).expect_err("injected");
        assert_eq!(format!("{error:?}"), expected);
        if error == SaveError::Serialize {
            assert_eq!(fault.trace, ["encode"]);
        } else if error == SaveError::Publish {
            assert_eq!(fault.trace, ["encode", "stage", "publish"]);
        } else {
            assert_eq!(fault.trace, ["encode", "stage"]);
            assert_eq!(fault.partial.len(), 2);
        }
    }
}
#[test]
fn permission_denial_is_injected_without_changing_user_acl() {
    struct Denied;
    impl Publication for Denied {
        fn stage_verified(&mut self, _: &[u8]) -> Result<(), SaveError> {
            let error = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
            assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied);
            Err(SaveError::Write)
        }
        fn publish(&mut self) -> Result<(), SaveError> {
            panic!("must not publish")
        }
    }
    assert_eq!(
        evidence_store::save(&mut Denied, &Record::default()),
        Err(SaveError::Write)
    );
}
