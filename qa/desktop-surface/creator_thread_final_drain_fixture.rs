use super::*;
use crate::native_contract::{
    final_drain_contract::{DrainFacts, DrainScope, FinalDrainObservation},
    ownership_finalization::Confirmation as C,
};
pub(super) const fn quiet_facts() -> DrainFacts {
    DrainFacts {
        current_thread: 7,
        owner_release: C::Confirmed,
        queue_quiet: C::Confirmed,
        overflow_clear: C::Confirmed,
        reentry_clear: C::Confirmed,
        budget_complete: C::Confirmed,
        outcome_known: C::Confirmed,
        scope: DrainScope::ObservableCallbackQueue,
    }
}
impl Memory {
    pub(super) fn observe_cleanup(&mut self, request: &Request) -> Response {
        let outcome = match self.fake.observe_cleanup(request, self.fault) {
            Ok(observation) => {
                self.finalization = Some(observation);
                self.cleanup_request = Some(request.clone());
                Outcome::CleanupPending
            }
            Err(_) => Outcome::CleanupFailed,
        };
        Response {
            request: request.clone(),
            outcome,
        }
    }
    pub(super) fn finish_cleanup(&mut self, request: &Request, budget: usize) -> Response {
        let mut outcome = Outcome::NativeOutcomeUnknown;
        if !self.backend_fault
            && !self.cleanup_issued
            && self.cleanup_request.as_ref() == Some(request)
        {
            if let Some(finalization) = self.finalization.take() {
                let mut facts = self.final_drain_facts.clone();
                if budget == 0 || budget > 16 {
                    facts.budget_complete = C::Failed;
                }
                if !self.notices.is_empty() {
                    facts.queue_quiet = C::Failed;
                }
                outcome = match FinalDrainObservation::synthetic(&finalization, facts)
                    .and_then(|drain| self.fake.finish_observed_cleanup(finalization, drain))
                {
                    Ok(proof) => Outcome::CleanupVerified(proof),
                    Err(_) => Outcome::CleanupFailed,
                };
            }
        }
        Response {
            request: request.clone(),
            outcome,
        }
    }
}
