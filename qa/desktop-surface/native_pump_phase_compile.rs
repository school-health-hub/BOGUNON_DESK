//! Compile-only rejection checks. No dispatcher, thread, or Native execution.
use super::*;
use native_contract::pump_phase::{IntegratedAdmission, Phase, PumpStopObservation};

#[cfg(probe_pump_c_promotion)]
fn c_promotion(value: PumpStopObservation<Synthetic>) -> PumpStopObservation<Native> {
    value
}
#[cfg(probe_pump_admission_promotion)]
fn admission_promotion(value: IntegratedAdmission<Synthetic>) -> IntegratedAdmission<Native> {
    value
}
#[cfg(probe_pump_c_proof)]
fn c_proof(value: PumpStopObservation<Synthetic>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_pump_admission_proof)]
fn admission_proof(value: IntegratedAdmission<Synthetic>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_pump_ab_admission)]
fn ab_admission(value: CleanupProof<Native>) -> IntegratedAdmission<Native> {
    value
}
#[cfg(probe_pump_c_clone)]
fn c_clone(value: PumpStopObservation<Native>) {
    let _ = value.clone();
}
#[cfg(probe_pump_c_reuse)]
fn c_reuse(value: PumpStopObservation<Native>) {
    fn consume(_: PumpStopObservation<Native>) {}
    consume(value);
    consume(value);
}
#[cfg(probe_pump_c_send)]
fn c_send() {
    fn require<T: Send>() {}
    require::<PumpStopObservation<Native>>();
}
#[cfg(probe_pump_c_sync)]
fn c_sync() {
    fn require<T: Sync>() {}
    require::<PumpStopObservation<Native>>();
}
#[cfg(probe_pump_admission_clone)]
fn admission_clone(value: IntegratedAdmission<Native>) {
    let _ = value.clone();
}
#[cfg(probe_pump_native_stop)]
fn native_stop(
    phase: &mut Phase<Native>,
    input: &native_contract::pump_phase::Envelope<Native>,
    facts: native_contract::pump_phase::StopFacts,
) {
    let _ = phase.stop(input, facts);
}
#[cfg(probe_pump_c_fields)]
fn c_fields(owner: OwnerReceipt<Native>, request: Request) {
    let _ = PumpStopObservation {
        owner,
        request,
        stamp: std::rc::Rc::new(()),
        sequence: 1,
        facts: native_contract::pump_phase::StopFacts {
            admission_closed: true,
            in_flight: 0,
            callback_delivery_complete: true,
            reason: native_contract::pump_phase::StopReason::Requested,
            budget: native_contract::pump_phase::Check::Complete,
            deadline: native_contract::pump_phase::Check::Complete,
        },
    };
}
