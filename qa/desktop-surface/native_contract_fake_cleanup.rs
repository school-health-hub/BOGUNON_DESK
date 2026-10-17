use super::*;
use crate::native_contract::ownership_finalization::VerifyError;
impl Fake {
    fn cleanup_receipt(
        &mut self,
        request: &Request,
        fault: Fault,
    ) -> Result<FinalizationReceipt, VerifyError> {
        if self.finalized {
            return Err(VerifyError::Owner);
        }
        self.finalized = true;
        if matches!(fault, Fault::LedgerLive) {
            let Some(entry) = &self.retained else {
                return Err(VerifyError::Owner);
            };
            let Ok(token) = self.ledger.reserve(&entry.binding) else {
                return Err(VerifyError::Owner);
            };
            if self.ledger.register(self.handle + 1, token).is_err() {
                return Err(VerifyError::Owner);
            }
        }
        let Some(retained) = &self.retained else {
            return Err(VerifyError::Owner);
        };
        let mut observed = Observations {
            owner: retained.owner.clone(),
            identity: retained.owner.creation().clone(),
            current_thread: 7,
            destroy: if self.destroyed {
                Confirmation::Confirmed
            } else {
                Confirmation::Failed
            },
            ledger: if self.ledger.live.is_none() {
                Confirmation::Confirmed
            } else {
                Confirmation::Failed
            },
            residual: Some(0),
            class_release: Confirmation::Confirmed,
            callback_clear: Confirmation::Confirmed,
            owner_release: Confirmation::Confirmed,
        };
        match fault {
            Fault::None | Fault::PartialCreate => {}
            Fault::Thread => observed.current_thread = 8,
            Fault::Token => {
                observed.identity.token =
                    LedgerToken::synthetic(observed.identity.token.value() + 1)
            }
            Fault::Class => observed.identity.class += 1,
            Fault::Pid => observed.identity.pid += 1,
            Fault::Tid => observed.identity.tid += 1,
            Fault::Instance => observed.owner = OwnerReceipt::synthetic(observed.identity.clone()),
            Fault::Destroy => observed.destroy = Confirmation::Failed,
            Fault::RemainingUnknown => observed.residual = None,
            Fault::RemainingNonzero => observed.residual = Some(1),
            Fault::Release => observed.owner_release = Confirmation::Failed,
            Fault::LedgerLive => {}
            Fault::ClassRelease => observed.class_release = Confirmation::Failed,
            Fault::CallbackContext => observed.callback_clear = Confirmation::Failed,
            Fault::UnknownDestroy => observed.destroy = Confirmation::Unknown,
            Fault::UnknownLedger => observed.ledger = Confirmation::Unknown,
            Fault::UnknownClassRelease => observed.class_release = Confirmation::Unknown,
            Fault::UnknownCallbackContext => observed.callback_clear = Confirmation::Unknown,
            Fault::UnknownOwnerRelease => observed.owner_release = Confirmation::Unknown,
            Fault::Unknown => return Err(VerifyError::Ownership),
        }
        Ok(FinalizationReceipt::synthetic(request, observed))
    }
    #[cfg(test)]
    pub fn owner(&self) -> Option<&OwnerReceipt> {
        self.retained.as_ref().map(|entry| &entry.owner)
    }
}

#[cfg(test)]
impl Fake {
    pub fn failure_observe(
        &mut self,
    ) -> crate::native_contract::failure_cleanup::Observation<
        crate::native_contract::ownership_receipt::Synthetic,
    > {
        use crate::native_contract::failure_cleanup::{Facts, Observation, Resources};
        let resources = match self.retained.as_ref().map(|r| r.owner.creation().ownership) {
            None => Resources::NoResourcesConfirmed,
            Some(ResourceOwnership::Owned) => Resources::Owned,
            Some(ResourceOwnership::Partial) => Resources::Partial,
            Some(ResourceOwnership::Unknown) => Resources::Unknown,
        };
        let mut destroy = Confirmation::Confirmed;
        if let Some((handle, token)) = self
            .ledger
            .live
            .as_ref()
            .map(|entry| (entry.handle, entry.token))
        {
            if !self.ledger.matches(handle, token)
                || self.ledger.notice(handle, NoticeKind::Destroyed).is_err()
            {
                destroy = Confirmation::Failed;
            }
        }
        let ledger = if self.ledger.live.is_none() {
            Confirmation::Confirmed
        } else {
            Confirmation::Failed
        };
        self.cleaned = destroy == Confirmation::Confirmed && ledger == Confirmation::Confirmed;
        Observation::new(
            resources,
            Facts {
                creator_thread: Confirmation::Confirmed,
                owner_identity: Confirmation::Confirmed,
                ledger_token: Confirmation::Confirmed,
                destroy,
                ledger,
                residual: Some(u32::from(self.ledger.live.is_some())),
                class_release: Confirmation::Confirmed,
                callback_clear: Confirmation::Confirmed,
                owner_release: Confirmation::Confirmed,
            },
        )
    }
}

impl Fake {
    pub(super) fn cleanup(&mut self, request: &Request, fault: Fault) -> Outcome {
        let receipt = match self.cleanup_receipt(request, fault) {
            Ok(receipt) => receipt,
            Err(error) => {
                return match (error, fault) {
                    (VerifyError::Ownership, Fault::Unknown) => Outcome::NativeOutcomeUnknown,
                    _ => Outcome::CleanupFailed,
                }
            }
        };
        let Some(retained) = &self.retained else {
            return Outcome::CleanupFailed;
        };
        match receipt.verify(&retained.owner, &retained.binding) {
            Ok(proof) => {
                self.cleaned = true;
                Outcome::CleanupVerified(proof)
            }
            Err(_) => Outcome::CleanupFailed,
        }
    }
}
#[cfg(test)]
impl Fake {
    pub(in crate::native_contract) fn observe_cleanup(
        &mut self,
        request: &Request,
        fault: Fault,
    ) -> Result<
        crate::native_contract::final_drain_contract::FinalizationObservation,
        crate::native_contract::ownership_finalization::VerifyError,
    > {
        use crate::native_contract::{
            final_drain_contract::FinalizationObservation, ownership_finalization::VerifyError,
        };
        if !self.valid(request) {
            return Err(VerifyError::Request);
        }
        self.last = Some(request.clone());
        let receipt = self.cleanup_receipt(request, fault)?;
        let owner = &self.retained.as_ref().ok_or(VerifyError::Owner)?.owner;
        FinalizationObservation::synthetic(receipt, owner)
    }
    pub(in crate::native_contract) fn finish_observed_cleanup(
        &mut self,
        finalization: crate::native_contract::final_drain_contract::FinalizationObservation,
        drain: crate::native_contract::final_drain_contract::FinalDrainObservation,
    ) -> Result<
        crate::native_contract::CleanupProof,
        crate::native_contract::final_drain_contract::DrainError,
    > {
        use crate::native_contract::final_drain_contract::{verify_final_drain, DrainError};
        let retained = self.retained.as_ref().ok_or(DrainError::Owner)?;
        if finalization.owner() != &retained.owner
            || self.last.as_ref() != Some(finalization.request())
            || self.cleaned
        {
            return Err(DrainError::Owner);
        }
        let proof = verify_final_drain(finalization, drain)?;
        self.cleaned = true;
        Ok(proof)
    }
}
