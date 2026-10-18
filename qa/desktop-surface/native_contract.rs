use crate::{disposable_surface::State, surface_event_types::Binding};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    CreateOwnSurface,
    BeginCloseOwnSurface,
    VerifyOwnSurfaceCleanup,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Request {
    pub(super) kind: Kind,
    pub(super) binding: Binding,
    pub(super) sequence: u64,
    pub(super) expected: State,
}
impl Request {
    pub const fn kind(&self) -> Kind {
        self.kind
    }
    pub fn binding(&self) -> &Binding {
        &self.binding
    }
    pub const fn sequence(&self) -> u64 {
        self.sequence
    }
    pub const fn expected(&self) -> State {
        self.expected
    }
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome<P = ownership_receipt::Synthetic> {
    CreateSucceeded(verifier::OwnerReceipt<P>),
    CreateFailed,
    CloseStarted,
    CloseCompleted,
    SurfaceLost,
    CleanupVerified(CleanupProof<P>),
    CleanupPending,
    CleanupFailed,
    NativeOutcomeUnknown,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Response<P = ownership_receipt::Synthetic> {
    pub request: Request,
    pub outcome: Outcome<P>,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CleanupProof<P = ownership_receipt::Synthetic> {
    request: Request,
    owner: verifier::OwnerReceipt<P>,
    finalization: ownership_finalization::FinalizationReceipt<P>,
}
impl<P: PartialEq> CleanupProof<P> {
    pub(super) fn matches(&self, request: &Request, owner: &verifier::OwnerReceipt<P>) -> bool {
        self.request == *request && self.owner == *owner
    }
}
#[path = "native_contract_verifier.rs"]
pub mod verifier;

#[path = "ownership_finalization.rs"]
pub mod ownership_finalization;
#[path = "ownership_receipt.rs"]
pub mod ownership_receipt;

#[cfg(all(windows, not(test)))]
#[path = "native_owner.rs"]
pub mod native_owner;
#[path = "native_owner_policy.rs"]
pub mod owner_policy;

#[path = "native_callback_gate.rs"]
pub mod callback_gate;

#[path = "creator_thread_host.rs"]
pub mod creator_thread_host;
#[cfg(test)]
#[path = "native_owner_capture.rs"]
mod native_capture_model;

#[path = "failure_cleanup.rs"]
pub mod failure_cleanup;

#[path = "final_drain_contract.rs"]
pub mod final_drain_contract;

#[path = "pump_phase.rs"]
pub mod pump_phase;
