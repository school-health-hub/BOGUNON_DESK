use super::Error;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StopReason {
    Requested,
    UnexpectedQuit,
    PumpFailure,
    NativeUnknown,
    CleanupFailure,
    FailureCleanup,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Check {
    Complete,
    Exceeded,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StopFacts {
    pub admission_closed: bool,
    pub in_flight: u32,
    pub callback_delivery_complete: bool,
    pub reason: StopReason,
    pub budget: Check,
    pub deadline: Check,
}
impl StopFacts {
    pub(super) fn validate(self) -> Result<(), Error> {
        if !self.admission_closed {
            return Err(Error::AdmissionOpen);
        }
        if self.in_flight != 0 {
            return Err(Error::InFlight);
        }
        if !self.callback_delivery_complete {
            return Err(Error::CallbackPending);
        }
        match self.reason {
            StopReason::Requested => {}
            StopReason::UnexpectedQuit => return Err(Error::UnexpectedQuit),
            StopReason::PumpFailure => return Err(Error::Pump),
            StopReason::NativeUnknown => return Err(Error::NativeUnknown),
            StopReason::CleanupFailure => return Err(Error::Cleanup),
            StopReason::FailureCleanup => return Err(Error::FailureCleanup),
        }
        for (check, error) in [
            (self.budget, Error::Budget),
            (self.deadline, Error::Deadline),
        ] {
            match check {
                Check::Complete => {}
                Check::Exceeded => return Err(error),
                Check::Unknown => return Err(Error::NativeUnknown),
            }
        }
        Ok(())
    }
}
