//! Compile rejection probes only; no executable entry or Native invocation.
use super::*;
use native_contract::final_drain_contract::{FinalDrainObservation, FinalizationObservation};
#[cfg(probe_finalization_observation_promotion)]
fn forbidden_a_promotion(
    value: FinalizationObservation<Synthetic>,
) -> FinalizationObservation<Native> {
    value
}
#[cfg(probe_final_drain_observation_promotion)]
fn forbidden_b_promotion(value: FinalDrainObservation<Synthetic>) -> FinalDrainObservation<Native> {
    value
}
#[cfg(probe_native_legacy_verify)]
fn forbidden_native_legacy_verify(
    value: FinalizationReceipt<Native>,
    owner: &OwnerReceipt<Native>,
) {
    let _ = value.verify(owner, &owner.creation().binding);
}
#[cfg(probe_native_a_synthetic)]
fn forbidden_native_a_synthetic(value: FinalizationReceipt<Native>, owner: &OwnerReceipt<Native>) {
    let _ = FinalizationObservation::<Native>::synthetic(value, owner);
}
#[cfg(probe_native_b_synthetic)]
fn forbidden_native_b_synthetic(
    value: &FinalizationObservation<Native>,
    facts: native_contract::final_drain_contract::DrainFacts,
) {
    let _ = FinalDrainObservation::<Native>::synthetic(value, facts);
}
#[cfg(probe_finalization_observation_clone)]
fn forbidden_a_clone(value: FinalizationObservation<Native>) {
    let _ = value.clone();
}
#[cfg(probe_final_drain_observation_clone)]
fn forbidden_b_clone(value: FinalDrainObservation<Native>) {
    let _ = value.clone();
}
#[cfg(probe_finalization_observation_reuse)]
fn forbidden_a_reuse(value: FinalizationObservation<Native>) {
    fn consume(_: FinalizationObservation<Native>) {}
    consume(value);
    consume(value);
}
#[cfg(probe_final_drain_observation_reuse)]
fn forbidden_b_reuse(value: FinalDrainObservation<Native>) {
    fn consume(_: FinalDrainObservation<Native>) {}
    consume(value);
    consume(value);
}
#[cfg(probe_finalization_without_drain_proof)]
fn forbidden_a_only_proof(value: FinalizationObservation<Native>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_drain_without_finalization_proof)]
fn forbidden_b_only_proof(value: FinalDrainObservation<Native>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_owner_finalize_returns_proof)]
fn forbidden_owner_finalize_proof(
    owner: &mut native_contract::native_owner::Owner,
    request: &Request,
) {
    let _: Result<CleanupProof<Native>, _> = owner.finalize(request);
}
#[cfg(probe_finalization_observation_fields)]
fn forbidden_a_fields(receipt: FinalizationReceipt<Native>, owner: OwnerReceipt<Native>) {
    let _ = FinalizationObservation {
        receipt,
        owner,
        stamp: std::rc::Rc::new(()),
        drain_attempted: std::cell::Cell::new(false),
    };
}
#[cfg(probe_final_drain_observation_fields)]
fn forbidden_b_fields(
    request: Request,
    owner: OwnerReceipt<Native>,
    facts: native_contract::final_drain_contract::DrainFacts,
) {
    let _ = FinalDrainObservation {
        request,
        owner,
        stamp: std::rc::Rc::new(()),
        facts,
    };
}
#[cfg(probe_finalization_observation_send)]
fn forbidden_a_send() {
    fn require<T: Send>() {}
    require::<FinalizationObservation<Native>>();
}
#[cfg(probe_final_drain_observation_sync)]
fn forbidden_b_sync() {
    fn require<T: Sync>() {}
    require::<FinalDrainObservation<Native>>();
}
