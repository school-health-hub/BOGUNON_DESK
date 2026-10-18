//! Compile-only root for the actual non-test QA boundary modules.
//! This file is not a Cargo target and contains no executable entry; Native source is compile-only.

mod async_surface;
mod disposable_surface;
mod evidence_approval;
mod evidence_paths;
mod integrated_entry;
mod integrated_runner;
mod integrated_source;
mod main_boundary;
mod main_boundary_state;
mod native_adapter;
mod native_contract;
mod own_callbacks;
mod own_coordinator;
mod own_result;
mod surface_event_router;
mod surface_event_types;

use native_contract::{
    ownership_finalization::FinalizationReceipt,
    ownership_receipt::{Creation, Native, OwnerReceipt, Synthetic},
    CleanupProof, Request,
};

#[path = "native_ownership_compile.rs"]
mod ownership_probes;

#[path = "native_final_drain_compile.rs"]
mod final_drain_probes;

#[path = "native_pump_phase_compile.rs"]
mod pump_phase_probes;

#[path = "native_sync_driver_compile.rs"]
mod synchronous_driver_probes;

#[path = "integrated_boundary_compile.rs"]
mod integrated_probes;

#[path = "integrated_wiring_compile.rs"]
mod wiring_probes;
