//! One own surface, once. `Host::pump` transfers captured notices, never OS messages.
//! A+B covers resource finalization and current callback drain, not C or thread join.
use super::*;
use crate::native_contract::CleanupProof;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Create,
    CreateDelivery,
    CreateCompleted,
    Close,
    CloseDelivery,
    CloseCompleted,
    Finalization,
    FinalDrain,
    Proof,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Failure {
    pub stage: Stage,
    pub cause: Error,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdmissionError {
    AlreadyRun,
}
#[derive(Debug)]
pub struct DriverReport<P> {
    lifecycle: Result<(), Failure>,
    proof: Option<CleanupProof<P>>,
    failure_cleanup: Option<Result<Report<P>, cleanup::Error>>,
}
impl<P> DriverReport<P> {
    pub const fn lifecycle(&self) -> Result<(), Failure> {
        self.lifecycle
    }
    pub const fn proof(&self) -> Option<&CleanupProof<P>> {
        self.proof.as_ref()
    }
    pub const fn failure_cleanup(&self) -> Option<&Result<Report<P>, cleanup::Error>> {
        self.failure_cleanup.as_ref()
    }
    pub const fn succeeded(&self) -> bool {
        self.lifecycle.is_ok() && self.proof.is_some() && self.failure_cleanup.is_none()
    }
}
pub struct Driver<B: Backend> {
    host: Host<B>,
    attempted: bool,
}
impl<B: Backend> Driver<B> {
    pub(in crate::native_contract) const fn new(host: Host<B>) -> Self {
        Self {
            host,
            attempted: false,
        }
    }
    /// Exactly one attempt; no replacement or Host extraction API is provided.
    pub fn run(&mut self) -> Result<DriverReport<B::Provenance>, AdmissionError> {
        if self.attempted {
            return Err(AdmissionError::AlreadyRun);
        }
        self.attempted = true;
        match self.lifecycle() {
            Ok(proof) => Ok(DriverReport {
                lifecycle: Ok(()),
                proof: Some(proof),
                failure_cleanup: None,
            }),
            Err(failure) => {
                // Missing completion fails the lifecycle even when Native returned Ok.
                let _: Result<(), Error> = self.host.fault(failure.cause);
                let cleanup = self.host.failure_cleanup();
                Ok(DriverReport {
                    lifecycle: Err(failure),
                    proof: None,
                    failure_cleanup: Some(cleanup),
                })
            }
        }
    }
    fn lifecycle(&mut self) -> Result<CleanupProof<B::Provenance>, Failure> {
        self.host.create().map_err(|cause| Failure {
            stage: Stage::Create,
            cause,
        })?;
        self.host.pump(16).map_err(|cause| Failure {
            stage: Stage::CreateDelivery,
            cause,
        })?;
        if !matches!(self.host.state(), State::Available(_)) {
            return Err(Failure {
                stage: Stage::CreateCompleted,
                cause: Error::Protocol,
            });
        }
        self.host.close().map_err(|cause| Failure {
            stage: Stage::Close,
            cause,
        })?;
        self.host.pump(16).map_err(|cause| Failure {
            stage: Stage::CloseDelivery,
            cause,
        })?;
        if self.host.state() != State::Absent {
            return Err(Failure {
                stage: Stage::CloseCompleted,
                cause: Error::Protocol,
            });
        }
        self.host.verify_cleanup().map_err(|cause| Failure {
            stage: Stage::Finalization,
            cause,
        })?;
        self.host.pump(16).map_err(|cause| Failure {
            stage: Stage::FinalDrain,
            cause,
        })?;
        self.host.take_driver_proof().map_err(|cause| Failure {
            stage: Stage::Proof,
            cause,
        })
    }
}
impl<B: Backend> Host<B> {
    fn take_driver_proof(&mut self) -> Result<CleanupProof<B::Provenance>, Error> {
        self.guard()?;
        if self.pending.is_some() || self.cleanup_attempted || self.state() != State::Absent {
            return self.fault(Error::Protocol);
        }
        match self.completion.take() {
            Some(proof) => Ok(proof),
            None => self.fault(Error::Protocol),
        }
    }
}
#[cfg(all(windows, not(test)))]
impl Driver<NativeBackend> {
    /// Bookkeeping only. Calling `run` invokes Native; no target calls it here.
    pub(in crate::native_contract) fn native(main: Authoritative) -> Self {
        Self::new(Host::native(main))
    }
}
#[cfg(test)]
#[path = "synchronous_driver_tests.rs"]
mod tests;
