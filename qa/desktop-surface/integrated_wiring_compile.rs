//! Compile-fail guards for the integrated entry and provenance boundary.
use super::{integrated_entry, integrated_runner, Native, Synthetic};
use integrated_runner::pipeline::PipelineReport;

#[cfg(probe_wiring_arguments_fields)]
fn arguments_fields(value: integrated_entry::Arguments) {
    let _ = value.manifest;
}
#[cfg(probe_wiring_loaded_fields)]
fn loaded_fields(value: integrated_entry::Loaded) {
    let _ = value.executable;
}
#[cfg(probe_wiring_report_fields)]
fn report_fields(value: PipelineReport<Native>) {
    let _ = value.completed;
}
#[cfg(probe_wiring_report_promotion)]
fn report_promotion(value: PipelineReport<Synthetic>) -> PipelineReport<Native> {
    value
}
#[cfg(probe_wiring_synthetic_entry)]
fn synthetic_entry() {
    let _ = integrated_runner::pipeline::run_synthetic;
}
#[cfg(probe_wiring_report_clone)]
fn report_clone(value: PipelineReport<Native>) {
    let _ = value.clone();
}
