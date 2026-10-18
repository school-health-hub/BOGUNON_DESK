use super::*;
#[test]
fn finalization_failure_blocks_proof() {
    // Given destroy observation failure; When driven; Then finalization fails.
    let r = execute(|m, req| {
        if req.kind() == Kind::VerifyOwnSurfaceCleanup {
            m.fault = Fault::Destroy;
        }
        None
    });
    failed(&r, Stage::Finalization);
}
#[test]
fn final_drain_failure_blocks_proof() {
    // Given nonquiet final callback drain; When driven; Then A alone cannot succeed.
    let mut d = driver();
    d.host.backend.final_drain_facts.queue_quiet = Confirmation::Failed;
    failed(&d.run().unwrap(), Stage::FinalDrain);
}
#[test]
fn cleanup_unknown_is_separate_and_blocks_success() {
    // Given lifecycle and cleanup uncertainty; When driven; Then cleanup Unknown is retained.
    let mut d = driver();
    d.host.backend.fault = Fault::Unknown;
    d.host.backend.cleanup_fault = Some(cleanup::Fact::Residual);
    d.host.backend.cleanup_unknown = true;
    let r = d.run().unwrap();
    failed(&r, Stage::Create);
    assert_eq!(
        r.failure_cleanup().unwrap().as_ref().unwrap().cleanup,
        cleanup::Status::Unknown(cleanup::Fact::Residual)
    );
}
#[test]
fn successful_failure_cleanup_never_changes_original_failure() {
    // Given missing creation completion; When cleanup succeeds; Then lifecycle stays failed.
    let mut d = driver();
    d.host.backend.delay = true;
    let r = d.run().unwrap();
    failed(&r, Stage::CreateCompleted);
    let cleanup = r.failure_cleanup().unwrap().as_ref().unwrap();
    assert_eq!(cleanup.cleanup, cleanup::Status::Succeeded);
    assert_eq!(cleanup.original, Some(Error::Protocol));
}
#[test]
fn failed_failure_cleanup_is_preserved() {
    // Given Unknown create plus destroy failure; When driven; Then cleanup failure remains visible.
    let mut d = driver();
    d.host.backend.fault = Fault::Unknown;
    d.host.backend.cleanup_fault = Some(cleanup::Fact::Destroy);
    let r = d.run().unwrap();
    assert_eq!(
        r.failure_cleanup().unwrap().as_ref().unwrap().cleanup,
        cleanup::Status::Failed(cleanup::Fact::Destroy)
    );
    assert!(!r.succeeded());
}
#[test]
fn missing_ab_completion_cannot_succeed_after_close() {
    // Given cleanup pending without A+B observations; When driven; Then close Absent cannot yield proof.
    let r = execute(|_, req| {
        if req.kind() == Kind::VerifyOwnSurfaceCleanup {
            response(req, Outcome::CleanupPending)
        } else {
            None
        }
    });
    failed(&r, Stage::FinalDrain);
}
#[test]
fn second_run_cannot_recreate_or_retry_cleanup() {
    // Given one complete attempt; When run again; Then no second Native request is admitted.
    let mut d = driver();
    assert!(d.run().unwrap().succeeded());
    assert_eq!(d.run().unwrap_err(), AdmissionError::AlreadyRun);
    assert!(!d.host.backend.cleanup_issued);
}
#[test]
fn second_failed_run_cannot_repeat_cleanup() {
    // Given an already cleaned failure; When run again; Then terminal cleanup is not retried.
    let mut d = driver();
    d.host.backend.fault = Fault::Unknown;
    assert!(!d.run().unwrap().succeeded());
    assert_eq!(d.run().unwrap_err(), AdmissionError::AlreadyRun);
    assert!(d.host.backend.cleanup_issued);
}
#[test]
fn main_state_preserved_on_success_and_failure() {
    // Given immutable Main ownership; When either driver outcome occurs; Then every Main field matches.
    for fault in [Fault::None, Fault::PartialCreate, Fault::Unknown] {
        let mut d = driver();
        d.host.backend.fault = fault;
        let before = d.host.inspect().clone();
        let _ = d.run().unwrap();
        assert_eq!(d.host.inspect(), &before);
    }
}
#[test]
fn closed_absent_without_ab_cannot_supply_driver_proof() {
    // Given a closed Host without finalization; When proof is requested; Then Absent is insufficient.
    let mut host = super::super::super::tests::fixture::closed();
    assert_eq!(host.state(), State::Absent);
    assert_eq!(host.take_driver_proof(), Err(Error::Protocol));
}
#[test]
fn host_completion_proof_is_consumed_once() {
    // Given accepted A+B; When completion is taken twice; Then the second take is rejected.
    let mut host = super::super::super::tests::fixture::closed();
    host.verify_cleanup().unwrap();
    host.pump(16).unwrap();
    assert!(host.take_driver_proof().is_ok());
    assert_eq!(host.take_driver_proof(), Err(Error::Protocol));
}
#[test]
fn ledger_and_residual_faults_block_driver_success() {
    // Given failed or unknown cleanup facts; When driven; Then no normal proof is retained.
    for fault in [
        Fault::LedgerLive,
        Fault::RemainingUnknown,
        Fault::ClassRelease,
        Fault::CallbackContext,
    ] {
        let mut d = driver();
        d.host.backend.fault = fault;
        failed(&d.run().unwrap(), Stage::Finalization);
    }
}
#[test]
fn replacement_invalidates_previous_host_completion() {
    // Given accepted A+B; When a replacement begins; Then previous proof cannot attest that lifecycle.
    let mut host = super::super::super::tests::fixture::closed();
    host.verify_cleanup().unwrap();
    host.pump(16).unwrap();
    assert!(host.completion.is_some());
    host.replacement().unwrap();
    assert!(host.completion.is_none());
}
#[test]
fn failure_cleanup_invalidates_previous_host_completion() {
    // Given accepted A+B; When terminal failure cleanup runs; Then it cannot provide a normal receipt.
    let mut host = super::super::super::tests::fixture::closed();
    host.verify_cleanup().unwrap();
    host.pump(16).unwrap();
    host.failure_cleanup().unwrap();
    assert!(host.completion.is_none());
    assert!(host.take_driver_proof().is_err());
}
