use super::super::{
    evidence::UnixSeconds,
    gate,
    gate_tests::Fixture,
    result::{Cleanup, Lifecycle, Proof, RunResult},
};
use super::*;
use crate::native_contract::ownership_receipt::Synthetic;
fn snapshot(attempt: &Attempt) -> Evidence<Synthetic> {
    Evidence::snapshot(
        attempt,
        RunResult::synthetic(
            Lifecycle::Succeeded,
            Cleanup::NotRequiredVerifiedByProof,
            Proof::VerifiedAB,
        ),
        UnixSeconds::new(123),
    )
    .unwrap()
}
struct Fault {
    point: Option<Point>,
    corrupt: bool,
}
impl Checkpoint for Fault {
    fn check(&mut self, point: Point) -> Result<(), Error> {
        if self.point == Some(point) {
            Err(match point {
                Point::Write => Error::Write,
                Point::Flush => Error::Flush,
                Point::Sync => Error::Sync,
                Point::Reread => Error::Reread,
                Point::Publish => Error::Publish,
            })
        } else {
            Ok(())
        }
    }
    fn reread(&mut self, bytes: &mut Vec<u8>) {
        if self.corrupt {
            bytes.push(0);
        }
    }
}
#[test]
fn published_bytes_match_reread_hash_and_staging() {
    // Given a real Gate attempt; When stored; Then exact staged bytes publish without overwrite.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    let record = snapshot(&a);
    let mut store = Store::new(&a).unwrap();
    let stored = store.save(&record).unwrap();
    let bytes = fs::read(&f.binding.evidence_path).unwrap();
    assert_eq!(stored.sha256(), approval::digest(&bytes));
    assert_eq!(bytes, fs::read(&f.binding.staging_path).unwrap());
    assert_eq!(store.save(&record).unwrap_err(), Error::Duplicate);
}
#[test]
fn staging_collision_preserves_existing_bytes() {
    // Given staging appeared after Gate; When stored; Then it is preserved.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    fs::write(&f.binding.staging_path, b"preserve").unwrap();
    assert_eq!(
        Store::new(&a).unwrap().save(&snapshot(&a)).unwrap_err(),
        Error::Staging
    );
    assert_eq!(fs::read(&f.binding.staging_path).unwrap(), b"preserve");
}
#[test]
fn publish_collision_preserves_existing_bytes() {
    // Given destination appeared after Gate; When publishing; Then it is preserved.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    fs::write(&f.binding.evidence_path, b"preserve").unwrap();
    assert_eq!(
        Store::new(&a).unwrap().save(&snapshot(&a)).unwrap_err(),
        Error::Publish
    );
    assert_eq!(fs::read(&f.binding.evidence_path).unwrap(), b"preserve");
}
#[test]
fn io_failures_retain_staging_without_publication() {
    // Given each narrow I/O failure; When saving; Then no final file is published.
    for point in [
        Point::Write,
        Point::Flush,
        Point::Sync,
        Point::Reread,
        Point::Publish,
    ] {
        let f = Fixture::new();
        let a = gate::evaluate(f.input()).unwrap().consume();
        let mut store = Store::new(&a).unwrap();
        assert!(store
            .save_checked(
                &snapshot(&a),
                &mut Fault {
                    point: Some(point),
                    corrupt: false
                }
            )
            .is_err());
        assert!(f.binding.staging_path.exists());
        assert!(!f.binding.evidence_path.exists());
    }
}
#[test]
fn reread_hash_mismatch_blocks_publish() {
    // Given corrupted reread; When saved; Then publication is refused.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    assert_eq!(
        Store::new(&a)
            .unwrap()
            .save_checked(
                &snapshot(&a),
                &mut Fault {
                    point: None,
                    corrupt: true
                }
            )
            .unwrap_err(),
        Error::HashMismatch
    );
    assert!(!f.binding.evidence_path.exists());
}
#[test]
fn foreign_record_cannot_use_other_approved_destination() {
    // Given independent approved attempts; When cross-bound save is attempted; Then it fails before staging.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    let other = Fixture::new();
    let b = gate::evaluate(other.input()).unwrap().consume();
    assert_eq!(
        Store::new(&a).unwrap().save(&snapshot(&b)).unwrap_err(),
        Error::Binding
    );
    assert!(!f.binding.staging_path.exists());
}
#[test]
fn snapshot_excludes_paths_and_never_self_attests_save_or_output() {
    // Given pre-save snapshot; When serialized; Then sanitized closed fields only are emitted.
    let f = Fixture::new();
    let a = gate::evaluate(f.input()).unwrap().consume();
    let bytes = serde_json::to_vec(&snapshot(&a)).unwrap();
    let text = String::from_utf8(bytes).unwrap();
    let value: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert!(!text.contains("artifact.exe"));
    assert!(!text.contains("_path"));
    assert_eq!(value["observation_provenance"], "SYNTHETIC_ONLY");
    assert_eq!(value["evidence_save_at_snapshot"], "NOT_OBSERVED");
    assert_eq!(value["stdout_at_snapshot"], "NOT_OBSERVED");
    assert_eq!(value["snapshot_unix_seconds"], 123);
}
