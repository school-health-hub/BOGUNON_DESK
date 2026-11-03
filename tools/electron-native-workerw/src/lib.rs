//! WorkerW model bridge and compile-only live adapter. No live execution permit issuer.
#![deny(unsafe_op_in_unsafe_fn)]
// Historical private entry points remain for provenance; only the memory-backed DryRun bridge is public.
#[allow(dead_code)]
mod legacy;
#[allow(dead_code)]
mod lifecycle;
#[allow(dead_code)]
mod ownership;
pub use legacy::dry_run::{
    DryRunBinding, DryRunEngine, DryRunOperation, DryRunReport, DryRunRequest,
};
pub mod live_contract;
