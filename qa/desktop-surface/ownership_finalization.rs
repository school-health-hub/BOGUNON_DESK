use super::ownership_receipt::{Creation, ResourceOwnership, Synthetic};
use super::verifier::OwnerReceipt;
use super::{CleanupProof, Kind, Request};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Confirmation {
    Confirmed,
    Failed,
    Unknown,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalizationReceipt<P = Synthetic> {
    request: Request,
    owner: OwnerReceipt<P>,
    observed: Creation,
    current_thread: u32,
    destroy: Confirmation,
    ledger: Confirmation,
    residual: Option<u32>,
    class_release: Confirmation,
    callback_clear: Confirmation,
    owner_release: Confirmation,
}
#[derive(Debug, Clone)]
pub(super) struct Observations<P = Synthetic> {
    pub owner: OwnerReceipt<P>,
    pub identity: Creation,
    pub current_thread: u32,
    pub destroy: Confirmation,
    pub ledger: Confirmation,
    pub residual: Option<u32>,
    pub class_release: Confirmation,
    pub callback_clear: Confirmation,
    pub owner_release: Confirmation,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyError {
    Request,
    Owner,
    Thread,
    Ownership,
    Destroy,
    Ledger,
    Residual,
    ClassRelease,
    CallbackClear,
    OwnerRelease,
}
impl FinalizationReceipt<Synthetic> {
    pub(super) fn synthetic(request: &Request, observed: Observations) -> Self {
        Self {
            request: request.clone(),
            owner: observed.owner,
            observed: observed.identity,
            current_thread: observed.current_thread,
            destroy: observed.destroy,
            ledger: observed.ledger,
            residual: observed.residual,
            class_release: observed.class_release,
            callback_clear: observed.callback_clear,
            owner_release: observed.owner_release,
        }
    }
}
impl<P: Clone + PartialEq> FinalizationReceipt<P> {
    pub(super) fn validate(
        &self,
        owner: &OwnerReceipt<P>,
        active: &crate::surface_event_types::Binding,
    ) -> Result<(), VerifyError> {
        if self.request.kind() != Kind::VerifyOwnSurfaceCleanup || self.request.binding() != active
        {
            return Err(VerifyError::Request);
        }
        let creation = &owner.creation().binding;
        if active.instance() != creation.instance()
            || active.operation().generation() != creation.operation().generation()
        {
            return Err(VerifyError::Request);
        }
        match self.request.expected() {
            crate::disposable_surface::State::Absent => {}
            crate::disposable_surface::State::Lost(generation)
            | crate::disposable_surface::State::Failed(generation, _)
                if generation == active.operation().generation() => {}
            _ => return Err(VerifyError::Request),
        }
        if &self.owner != owner || self.observed != *owner.creation() {
            return Err(VerifyError::Owner);
        }
        if self.current_thread != owner.creation().creator_thread {
            return Err(VerifyError::Thread);
        }
        if owner.creation().ownership != ResourceOwnership::Owned {
            return Err(VerifyError::Ownership);
        }
        for (value, error) in [
            (self.destroy, VerifyError::Destroy),
            (self.ledger, VerifyError::Ledger),
            (self.class_release, VerifyError::ClassRelease),
            (self.callback_clear, VerifyError::CallbackClear),
            (self.owner_release, VerifyError::OwnerRelease),
        ] {
            match value {
                Confirmation::Confirmed => {}
                Confirmation::Failed | Confirmation::Unknown => return Err(error),
            }
        }
        if self.residual != Some(0) {
            return Err(VerifyError::Residual);
        }
        Ok(())
    }
}
impl<P> FinalizationReceipt<P> {
    pub(super) fn request(&self) -> &Request {
        &self.request
    }
}

impl FinalizationReceipt<Synthetic> {
    pub(super) fn verify(
        self,
        owner: &OwnerReceipt,
        active: &crate::surface_event_types::Binding,
    ) -> Result<CleanupProof, VerifyError> {
        self.validate(owner, active)?;
        Ok(CleanupProof {
            request: self.request.clone(),
            owner: owner.clone(),
            finalization: self,
        })
    }
}

#[cfg(all(windows, not(test)))]
impl FinalizationReceipt<super::ownership_receipt::Native> {
    pub(super) fn observed(
        request: &Request,
        finalization: super::native_owner::Finalized,
        owner: &OwnerReceipt<super::ownership_receipt::Native>,
    ) -> Result<Self, VerifyError> {
        let observed = finalization.observations();
        let receipt = Self {
            request: request.clone(),
            owner: observed.owner,
            observed: observed.identity,
            current_thread: observed.current_thread,
            destroy: observed.destroy,
            ledger: observed.ledger,
            residual: observed.residual,
            class_release: observed.class_release,
            callback_clear: observed.callback_clear,
            owner_release: observed.owner_release,
        };
        receipt.validate(owner, request.binding())?;
        Ok(receipt)
    }
}
