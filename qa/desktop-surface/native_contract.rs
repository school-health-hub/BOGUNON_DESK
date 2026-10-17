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
pub enum Outcome {
    CreateSucceeded(verifier::OwnerReceipt),
    CreateFailed,
    CloseStarted,
    CloseCompleted,
    SurfaceLost,
    CleanupVerified(CleanupProof),
    CleanupFailed,
    NativeOutcomeUnknown,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Response {
    pub request: Request,
    pub outcome: Outcome,
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
