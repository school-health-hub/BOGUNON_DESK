use super::*;
#[cfg(test)]
impl Phase<Synthetic> {
    pub fn stop(
        &mut self,
        input: &Envelope,
        facts: StopFacts,
    ) -> Result<PumpStopObservation, Error> {
        self.check(input, State::PumpStopPending)?;
        if let Err(error) = facts.validate() {
            return self.fail(error);
        }
        self.state = State::PumpStopped;
        Ok(PumpStopObservation {
            owner: self.owner.clone(),
            request: self.request.clone(),
            stamp: self.stamp.clone(),
            sequence: self.sequence,
            facts,
        })
    }
}
#[cfg(test)]
impl StopFacts {
    pub(super) fn quiet() -> Self {
        Self {
            admission_closed: true,
            in_flight: 0,
            callback_delivery_complete: true,
            reason: StopReason::Requested,
            budget: Check::Complete,
            deadline: Check::Complete,
        }
    }
}
