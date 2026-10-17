//! Observes the current callback queues only; no Win32 message dispatch or future-message guarantee.
use super::{context, Failure, Native, Owner};
use crate::native_contract::{
    final_drain_contract::{
        DrainFacts, DrainScope, FinalDrainObservation, FinalizationObservation,
    },
    ownership_finalization::Confirmation,
    ownership_receipt::OwnerReceipt,
    Request,
};
use std::rc::Rc;
/// Only this creator-thread owner can construct a real post-release drain observation.
pub struct Drained {
    stamp: Rc<()>,
    request: Request,
    owner: OwnerReceipt<Native>,
    facts: DrainFacts,
}
impl Drained {
    pub(in crate::native_contract) fn matches(
        &self,
        finalization: &FinalizationObservation<Native>,
    ) -> bool {
        Rc::ptr_eq(&self.stamp, &finalization.stamp())
            && &self.request == finalization.request()
            && &self.owner == finalization.owner()
    }
    pub(in crate::native_contract) fn observations(self) -> DrainFacts {
        self.facts
    }
}
impl Owner {
    pub(in crate::native_contract) fn final_drain(
        &mut self,
        finalization: &FinalizationObservation<Native>,
        budget: usize,
    ) -> Result<FinalDrainObservation<Native>, Failure> {
        self.same_thread()?;
        if self.drain_attempted || self.cleanup_issued {
            return Err(Failure::Protocol);
        }
        self.drain_attempted = true;
        let stamp = self.finalization_stamp.as_ref().ok_or(Failure::Protocol)?;
        if !Rc::ptr_eq(stamp, &finalization.stamp())
            || self.receipt.as_ref() != Some(finalization.owner())
            || self.origin.as_ref() != Some(finalization.request().binding())
        {
            return Err(Failure::CallbackIdentity);
        }
        if budget == 0 || budget > 16 {
            return Err(Failure::CallbackOverflow);
        }
        // The owner must already have released its class, callback context, and TLS lease.
        self.released_quiet()?;
        let notices = context::drain()?;
        if notices.len() > budget || !notices.is_empty() {
            return Err(Failure::CallbackContext);
        }
        // A callback for a retired owner sets the sticky context fault; never clear it here.
        self.released_quiet()?;
        if context::CREATING.get()
            || context::EXPECTED.get() != 0
            || context::ledger(|ledger| Ok(ledger.live.is_some()))?
        {
            return Err(Failure::CallbackContext);
        }
        let drained = Drained {
            stamp: Rc::clone(stamp),
            request: finalization.request().clone(),
            owner: finalization.owner().clone(),
            facts: DrainFacts {
                current_thread: self.thread,
                owner_release: Confirmation::Confirmed,
                queue_quiet: Confirmation::Confirmed,
                overflow_clear: Confirmation::Confirmed,
                reentry_clear: Confirmation::Confirmed,
                budget_complete: Confirmation::Confirmed,
                outcome_known: Confirmation::Confirmed,
                scope: DrainScope::ObservableCallbackQueue,
            },
        };
        FinalDrainObservation::<Native>::observed(finalization, drained)
            .map_err(|_| Failure::NativeOutcomeUnknown)
    }
}
