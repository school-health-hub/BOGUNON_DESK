//! Compile-only root for the actual non-test QA boundary modules.
//! This file is not a Cargo target and contains no native owner or executable entry.

mod async_surface;
mod disposable_surface;
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

#[cfg(probe_proof_promotion)]
fn forbidden_proof_promotion(value: CleanupProof<Synthetic>) -> CleanupProof<Native> {
    value
}
#[cfg(probe_owner_promotion)]
fn forbidden_owner_promotion(value: OwnerReceipt<Synthetic>) -> OwnerReceipt<Native> {
    value
}
#[cfg(probe_finalization_promotion)]
fn forbidden_finalization_promotion(
    value: FinalizationReceipt<Synthetic>,
) -> FinalizationReceipt<Native> {
    value
}
#[cfg(probe_native_owner_constructor)]
fn forbidden_native_owner_constructor(value: Creation) -> OwnerReceipt<Native> {
    OwnerReceipt::<Native>::synthetic(value)
}
#[cfg(probe_native_finalization_constructor)]
fn forbidden_native_finalization_constructor(
    request: Request,
    owner: OwnerReceipt<Native>,
) -> FinalizationReceipt<Native> {
    FinalizationReceipt::<Native>::synthetic(&request, owner)
}
#[cfg(probe_main_inspection)]
fn forbidden_main_inspection(adapter: &native_adapter::Adapter) {
    let _ = adapter.inspect();
}
#[cfg(probe_private_proof_fields)]
fn forbidden_proof_fields(
    request: Request,
    owner: OwnerReceipt<Native>,
    finalization: FinalizationReceipt<Native>,
) -> CleanupProof<Native> {
    CleanupProof {
        request,
        owner,
        finalization,
    }
}

#[cfg(probe_synthetic_owner_constructor)]
fn forbidden_synthetic_owner_constructor(value: Creation) -> OwnerReceipt<Synthetic> {
    OwnerReceipt::<Synthetic>::synthetic(value)
}
#[cfg(probe_owner_mutation)]
fn forbidden_owner_mutation(
    owner: &mut OwnerReceipt<Synthetic>,
    binding: surface_event_types::Binding,
) {
    owner.creation().binding = binding;
}
