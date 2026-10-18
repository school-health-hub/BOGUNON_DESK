use super::{integrated_runner, Native, Synthetic};
use integrated_runner::{
    evidence::Evidence,
    gate::{Attempt, Permit},
    result::RunResult,
    store::Stored,
};

#[cfg(probe_integrated_permit_fields)]
fn permit_fields(value: Permit) {
    let _ = value.binding;
}
#[cfg(probe_integrated_permit_clone)]
fn permit_clone(value: Permit) {
    let _ = value.clone();
}
#[cfg(probe_integrated_permit_send)]
fn permit_send() {
    fn require<T: Send>() {}
    require::<Permit>();
}
#[cfg(probe_integrated_permit_sync)]
fn permit_sync() {
    fn require<T: Sync>() {}
    require::<Permit>();
}
#[cfg(probe_integrated_permit_reuse)]
fn permit_reuse(value: Permit) {
    let _ = value.consume();
    let _ = value.consume();
}
#[cfg(probe_integrated_attempt_fields)]
fn attempt_fields(value: Attempt) {
    let _ = value.binding;
}
#[cfg(probe_integrated_attempt_clone)]
fn attempt_clone(value: Attempt) {
    let _ = value.clone();
}
#[cfg(probe_integrated_result_promotion)]
fn result_promotion(value: RunResult<Synthetic>) -> RunResult<Native> {
    value
}
#[cfg(probe_integrated_evidence_promotion)]
fn evidence_promotion(value: Evidence<Synthetic>) -> Evidence<Native> {
    value
}
#[cfg(probe_integrated_result_fields)]
fn result_fields(value: RunResult<Native>) {
    let _ = value.proof;
}
#[cfg(probe_integrated_evidence_fields)]
fn evidence_fields(value: Evidence<Native>) {
    let _ = value.result;
}
#[cfg(probe_integrated_store_arbitrary_path)]
fn arbitrary_path(path: &std::path::Path) {
    let _ = integrated_runner::store::Store::new(path);
}
#[cfg(probe_integrated_stored_fields)]
fn stored_fields() {
    let _ = Stored {
        sha256: String::new(),
    };
}
#[cfg(probe_integrated_result_external_report)]
fn external_report(
    attempt: &Attempt,
    report: &super::native_contract::creator_thread_host::synchronous_driver::DriverReport<Native>,
) {
    let _ = RunResult::from_driver(attempt, report);
}
#[cfg(probe_integrated_execution_key_fields)]
fn execution_key_fields(attempt: &Attempt) {
    let _ = integrated_runner::gate::ExecutionKey { attempt };
}
#[cfg(probe_integrated_execution_key_clone)]
fn execution_key_clone(key: integrated_runner::gate::ExecutionKey<'_>) {
    let _ = key.clone();
}
#[cfg(probe_integrated_execution_key_reuse)]
fn execution_key_reuse(
    key: integrated_runner::gate::ExecutionKey<'_>,
    report: &super::native_contract::creator_thread_host::synchronous_driver::DriverReport<Native>,
) {
    let _ = key.complete(report);
    let _ = key.complete(report);
}
