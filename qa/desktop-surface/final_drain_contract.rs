//! Proof scope is the observable callback queue, never future Win32 messages.
use super::{
    ownership_finalization::{Confirmation, FinalizationReceipt, VerifyError},
    ownership_receipt::{OwnerReceipt, Synthetic},
    CleanupProof, Request,
};
use std::{cell::Cell, rc::Rc};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrainScope {
    ObservableCallbackQueue,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DrainFacts {
    pub current_thread: u32,
    pub owner_release: Confirmation,
    pub queue_quiet: Confirmation,
    pub overflow_clear: Confirmation,
    pub reentry_clear: Confirmation,
    pub budget_complete: Confirmation,
    pub outcome_known: Confirmation,
    pub scope: DrainScope,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrainError {
    Owner,
    Request,
    Thread,
    OwnerRelease,
    Queue,
    Overflow,
    Reentry,
    Budget,
    Unknown,
    Duplicate,
}
/// Non-cloneable completion facts; this value does not authorize replacement.
#[derive(Debug)]
pub struct FinalizationObservation<P = Synthetic> {
    receipt: FinalizationReceipt<P>,
    owner: OwnerReceipt<P>,
    stamp: Rc<()>,
    drain_attempted: Cell<bool>,
}
/// Post-release confirmation limited to notices presently observable by this QA owner.
#[derive(Debug)]
pub struct FinalDrainObservation<P = Synthetic> {
    request: Request,
    owner: OwnerReceipt<P>,
    stamp: Rc<()>,
    facts: DrainFacts,
}
impl<P> FinalizationObservation<P> {
    pub(in crate::native_contract) fn request(&self) -> &Request {
        self.receipt.request()
    }
    pub(in crate::native_contract) const fn owner(&self) -> &OwnerReceipt<P> {
        &self.owner
    }
    pub(in crate::native_contract) fn stamp(&self) -> Rc<()> {
        self.stamp.clone()
    }
}
impl<P: Clone + PartialEq> FinalizationObservation<P> {
    fn validated(
        receipt: FinalizationReceipt<P>,
        owner: &OwnerReceipt<P>,
    ) -> Result<Self, VerifyError> {
        receipt.validate(owner, receipt.request().binding())?;
        Ok(Self {
            receipt,
            owner: owner.clone(),
            stamp: Rc::new(()),
            drain_attempted: Cell::new(false),
        })
    }
}
impl<P: Clone + PartialEq> FinalDrainObservation<P> {
    fn validated(
        finalization: &FinalizationObservation<P>,
        facts: DrainFacts,
    ) -> Result<Self, DrainError> {
        if finalization.drain_attempted.replace(true) {
            return Err(DrainError::Duplicate);
        }
        validate_facts(&finalization.owner, &facts)?;
        Ok(Self {
            request: finalization.request().clone(),
            owner: finalization.owner.clone(),
            stamp: finalization.stamp(),
            facts,
        })
    }
}
fn validate_facts<P>(owner: &OwnerReceipt<P>, facts: &DrainFacts) -> Result<(), DrainError> {
    if facts.current_thread != owner.creation().creator_thread {
        return Err(DrainError::Thread);
    }
    for (value, error) in [
        (facts.owner_release, DrainError::OwnerRelease),
        (facts.queue_quiet, DrainError::Queue),
        (facts.overflow_clear, DrainError::Overflow),
        (facts.reentry_clear, DrainError::Reentry),
        (facts.budget_complete, DrainError::Budget),
        (facts.outcome_known, DrainError::Unknown),
    ] {
        match value {
            Confirmation::Confirmed => {}
            Confirmation::Failed | Confirmation::Unknown => return Err(error),
        }
    }
    match facts.scope {
        DrainScope::ObservableCallbackQueue => Ok(()),
    }
}
/// Linear receipts bind the post-release drain to the exact successful finalization.
pub(in crate::native_contract) fn verify_final_drain<P: Clone + PartialEq>(
    finalization: FinalizationObservation<P>,
    drain: FinalDrainObservation<P>,
) -> Result<CleanupProof<P>, DrainError> {
    if finalization.owner != drain.owner || !Rc::ptr_eq(&finalization.stamp, &drain.stamp) {
        return Err(DrainError::Owner);
    }
    if finalization.request() != &drain.request {
        return Err(DrainError::Request);
    }
    validate_facts(&finalization.owner, &drain.facts)?;
    finalization
        .receipt
        .validate(&finalization.owner, finalization.request().binding())
        .map_err(|_| DrainError::Unknown)?;
    Ok(CleanupProof {
        request: drain.request,
        owner: finalization.owner,
        finalization: finalization.receipt,
    })
}
#[cfg(test)]
impl FinalizationObservation<Synthetic> {
    pub(in crate::native_contract) fn synthetic(
        receipt: FinalizationReceipt,
        owner: &OwnerReceipt,
    ) -> Result<Self, VerifyError> {
        Self::validated(receipt, owner)
    }
}
#[cfg(test)]
impl FinalDrainObservation<Synthetic> {
    pub(in crate::native_contract) fn synthetic(
        finalization: &FinalizationObservation,
        facts: DrainFacts,
    ) -> Result<Self, DrainError> {
        Self::validated(finalization, facts)
    }
}
#[cfg(all(windows, not(test)))]
impl FinalizationObservation<super::ownership_receipt::Native> {
    pub(in crate::native_contract) fn observed(
        request: &Request,
        finalization: super::native_owner::Finalized,
        owner: &OwnerReceipt<super::ownership_receipt::Native>,
    ) -> Result<Self, VerifyError> {
        Self::validated(
            FinalizationReceipt::observed(request, finalization, owner)?,
            owner,
        )
    }
}
#[cfg(all(windows, not(test)))]
impl FinalDrainObservation<super::ownership_receipt::Native> {
    pub(in crate::native_contract) fn observed(
        finalization: &FinalizationObservation<super::ownership_receipt::Native>,
        drained: super::native_owner::Drained,
    ) -> Result<Self, DrainError> {
        if !drained.matches(finalization) {
            return Err(DrainError::Owner);
        }
        Self::validated(finalization, drained.observations())
    }
}
#[cfg(test)]
#[path = "final_drain_contract_tests.rs"]
mod tests;
