//! Existing Synthetic Driver and sealed Memory backend, through the real Gate execution boundary.
use super::{synchronous_driver::Driver, tests::fixture::fixture};
use crate::{
    integrated_runner::{
        evidence::{Evidence, UnixSeconds},
        gate_tests::Fixture,
        result::{Cleanup, Delivery, Lifecycle, Proof, StageName},
    },
    native_contract::failure_cleanup::Fact,
};
fn success_exit(
    r: &crate::integrated_runner::result::RunResult<
        crate::native_contract::ownership_receipt::Synthetic,
    >,
) -> u8 {
    r.exit_code(
        Delivery::Succeeded,
        Delivery::Succeeded,
        Delivery::Succeeded,
    )
}
#[test]
fn actual_synthetic_driver_is_gate_bound_before_evidence() {
    // Given the existing sealed Memory Driver; When admitted exactly once; Then A+B and its sanitized snapshot bind to this claim.
    let f = Fixture::new();
    let a = f.attempt();
    let r = a.execute_synthetic(Driver::new(fixture())).unwrap();
    assert_eq!(r.lifecycle(), Lifecycle::Succeeded);
    assert_eq!(r.proof(), Proof::VerifiedAB);
    let evidence = Evidence::snapshot(&a, r.clone(), UnixSeconds::new(123)).unwrap();
    let json = serde_json::to_value(&evidence).unwrap();
    assert_eq!(json["observation_provenance"], "SYNTHETIC_ONLY");
    assert_eq!(json["lifecycle_steps"][8]["status"], "COMPLETED");
    let mut store = crate::integrated_runner::store::Store::new(&a).unwrap();
    assert!(store.save(&evidence).is_ok());
    assert_eq!(success_exit(&r), 0);
}
#[test]
fn missing_callback_preserves_actual_driver_failure_and_cleanup_success() {
    // Given delayed creation notice in the existing backend; When driven; Then cleanup success cannot erase the missing completion.
    let f = Fixture::new();
    let a = f.attempt();
    let mut h = fixture();
    h.backend.delay = true;
    let r = a.execute_synthetic(Driver::new(h)).unwrap();
    assert_eq!(r.lifecycle(), Lifecycle::Failed(StageName::CreateCompleted));
    assert_eq!(r.cleanup(), Cleanup::Succeeded);
    assert_eq!(r.proof(), Proof::Missing);
    let value = serde_json::to_value(&r).unwrap();
    assert_eq!(value["lifecycle_failure_cause"], "PROTOCOL");
    assert_eq!(success_exit(&r), 3);
}
#[test]
fn actual_driver_cleanup_failure_is_not_hidden_by_original_protocol_failure() {
    // Given missing callback and failed destruction observation; When driven; Then both original and cleanup failures persist.
    let f = Fixture::new();
    let a = f.attempt();
    let mut h = fixture();
    h.backend.delay = true;
    h.backend.cleanup_fault = Some(Fact::Destroy);
    let r = a.execute_synthetic(Driver::new(h)).unwrap();
    let value = serde_json::to_value(&r).unwrap();
    assert_eq!(value["lifecycle_failure_cause"], "PROTOCOL");
    assert_eq!(value["cleanup_failure_fact"], "DESTROY");
    assert_eq!(r.cleanup(), Cleanup::Failed);
    assert_eq!(success_exit(&r), 5);
}
#[test]
fn actual_driver_cleanup_unknown_blocks_success() {
    // Given missing callback and uncertain residual observation; When driven; Then cleanup uncertainty dominates.
    let f = Fixture::new();
    let a = f.attempt();
    let mut h = fixture();
    h.backend.delay = true;
    h.backend.cleanup_fault = Some(Fact::Residual);
    h.backend.cleanup_unknown = true;
    let r = a.execute_synthetic(Driver::new(h)).unwrap();
    let value = serde_json::to_value(&r).unwrap();
    assert_eq!(value["lifecycle_failure_cause"], "PROTOCOL");
    assert_eq!(value["cleanup_failure_fact"], "RESIDUAL");
    assert_eq!(r.cleanup(), Cleanup::Unknown);
    assert_eq!(success_exit(&r), 5);
}
#[test]
fn same_attempt_refuses_second_actual_driver() {
    // Given an already consumed attempt; When another Driver is submitted; Then it never creates a second surface.
    let f = Fixture::new();
    let a = f.attempt();
    assert!(a.execute_synthetic(Driver::new(fixture())).is_ok());
    assert!(a.execute_synthetic(Driver::new(fixture())).is_err());
}
#[test]
fn actual_driver_result_cannot_rebind_to_other_approval() {
    // Given separate approved claims; When the first report is rebound; Then snapshot creation refuses it.
    let f = Fixture::new();
    let a = f.attempt();
    let other = Fixture::new();
    let b = other.attempt();
    let r = a.execute_synthetic(Driver::new(fixture())).unwrap();
    assert!(Evidence::snapshot(&b, r, UnixSeconds::new(123)).is_err());
}
#[test]
fn lifecycle_failure_still_consumes_execution_attempt() {
    // Given a failed first Driver; When another Driver is submitted; Then retry remains blocked.
    let f = Fixture::new();
    let a = f.attempt();
    let mut h = fixture();
    h.backend.delay = true;
    let r = a.execute_synthetic(Driver::new(h)).unwrap();
    assert_eq!(r.lifecycle(), Lifecycle::Failed(StageName::CreateCompleted));
    assert!(a.execute_synthetic(Driver::new(fixture())).is_err());
}
