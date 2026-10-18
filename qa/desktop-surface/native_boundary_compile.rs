//! Compile-only root for the actual non-test QA boundary modules.
//! This file is not a Cargo target and contains no executable entry; Native source is compile-only.

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

#[cfg(probe_native_owner_send)]
fn forbidden_native_owner_send() {
    fn require<T: Send>() {}
    require::<native_contract::native_owner::Owner>();
}
#[cfg(probe_native_owner_sync)]
fn forbidden_native_owner_sync() {
    fn require<T: Sync>() {}
    require::<native_contract::native_owner::Owner>();
}
#[cfg(probe_native_created_fields)]
fn forbidden_created_fields(value: Creation) {
    let _ = native_contract::native_owner::Created { facts: value };
}
#[cfg(probe_native_owner_observed)]
fn forbidden_native_observed(value: native_contract::native_owner::Created) {
    let _ = OwnerReceipt::<Native>::observed(value);
}
#[cfg(probe_native_finalized_fields)]
fn forbidden_finalized_fields(value: OwnerReceipt<Native>, request: Request) {
    let _ = native_contract::native_owner::Finalized {
        observed: native_contract::ownership_finalization::Observations {
            identity: value.creation().clone(),
            owner: value,
            current_thread: 1,
            destroy: native_contract::ownership_finalization::Confirmation::Confirmed,
            ledger: native_contract::ownership_finalization::Confirmation::Confirmed,
            residual: Some(0),
            class_release: native_contract::ownership_finalization::Confirmation::Confirmed,
            callback_clear: native_contract::ownership_finalization::Confirmation::Confirmed,
            owner_release: native_contract::ownership_finalization::Confirmation::Confirmed,
        },
    };
    let _ = request;
}

#[cfg(probe_host_send)]
fn forbidden_host_send() {
    fn require<T: Send>() {}
    require::<
        native_contract::creator_thread_host::Host<
            native_contract::creator_thread_host::NativeBackend,
        >,
    >();
}
#[cfg(probe_host_sync)]
fn forbidden_host_sync() {
    fn require<T: Sync>() {}
    require::<
        native_contract::creator_thread_host::Host<
            native_contract::creator_thread_host::NativeBackend,
        >,
    >();
}
#[cfg(probe_response_promotion)]
fn forbidden_response_promotion(
    value: native_contract::Response<Synthetic>,
) -> native_contract::Response<Native> {
    value
}
#[cfg(probe_envelope_promotion)]
fn forbidden_envelope_promotion(
    value: native_contract::creator_thread_host::Envelope<Synthetic>,
) -> native_contract::creator_thread_host::Envelope<Native> {
    value
}
#[cfg(probe_envelope_fields)]
fn forbidden_envelope_fields(owner: OwnerReceipt<Native>, binding: surface_event_types::Binding) {
    let _ = native_contract::creator_thread_host::Envelope {
        owner,
        binding,
        sequence: 1,
        source: native_contract::creator_thread_host::Source::OwnWndProc,
        kind: own_coordinator::NoticeKind::Created,
    };
}
#[cfg(probe_host_inspection)]
fn forbidden_host_inspection(
    host: &native_contract::creator_thread_host::Host<
        native_contract::creator_thread_host::NativeBackend,
    >,
) {
    let _ = host.inspect();
}
#[cfg(probe_backend_sealing)]
struct UntrustedBackend;
#[cfg(probe_backend_sealing)]
impl native_contract::creator_thread_host::Backend for UntrustedBackend {
    type Provenance = Native;
    type CleanupCapability = std::convert::Infallible;
    fn cleanup_capability(
        &mut self,
    ) -> Result<Self::CleanupCapability, native_contract::failure_cleanup::Error> {
        Err(native_contract::failure_cleanup::Error::Unknown)
    }
    fn cleanup_failure(
        &mut self,
        capability: Self::CleanupCapability,
    ) -> native_contract::failure_cleanup::Observation<Native> {
        match capability {}
    }
    fn dispatch(&mut self, request: &Request) -> native_contract::Response<Native> {
        native_contract::Response {
            request: request.clone(),
            outcome: native_contract::Outcome::NativeOutcomeUnknown,
        }
    }
    fn drain(
        &mut self,
    ) -> Result<
        Vec<native_contract::creator_thread_host::Envelope<Native>>,
        native_contract::creator_thread_host::Error,
    > {
        Ok(Vec::new())
    }
    fn complete_cleanup(
        &mut self,
        request: &Request,
        _: usize,
    ) -> native_contract::Response<Native> {
        self.dispatch(request)
    }
    fn stop(&mut self) -> Result<(), native_contract::creator_thread_host::Error> {
        Ok(())
    }
}

#[cfg(probe_cleanup_observation_promotion)]
fn forbidden_cleanup_observation_promotion(
    value: native_contract::failure_cleanup::Observation<Synthetic>,
) -> native_contract::failure_cleanup::Observation<Native> {
    value
}
#[cfg(probe_cleanup_observation_proof)]
fn forbidden_cleanup_observation_proof(
    value: native_contract::failure_cleanup::Observation<Native>,
) -> CleanupProof<Native> {
    value
}
#[cfg(probe_cleanup_capability_send)]
fn forbidden_cleanup_capability_send() {
    fn require<T: Send>() {}
    require::<native_contract::native_owner::FailureCapability>();
}
#[cfg(probe_cleanup_capability_sync)]
fn forbidden_cleanup_capability_sync() {
    fn require<T: Sync>() {}
    require::<native_contract::native_owner::FailureCapability>();
}
#[cfg(probe_cleanup_capability_clone)]
fn forbidden_cleanup_capability_clone(value: native_contract::native_owner::FailureCapability) {
    let _ = value.clone();
}
#[cfg(probe_cleanup_capability_reuse)]
fn forbidden_cleanup_capability_reuse(value: native_contract::native_owner::FailureCapability) {
    fn consume(_: native_contract::native_owner::FailureCapability) {}
    consume(value);
    consume(value);
}
#[cfg(probe_cleanup_observation_fields)]
fn forbidden_cleanup_observation_fields(
    facts: native_contract::failure_cleanup::Facts,
) -> native_contract::failure_cleanup::Observation<Native> {
    native_contract::failure_cleanup::Observation {
        resources: native_contract::failure_cleanup::Resources::Owned,
        facts,
        provenance: std::marker::PhantomData,
    }
}

#[cfg(probe_cleanup_capability_fields)]
fn forbidden_cleanup_capability_fields() -> native_contract::native_owner::FailureCapability {
    native_contract::native_owner::FailureCapability {
        lease: std::rc::Rc::new(()),
        token: 1,
        binding: None,
        receipt: None,
    }
}

#[path = "native_final_drain_compile.rs"]
mod final_drain_probes;

#[path = "native_pump_phase_compile.rs"]
mod pump_phase_probes;
