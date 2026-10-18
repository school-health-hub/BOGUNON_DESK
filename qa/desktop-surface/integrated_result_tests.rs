use super::*;
use crate::native_contract::ownership_receipt::Synthetic;
#[test]
fn cleanup_unknown_dominates_stdout_failure() {
    // Given cleanup uncertainty and failed output; When reduced; Then cleanup remains highest priority.
    let r = RunResult::<Synthetic>::synthetic(
        Lifecycle::Failed(StageName::Close),
        Cleanup::Unknown,
        Proof::Missing,
    );
    assert_eq!(
        r.exit_code(Delivery::Failed, Delivery::Failed, Delivery::Succeeded),
        5
    );
}
#[test]
fn cleaned_lifecycle_failure_remains_failure() {
    // Given lifecycle failure with successful cleanup; When reduced; Then lifecycle does not become PASS.
    let r = RunResult::<Synthetic>::synthetic(
        Lifecycle::Failed(StageName::Create),
        Cleanup::Succeeded,
        Proof::Missing,
    );
    assert_eq!(
        r.exit_code(
            Delivery::Succeeded,
            Delivery::Succeeded,
            Delivery::Succeeded
        ),
        3
    );
}
fn good() -> RunResult<Synthetic> {
    RunResult::synthetic(
        Lifecycle::Succeeded,
        Cleanup::NotRequiredVerifiedByProof,
        Proof::VerifiedAB,
    )
}
#[test]
fn success_requires_all_three_deliveries() {
    // Given verified Synthetic A+B; When all deliveries pass; Then success is zero.
    assert_eq!(
        good().exit_code(
            Delivery::Succeeded,
            Delivery::Succeeded,
            Delivery::Succeeded
        ),
        0
    );
}
#[test]
fn stdout_failure_has_own_exit_code() {
    // Given otherwise successful run; When stdout fails; Then output failure remains explicit.
    assert_eq!(
        good().exit_code(Delivery::Succeeded, Delivery::Failed, Delivery::Succeeded),
        6
    );
}
#[test]
fn evidence_failure_has_own_exit_code() {
    // Given otherwise successful run; When evidence fails; Then persistence failure remains explicit.
    assert_eq!(
        good().exit_code(Delivery::Failed, Delivery::Succeeded, Delivery::Succeeded),
        6
    );
}
#[test]
fn stderr_failure_has_own_exit_code() {
    // Given otherwise successful run; When stderr fails; Then output failure remains explicit.
    assert_eq!(
        good().exit_code(Delivery::Succeeded, Delivery::Succeeded, Delivery::Failed),
        6
    );
}
#[test]
fn output_not_observed_is_not_success() {
    // Given no final output observation; When reduced; Then success is refused.
    assert_eq!(
        good().exit_code(
            Delivery::Succeeded,
            Delivery::NotObserved,
            Delivery::Succeeded
        ),
        6
    );
}
#[test]
fn gate_blocked_does_not_invent_cleanup_unknown() {
    // Given no Gate admission; When reduced; Then no Native resources were observed.
    let r = RunResult::<Synthetic>::gate_blocked();
    assert_eq!(r.cleanup(), Cleanup::NotObserved);
    assert_eq!(
        r.exit_code(
            Delivery::NotObserved,
            Delivery::NotObserved,
            Delivery::NotObserved
        ),
        2
    );
}
#[test]
fn missing_ab_proof_refuses_success() {
    // Given a claimed lifecycle completion without proof; When reduced; Then success is refused.
    let r =
        RunResult::<Synthetic>::synthetic(Lifecycle::Succeeded, Cleanup::Succeeded, Proof::Missing);
    assert_eq!(
        r.exit_code(
            Delivery::Succeeded,
            Delivery::Succeeded,
            Delivery::Succeeded
        ),
        3
    );
}
#[test]
fn cleanup_failure_dominates_output_failure() {
    // Given failed cleanup and stdout; When reduced; Then cleanup failure takes priority.
    let r = RunResult::<Synthetic>::synthetic(
        Lifecycle::Failed(StageName::Close),
        Cleanup::Failed,
        Proof::Missing,
    );
    assert_eq!(
        r.exit_code(Delivery::Succeeded, Delivery::Failed, Delivery::Succeeded),
        5
    );
}
#[test]
fn panic_with_confirmed_cleanup_retains_panic_exit() {
    // Given confirmed cleanup followed by caught panic; When reduced; Then panic is preserved.
    assert_eq!(
        good().mark_panic().exit_code(
            Delivery::Succeeded,
            Delivery::Succeeded,
            Delivery::Succeeded
        ),
        4
    );
}
#[test]
fn completed_result_records_each_output_independently() {
    // Given simultaneous cleanup and output failure; When recorded; Then both persist despite exit priority.
    let r = RunResult::<Synthetic>::synthetic(
        Lifecycle::Failed(StageName::Close),
        Cleanup::Failed,
        Proof::Missing,
    );
    let completed = delivery::Completed::record(
        r,
        delivery::Deliveries {
            evidence: Delivery::Succeeded,
            stdout: Delivery::Failed,
            stderr: Delivery::Succeeded,
        },
    );
    let value = serde_json::to_value(&completed).unwrap();
    assert_eq!(value["stdout"], "FAILED");
    assert_eq!(value["result"]["failure_cleanup"], "FAILED");
    assert_eq!(completed.exit_code(), 5);
}
