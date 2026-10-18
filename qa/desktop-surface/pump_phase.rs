//! Pure admission model. No OS queue, thread termination, or Windows cleanup attestation.
use super::{
    final_drain_contract::{verify_final_drain, FinalDrainObservation, FinalizationObservation},
    ownership_receipt::{OwnerReceipt, Synthetic},
    CleanupProof, Request,
};
use std::rc::Rc;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    LiveOwner,
    DispatchAdmissionClosed,
    NativeFinalizing,
    FinalDrainPending,
    PumpStopPending,
    PumpStopped,
    Failed,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Owner,
    Request,
    Sequence,
    Order,
    AdmissionOpen,
    InFlight,
    CallbackPending,
    UnexpectedQuit,
    Budget,
    Deadline,
    Pump,
    NativeUnknown,
    Cleanup,
    FailureCleanup,
}
#[derive(Debug, Clone)]
pub struct Envelope<P = Synthetic> {
    pub owner: OwnerReceipt<P>,
    pub request: Request,
    pub sequence: u64,
}
/// This receipt describes internal state only, never the Windows queue or thread join.
#[derive(Debug)]
pub struct PumpStopObservation<P = Synthetic> {
    owner: OwnerReceipt<P>,
    request: Request,
    stamp: Rc<()>,
    sequence: u64,
    facts: StopFacts,
}
#[path = "pump_stop_facts.rs"]
mod stop_facts;
pub use stop_facts::{Check, StopFacts, StopReason};
/// Separate integrated admission: an A+B proof alone never constructs this value.
#[derive(Debug)]
pub struct IntegratedAdmission<P = Synthetic> {
    proof: CleanupProof<P>,
    stop: PumpStopObservation<P>,
}
impl<P: PartialEq> IntegratedAdmission<P> {
    pub fn matches(&self, owner: &OwnerReceipt<P>, request: &Request) -> bool {
        self.proof.matches(request, owner)
            && self.stop.owner == *owner
            && self.stop.request == *request
    }
}
#[derive(Debug)]
pub struct Phase<P = Synthetic> {
    owner: OwnerReceipt<P>,
    request: Request,
    state: State,
    sequence: u64,
    stamp: Rc<()>,
    a: Option<FinalizationObservation<P>>,
    proof: Option<CleanupProof<P>>,
    original: Option<Error>,
}
impl<P: Clone + PartialEq> Phase<P> {
    pub fn new(owner: OwnerReceipt<P>, request: Request) -> Self {
        let mut phase = Self {
            owner,
            request,
            state: State::LiveOwner,
            sequence: 0,
            stamp: Rc::new(()),
            a: None,
            proof: None,
            original: None,
        };
        let creation = phase.owner.creation();
        if phase.request.kind() != super::Kind::VerifyOwnSurfaceCleanup
            || phase.request.sequence() == 0
            || creation.binding.operation() == phase.request.binding().operation()
            || creation.ownership != super::ownership_receipt::ResourceOwnership::Owned
            || creation.binding.instance() != phase.request.binding().instance()
            || creation.binding.operation().generation()
                != phase.request.binding().operation().generation()
            || phase.request.expected() != crate::disposable_surface::State::Absent
        {
            phase.record_failure(Error::Request);
        }
        phase
    }
    pub const fn state(&self) -> State {
        self.state
    }
    pub const fn original_failure(&self) -> Option<Error> {
        self.original
    }
    pub const fn dispatch_allowed(&self) -> bool {
        matches!(self.state, State::LiveOwner)
    }
    pub const fn callback_delivery_allowed(&self) -> bool {
        matches!(
            self.state,
            State::LiveOwner
                | State::DispatchAdmissionClosed
                | State::NativeFinalizing
                | State::FinalDrainPending
        )
    }
    fn fail<T>(&mut self, error: Error) -> Result<T, Error> {
        if self.original.is_none() {
            self.original = Some(error);
        }
        self.state = match self.original {
            Some(Error::NativeUnknown) => State::Unknown,
            _ => State::Failed,
        };
        self.a = None;
        self.proof = None;
        Err(error)
    }
    fn check(&mut self, input: &Envelope<P>, expected: State) -> Result<(), Error> {
        let error = if input.owner != self.owner {
            Some(Error::Owner)
        } else if input.request != self.request {
            Some(Error::Request)
        } else if Some(input.sequence) != self.sequence.checked_add(1) {
            Some(Error::Sequence)
        } else if self.state != expected {
            Some(Error::Order)
        } else {
            None
        };
        if let Some(error) = error {
            return self.fail(error);
        }
        self.sequence = input.sequence;
        Ok(())
    }
    pub fn close_dispatch_admission(&mut self, input: &Envelope<P>) -> Result<(), Error> {
        self.check(input, State::LiveOwner)?;
        self.state = State::DispatchAdmissionClosed;
        Ok(())
    }
    pub fn begin_finalization(&mut self, input: &Envelope<P>) -> Result<(), Error> {
        self.check(input, State::DispatchAdmissionClosed)?;
        self.state = State::NativeFinalizing;
        Ok(())
    }
    pub fn observe_finalization(
        &mut self,
        input: &Envelope<P>,
        a: FinalizationObservation<P>,
    ) -> Result<(), Error> {
        self.check(input, State::NativeFinalizing)?;
        if a.owner() != &self.owner || a.request() != &self.request {
            return self.fail(Error::Request);
        }
        self.a = Some(a);
        self.state = State::FinalDrainPending;
        Ok(())
    }
    pub fn observe_final_drain(
        &mut self,
        input: &Envelope<P>,
        b: FinalDrainObservation<P>,
    ) -> Result<(), Error> {
        self.check(input, State::FinalDrainPending)?;
        let Some(a) = self.a.take() else {
            return self.fail(Error::Order);
        };
        match verify_final_drain(a, b) {
            Ok(proof) => {
                self.proof = Some(proof);
                self.state = State::PumpStopPending;
                Ok(())
            }
            Err(_) => self.fail(Error::Cleanup),
        }
    }
    pub fn record_failure(&mut self, error: Error) {
        let _: Result<(), Error> = self.fail(error);
    }
    pub fn admit(&mut self, c: PumpStopObservation<P>) -> Result<IntegratedAdmission<P>, Error> {
        if self.state != State::PumpStopped {
            return self.fail(Error::Order);
        }
        if c.owner != self.owner
            || c.request != self.request
            || !Rc::ptr_eq(&c.stamp, &self.stamp)
            || c.sequence != self.sequence
        {
            return self.fail(Error::Request);
        }
        if let Err(error) = c.facts.validate() {
            return self.fail(error);
        }
        match self.proof.take() {
            Some(proof) => Ok(IntegratedAdmission { proof, stop: c }),
            None => self.fail(Error::Order),
        }
    }
}
#[cfg(test)]
#[path = "pump_phase_synthetic.rs"]
mod synthetic;
#[cfg(test)]
#[path = "pump_phase_tests.rs"]
mod tests;
