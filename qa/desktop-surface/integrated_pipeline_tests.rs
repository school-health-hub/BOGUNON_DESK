use super::*;
use crate::integrated_runner::{
    gate_tests::Fixture,
    result::{Cleanup, Lifecycle, Proof},
};
use crate::native_contract::ownership_receipt::Synthetic;

#[test]
fn gate_failure_never_enters_driver() {
    let f = Fixture::new();
    let mut input = f.input();
    input.opt_in = None;
    let mut calls = 0;
    let report = run_synthetic(
        input,
        UnixSeconds::new(1),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| {
            calls += 1;
            Ok(RunResult::<Synthetic>::synthetic(
                Lifecycle::Succeeded,
                Cleanup::Succeeded,
                Proof::VerifiedAB,
            ))
        },
    );
    assert_eq!(calls, 0);
    assert_eq!(report.completed().exit_code(), 2);
}

struct FaultWriter {
    flush: bool,
    panic: bool,
}
impl Write for FaultWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if self.panic {
            panic!("synthetic output panic");
        }
        if self.flush {
            Ok(bytes.len())
        } else {
            Err(std::io::ErrorKind::BrokenPipe.into())
        }
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Err(std::io::ErrorKind::BrokenPipe.into())
    }
}
fn success() -> RunResult<Synthetic> {
    RunResult::synthetic(
        Lifecycle::Succeeded,
        Cleanup::NotRequiredVerifiedByProof,
        Proof::VerifiedAB,
    )
}
#[test]
fn normal_pipeline_stores_before_output_and_reports_local_exit() {
    let f = Fixture::new();
    let mut out = Vec::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut out,
        &mut Vec::new(),
        |_| Ok(success()),
    );
    assert_eq!(report.completed().exit_code(), 0);
    let value: serde_json::Value = serde_json::from_slice(&out).unwrap();
    assert_eq!(value["stdout"], "NOT_OBSERVED");
    assert!(value["final_exit_code"].is_null());
    let evidence: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&f.binding.evidence_path).unwrap()).unwrap();
    assert_eq!(evidence["observation_provenance"], "SYNTHETIC_ONLY");
    assert_eq!(evidence["evidence_save_at_snapshot"], "NOT_OBSERVED");
}
#[test]
fn staging_collision_is_retained_as_precise_output_error() {
    let f = Fixture::new();
    let mut out = Vec::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut out,
        &mut Vec::new(),
        |_| {
            std::fs::write(&f.binding.staging_path, b"collision").unwrap();
            Ok(success())
        },
    );
    assert_eq!(
        report.evidence_error(),
        Some(EvidenceFailure::Store(store::Error::Staging))
    );
    assert_eq!(report.completed().exit_code(), 6);
    let value: serde_json::Value = serde_json::from_slice(&out).unwrap();
    assert_eq!(value["evidence_error"], "Store(Staging)");
    assert_eq!(
        std::fs::read(&f.binding.staging_path).unwrap(),
        b"collision"
    );
}
#[test]
fn publish_collision_is_non_overwriting() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| {
            std::fs::write(&f.binding.evidence_path, b"preserve").unwrap();
            Ok(success())
        },
    );
    assert_eq!(
        report.evidence_error(),
        Some(EvidenceFailure::Store(store::Error::Publish))
    );
    assert_eq!(
        std::fs::read(&f.binding.evidence_path).unwrap(),
        b"preserve"
    );
}
#[test]
fn all_binding_rejections_keep_driver_call_count_zero() {
    for case in 0..9 {
        let mut f = Fixture::new();
        if case == 0 {
            f.binding.scope = "OLD_SCOPE".into();
            f.refresh();
        }
        if case == 1 {
            f.binding.runner_id = "OTHER_RUNNER".into();
            f.refresh();
        }
        if case == 8 {
            std::fs::write(&f.binding.claim_path, b"existing").unwrap();
        }
        let mut input = f.input();
        match case {
            2 => input.approval_record = b"",
            3 => input.executable = b"wrong",
            4 => input.source_head = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            5 => input.manifest = b"{}",
            6 => input.descriptor = b"{}",
            7 => input.operator_review = super::super::approval::OperatorReview::NotVerified,
            _ => {}
        }
        let mut calls = 0;
        let report = run_synthetic(
            input,
            UnixSeconds::new(1),
            &mut Vec::new(),
            &mut Vec::new(),
            |_| {
                calls += 1;
                Ok(success())
            },
        );
        assert_eq!(calls, 0, "case {case}");
        assert_eq!(report.completed().exit_code(), 2, "case {case}");
    }
}
#[test]
fn driver_admission_error_is_unknown_without_inventing_panic() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(2),
        &mut Vec::new(),
        &mut Vec::new(),
        |_| Err(gate::ExecutionError::AlreadyExecuted),
    );
    assert_eq!(report.completed().exit_code(), 5);
    assert_eq!(
        report.completed().result().lifecycle(),
        Lifecycle::NotObserved
    );
    assert_eq!(
        report.execution_error(),
        Some(gate::ExecutionError::AlreadyExecuted)
    );
}

#[path = "integrated_pipeline_failure_tests.rs"]
mod failure;
