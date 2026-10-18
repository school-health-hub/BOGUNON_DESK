//! Compile-only guards for the single-use Driver and provenance-bound report.
use super::*;
use native_contract::creator_thread_host::{
    synchronous_driver::{Driver, DriverReport},
    Host, NativeBackend,
};

#[cfg(probe_driver_report_promotion)]
fn report_promotion(value: DriverReport<Synthetic>) -> DriverReport<Native> {
    value
}
#[cfg(probe_driver_report_proof)]
fn report_proof(value: DriverReport<Synthetic>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_driver_report_fields)]
fn report_fields() -> DriverReport<Native> {
    DriverReport {
        lifecycle: Ok(()),
        proof: None,
        failure_cleanup: None,
    }
}
#[cfg(probe_driver_fields)]
fn driver_fields(host: Host<NativeBackend>) -> Driver<NativeBackend> {
    Driver {
        host,
        attempted: false,
    }
}
#[cfg(probe_driver_constructor)]
fn constructor(host: Host<NativeBackend>) -> Driver<NativeBackend> {
    Driver::new(host)
}
#[cfg(probe_driver_native_constructor)]
fn native_constructor() -> Driver<NativeBackend> {
    Driver::native(main_boundary_state::Authoritative::synthetic())
}
#[cfg(probe_driver_replacement)]
fn replacement(value: &mut Driver<NativeBackend>) {
    let _ = value.replacement();
}
#[cfg(probe_driver_host_access)]
fn host_access(value: Driver<NativeBackend>) {
    let _ = value.host;
}
#[cfg(probe_driver_clone)]
fn clone_driver(value: Driver<NativeBackend>) {
    let _ = value.clone();
}
#[cfg(probe_driver_report_clone)]
fn clone_report(value: DriverReport<Native>) {
    let _ = value.clone();
}
#[cfg(probe_driver_send)]
fn send_driver() {
    fn require<T: Send>() {}
    require::<Driver<NativeBackend>>();
}
#[cfg(probe_driver_sync)]
fn sync_driver() {
    fn require<T: Sync>() {}
    require::<Driver<NativeBackend>>();
}
#[cfg(probe_driver_proof_take)]
fn take_proof(value: &mut Host<NativeBackend>) {
    let _ = value.take_driver_proof();
}
#[cfg(probe_driver_completion_field)]
fn completion(value: Host<NativeBackend>) {
    let _ = value.completion;
}
