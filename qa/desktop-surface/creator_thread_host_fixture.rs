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
    fn dispatch(&mut self, request: &Request) -> Response {
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
