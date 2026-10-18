//! Separate synchronous QA contracts; no entrypoint, Native calls, or operator authentication.
#[path = "integrated_approval.rs"]
pub mod approval;
#[path = "integrated_claim.rs"]
mod claim;
#[path = "integrated_gate.rs"]
pub mod gate;
#[cfg(test)]
#[path = "integrated_gate_tests.rs"]
pub(super) mod gate_tests;

pub const RUNNER_ID: &str = "BOGUNON_9B3J_SYNC_NATIVE_QA";
pub const SCOPE: &str = "9B3J_SINGLE_SYNC_OWN_WINDOW_AB_ONLY";
pub const EVIDENCE_NAMESPACE: &str = "9B3J_SYNC_NATIVE_EVIDENCE_V1";
pub const OPT_IN_NAME: &str = "BOGUNON_9B3J_SYNC_QA_OPT_IN";
pub const OPT_IN_VALUE: &str = "SEPARATELY_APPROVED_9B3J";
pub const API_SCOPE: &str =
    "OWN_CREATE_DESTROY_IDENTITY_LEDGER_FINALIZE_CALLBACK_DRAIN_NO_OS_DISPATCH";
#[path = "integrated_evidence.rs"]
pub mod evidence;
#[cfg(test)]
#[path = "integrated_gate_file_tests.rs"]
mod gate_file_tests;
#[path = "integrated_result.rs"]
pub mod result;
#[path = "integrated_store.rs"]
pub mod store;
