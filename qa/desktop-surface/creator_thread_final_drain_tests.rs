use super::*;
#[test]
fn cleanup_proof_is_absent_until_final_drain() {
    // Given released Synthetic ownership and a cleanup request.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    // When final callback delivery has not yet run; Then no proof exists in Host.
    assert!(!matches!(
        h.pending.as_ref().map(|response| &response.outcome),
        Some(Outcome::CleanupVerified(_))
    ));
}
#[test]
fn proof_delivery_requires_later_successful_pump_and_preserves_main() {
    // Given closed ownership and authoritative Main state.
    let mut h = closed();
    let before = h.inspect().clone();
    h.verify_cleanup().unwrap();
    assert!(h.backend.finalization.is_some());
    // When the later bounded callback drain succeeds; Then proof is consumed before replacement.
    assert_eq!(h.pump(4), Ok(0));
    assert!(h.pending.is_none());
    assert!(h.backend.finalization.is_none());
    assert_eq!(h.inspect(), &before);
    h.replacement().unwrap();
    h.pump(4).unwrap();
    assert!(matches!(h.state(), State::Available(_)));
}
#[test]
fn missing_finalization_blocks_proof_and_replacement() {
    // Given a pending cleanup whose finalization observation is missing.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.backend.finalization = None;
    // When final drain is requested; Then no proof or replacement is allowed.
    assert!(h.pump(4).is_err());
    assert!(h.replacement().is_err());
}
#[test]
fn final_drain_unknown_blocks_proof_and_preserves_main() {
    // Given successful finalization but an unknown final-drain outcome.
    let mut h = closed();
    let before = h.inspect().clone();
    h.verify_cleanup().unwrap();
    h.backend.final_drain_facts.outcome_known =
        crate::native_contract::ownership_finalization::Confirmation::Unknown;
    // When pumping completes; Then Unknown cannot become cleanup confirmation.
    assert!(h.pump(4).is_err());
    assert_eq!(h.inspect(), &before);
    assert!(h.replacement().is_err());
}
#[test]
fn overflow_after_release_blocks_proof_but_allows_failure_cleanup_admission() {
    // Given successful finalization and callback overflow after owner release.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.backend.overflow = true;
    // When the final pump faults; Then independent cleanup remains reachable without proof.
    assert_eq!(h.pump(4), Err(Error::Overflow));
    assert!(h.failure_cleanup().is_ok());
    assert!(h.pump(4).is_err());
    assert!(h.replacement().is_err());
}
#[test]
fn failure_cleanup_before_final_drain_cannot_issue_proof() {
    // Given a released owner with only observation A retained.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    // When the independent failure cleanup path is chosen; Then normal proof admission closes.
    let _report = h.failure_cleanup().unwrap();
    assert!(h.pump(4).is_err());
    assert!(!matches!(
        h.pending.as_ref().map(|response| &response.outcome),
        Some(Outcome::CleanupVerified(_))
    ));
    assert!(h.replacement().is_err());
}
#[test]
fn nonquiet_final_drain_is_rejected() {
    // Given a callback queue reported non-quiet after finalization.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.backend.final_drain_facts.queue_quiet =
        crate::native_contract::ownership_finalization::Confirmation::Failed;
    // When the final drain is checked; Then cleanup confirmation is rejected.
    assert!(h.pump(4).is_err());
    assert!(h.replacement().is_err());
}
#[test]
fn stopped_host_cannot_issue_postrelease_proof() {
    // Given observation A retained and Host stopped before final drain.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.stop().unwrap();
    // When pumping is requested; Then logical stop cannot stand in for a drain observation.
    assert!(h.pump(4).is_err());
    assert!(h.replacement().is_err());
    assert!(h.failure_cleanup().is_ok());
}
#[test]
fn retired_callback_after_finalization_prevents_proof() {
    // Given owner release and a late captured callback from that retired owner.
    let mut h = closed();
    let before = h.inspect().clone();
    h.verify_cleanup().unwrap();
    h.backend
        .notices
        .push(h.backend.notices_for_test.clone().unwrap());
    // When Host transfers the actual old envelope; Then proof delivery never occurs.
    assert!(h.pump(4).is_err());
    assert_eq!(h.inspect(), &before);
    assert!(h.backend.finalization.is_some());
    assert!(h.replacement().is_err());
}
#[test]
fn reentry_after_finalization_prevents_proof() {
    // Given A retained while a creator-thread operation is entered.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.entered = true;
    // When final pumping reenters; Then fault is latched before backend proof work.
    assert_eq!(h.pump(4), Err(Error::Reentry));
    h.entered = false;
    assert!(h.backend.finalization.is_some());
    assert!(h.replacement().is_err());
}
#[test]
fn zero_budget_after_finalization_prevents_proof() {
    // Given A retained; When the final pump has no budget; Then A cannot become proof.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    assert_eq!(h.pump(0), Err(Error::Budget));
    assert!(h.backend.finalization.is_some());
    assert!(h.replacement().is_err());
}
#[test]
fn duplicate_backend_proof_issuance_is_rejected() {
    // Given the Host has consumed one successfully verified proof.
    let mut h = closed();
    h.verify_cleanup().unwrap();
    h.pump(4).unwrap();
    let request = h.backend.cleanup_request.clone().unwrap();
    // When backend completion is repeated; Then no second proof can be returned.
    assert!(matches!(
        h.backend.complete_cleanup(&request, 4).outcome,
        Outcome::NativeOutcomeUnknown
    ));
}
