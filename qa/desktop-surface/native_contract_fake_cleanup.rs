use super::*;
impl Fake {
    pub(super) fn cleanup(&mut self, request: &Request, fault: Fault) -> Outcome {
        if self.finalized {
            return Outcome::CleanupFailed;
        }
        self.finalized = true;
        if matches!(fault, Fault::LedgerLive) {
            let Some(entry) = &self.retained else {
                return Outcome::CleanupFailed;
            };
            let Ok(token) = self.ledger.reserve(&entry.binding) else {
                return Outcome::CleanupFailed;
            };
            if self.ledger.register(self.handle + 1, token).is_err() {
                return Outcome::CleanupFailed;
            }
        }
        let Some(retained) = &self.retained else {
            return Outcome::CleanupFailed;
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
            Fault::Unknown => return Outcome::NativeOutcomeUnknown,
        }
        match FinalizationReceipt::synthetic(request, observed)
            .verify(&retained.owner, &retained.binding)
        {
            Ok(proof) => {
                self.cleaned = true;
                Outcome::CleanupVerified(proof)
            }
            Err(_) => Outcome::CleanupFailed,
        }
    }
    #[cfg(test)]
    pub fn owner(&self) -> Option<&OwnerReceipt> {
        self.retained.as_ref().map(|entry| &entry.owner)
    }
}
