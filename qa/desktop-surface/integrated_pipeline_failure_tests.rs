use super::*;
#[test]
fn actual_write_and_flush_failures_are_observed() {
    for flush in [false, true] {
        let f = Fixture::new();
        let report = run_synthetic(
            f.input(),
            UnixSeconds::new(2),
            &mut FaultWriter {
                flush,
                panic: false,
            },
            &mut Vec::new(),
            |_| Ok(success()),
        );
        assert_eq!(report.completed().exit_code(), 6);
    }
}
#[test]
fn cleanup_failure_dominates_output_failure_and_panic() {
    for panic in [false, true] {
        let f = Fixture::new();
        let report = run_synthetic(
            f.input(),
            UnixSeconds::new(2),
            &mut FaultWriter {
                flush: false,
                panic,
            },
            &mut Vec::new(),
            |_| {
                Ok(RunResult::synthetic(
                    Lifecycle::Failed(crate::integrated_runner::result::StageName::Close),
                    Cleanup::Failed,
                    Proof::Missing,
                ))
            },
        );
        assert_eq!(report.completed().exit_code(), 5);
        assert_eq!(report.completed().result().cleanup(), Cleanup::Failed);
        assert_eq!(
            report.completed().result().lifecycle(),
            Lifecycle::Failed(crate::integrated_runner::result::StageName::Close)
        );
        assert_eq!(
            serde_json::to_value(report.completed().result()).unwrap()["panic_observed"],
            panic
        );
    }
}
#[test]
fn driver_panic_is_unknown_cleanup_and_persistent_claim() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| panic!("synthetic driver panic"),
    );
    assert_eq!(report.completed().exit_code(), 5);
    assert_eq!(report.completed().result().lifecycle(), Lifecycle::Panic);
    assert_eq!(report.completed().result().cleanup(), Cleanup::Unknown);
    assert!(f.binding.claim_path.exists());
    let mut calls = 0;
    let second = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| {
            calls += 1;
            Ok(success())
        },
    );
    assert_eq!(calls, 0);
    assert_eq!(second.completed().exit_code(), 2);
}
#[test]
fn output_panic_after_verified_cleanup_keeps_known_cleanup() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut FaultWriter {
            flush: false,
            panic: true,
        },
        &mut Vec::new(),
        |_| Ok(success()),
    );
    assert_eq!(report.completed().exit_code(), 4);
    assert_eq!(
        report.completed().result().cleanup(),
        Cleanup::NotRequiredVerifiedByProof
    );
}
#[test]
fn stderr_flush_failure_and_missing_proof_do_not_pass() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut FaultWriter {
            flush: true,
            panic: false,
        },
        |_| Ok(success()),
    );
    assert_eq!(report.completed().exit_code(), 6);
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| {
            Ok(RunResult::synthetic(
                Lifecycle::Succeeded,
                Cleanup::Succeeded,
                Proof::Missing,
            ))
        },
    );
    assert_eq!(report.completed().exit_code(), 3);
}
#[test]
fn output_panic_preserves_original_lifecycle_stage() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut FaultWriter {
            flush: false,
            panic: true,
        },
        &mut Vec::new(),
        |_| {
            Ok(RunResult::synthetic(
                Lifecycle::Failed(crate::integrated_runner::result::StageName::Close),
                Cleanup::Succeeded,
                Proof::Missing,
            ))
        },
    );
    assert_eq!(
        report.completed().result().lifecycle(),
        Lifecycle::Failed(crate::integrated_runner::result::StageName::Close)
    );
    assert_eq!(report.completed().exit_code(), 4);
}
