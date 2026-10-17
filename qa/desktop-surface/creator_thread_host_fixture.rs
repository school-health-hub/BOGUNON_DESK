pub struct MemoryCapability {
    owner: Option<
        crate::native_contract::ownership_receipt::OwnerReceipt<
            crate::native_contract::ownership_receipt::Synthetic,
        >,
    >,
}
use super::*;
pub struct Memory {
    fake: Fake,
    pub owner: Option<OwnerReceipt<Synthetic>>,
    pub notices: Vec<Envelope<Synthetic>>,
    pub notices_for_test: Option<Envelope<Synthetic>>,
    capture: crate::native_contract::native_capture_model::Capture,
    pub delay: bool,
    pub overflow: bool,
    pub stop_failure: bool,
    pub fault: Fault,
    pub cleanup_fault: Option<cleanup::Fact>,
    pub cleanup_unknown: bool,
    pub cleanup_issued: bool,
    pub backend_fault: bool,
}
impl sealed::Sealed for Memory {}
impl Memory {
    fn capture(&mut self) {
        let notices = self.fake.take_captured();
        let token = self.owner.as_ref().unwrap().creation().token.value();
        for notice in &notices {
            self.capture.record(token, notice.clone()).unwrap();
        }
        for notice in self.capture.drain(notices).unwrap() {
            let envelope = Envelope {
                owner: self.owner.clone().unwrap(),
                binding: notice.binding,
                sequence: notice.sequence,
                source: Source::OwnWndProc,
                kind: notice.kind,
            };
            self.notices_for_test = Some(envelope.clone());
            self.notices.push(envelope);
        }
    }
}
impl Backend for Memory {
    type Provenance = Synthetic;
    type CleanupCapability = MemoryCapability;
    fn cleanup_capability(&mut self) -> Result<MemoryCapability, cleanup::Error> {
        if self.cleanup_issued {
            return Err(cleanup::Error::Duplicate);
        }
        self.cleanup_issued = true;
        Ok(MemoryCapability {
            owner: self.fake.owner().cloned(),
        })
    }
    fn cleanup_failure(&mut self, capability: MemoryCapability) -> cleanup::Observation<Synthetic> {
        use crate::native_contract::ownership_finalization::Confirmation;
        let identity_matches = capability.owner.as_ref() == self.fake.owner();
        if !identity_matches {
            return cleanup::Observation::new(
                cleanup::Resources::Unknown,
                cleanup::Facts {
                    creator_thread: Confirmation::Confirmed,
                    owner_identity: Confirmation::Failed,
                    ledger_token: Confirmation::Unknown,
                    destroy: Confirmation::Unknown,
                    ledger: Confirmation::Unknown,
                    residual: None,
                    class_release: Confirmation::Unknown,
                    callback_clear: Confirmation::Unknown,
                    owner_release: Confirmation::Unknown,
                },
            );
        }
        let mut observation = self.fake.failure_observe();
        if let Some(fact) = self.cleanup_fault {
            let value = if self.cleanup_unknown {
                Confirmation::Unknown
            } else {
                Confirmation::Failed
            };
            match fact {
                cleanup::Fact::CreatorThread => observation.facts.creator_thread = value,
                cleanup::Fact::OwnerIdentity => observation.facts.owner_identity = value,
                cleanup::Fact::LedgerToken => observation.facts.ledger_token = value,
                cleanup::Fact::Destroy => observation.facts.destroy = value,
                cleanup::Fact::Ledger => observation.facts.ledger = value,
                cleanup::Fact::Residual => {
                    observation.facts.residual = if self.cleanup_unknown { None } else { Some(1) }
                }
                cleanup::Fact::ClassRelease => observation.facts.class_release = value,
                cleanup::Fact::CallbackClear => observation.facts.callback_clear = value,
                cleanup::Fact::OwnerRelease => observation.facts.owner_release = value,
            }
        }
        observation
    }
    fn dispatch(&mut self, request: &Request) -> Response {
        if self.backend_fault {
            return Response {
                request: request.clone(),
                outcome: Outcome::NativeOutcomeUnknown,
            };
        }
        let response = self.fake.execute(request, self.fault);
        match &response.outcome {
            Outcome::CreateSucceeded(owner) => {
                self.owner = Some(owner.clone());
                self.capture.begin(owner.creation().token.value()).unwrap();
                self.capture();
            }
            Outcome::CloseStarted => {
                let completed = self.fake.complete_close(request);
                assert!(matches!(completed.outcome, Outcome::CloseCompleted));
                self.capture();
            }
            _ => {}
        }
        response
    }
    fn drain(&mut self) -> Result<Vec<Envelope<Synthetic>>, Error> {
        if self.overflow {
            return Err(Error::Overflow);
        }
        if self.delay {
            return Ok(Vec::new());
        }
        Ok(std::mem::take(&mut self.notices))
    }
    fn stop(&mut self) -> Result<(), Error> {
        if self.stop_failure {
            Err(Error::PumpStop)
        } else {
            Ok(())
        }
    }
}
pub fn fixture() -> Host<Memory> {
    Host::new(
        Authoritative::synthetic(),
        Memory {
            fake: Fake::new(),
            owner: None,
            notices: Vec::new(),
            notices_for_test: None,
            capture: crate::native_contract::native_capture_model::Capture::new(),
            delay: false,
            overflow: false,
            stop_failure: false,
            fault: Fault::None,
            cleanup_fault: None,
            cleanup_unknown: false,
            cleanup_issued: false,
            backend_fault: false,
        },
    )
}
pub fn available() -> Host<Memory> {
    let mut h = fixture();
    h.create().unwrap();
    h.pump(4).unwrap();
    h
}
pub fn closed() -> Host<Memory> {
    let mut h = available();
    h.close().unwrap();
    h.pump(4).unwrap();
    h
}
