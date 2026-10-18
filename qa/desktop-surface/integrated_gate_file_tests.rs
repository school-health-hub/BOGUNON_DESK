use super::{approval::Error, gate, gate_tests::Fixture};
#[test]
fn artifact_bytes_must_match_actual_locked_file() {
    let f = Fixture::new();
    std::fs::write(&f.binding.executable_path, b"changed actual file").unwrap();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Artifact)));
    assert!(!f.binding.claim_path.exists());
}
#[test]
fn manifest_bytes_must_match_actual_locked_file() {
    let f = Fixture::new();
    std::fs::write(&f.binding.manifest_path, b"changed actual manifest").unwrap();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Artifact)));
}
#[test]
fn descriptor_bytes_must_match_actual_locked_file() {
    let f = Fixture::new();
    std::fs::write(&f.binding.descriptor_path, b"changed actual descriptor").unwrap();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Artifact)));
}
#[test]
fn approval_bytes_must_match_actual_locked_file() {
    let f = Fixture::new();
    std::fs::write(&f.binding.approval_path, b"changed actual record").unwrap();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Artifact)));
}
#[test]
fn factory_holds_one_attempt_and_claim_remains_after_failure() {
    let f = Fixture::new();
    let result = gate::with_attempt(f.input(), |attempt| {
        assert_eq!(attempt.binding(), &f.binding);
        Err::<(), _>("synthetic lifecycle failure")
    });
    assert_eq!(result, Ok(Err("synthetic lifecycle failure")));
    assert!(matches!(gate::evaluate(f.input()), Err(Error::ClaimExists)));
}
