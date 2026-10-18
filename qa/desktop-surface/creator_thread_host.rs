//! Creator-thread orchestration. Pumping means bounded notice transfer, never Win32 dispatch.
use super::{ownership_receipt::OwnerReceipt, Kind, Outcome, Request, Response};
use crate::{
    disposable_surface::State, main_boundary_state::Authoritative, native_adapter::Adapter,
    own_coordinator::NoticeKind,
};
use std::{
    marker::PhantomData,
    rc::Rc,
    thread::{self, ThreadId},
};
#[path = "callback_bridge.rs"]
mod bridge;
use super::failure_cleanup as cleanup;
pub use bridge::{Envelope, Source};
#[path = "creator_thread_failure.rs"]
mod failure;
#[path = "creator_thread_host_drain.rs"]
mod final_drain;
#[path = "creator_thread_operations.rs"]
mod operations;
pub use failure::Report;
mod sealed {
    pub trait Sealed {}
}
pub trait Backend: sealed::Sealed {
    type Provenance: Clone + PartialEq;
    type CleanupCapability;
    fn cleanup_capability(&mut self) -> Result<Self::CleanupCapability, cleanup::Error>;
    fn cleanup_failure(
        &mut self,
        capability: Self::CleanupCapability,
    ) -> cleanup::Observation<Self::Provenance>;
    fn dispatch(&mut self, request: &Request) -> Response<Self::Provenance>;
    fn drain(&mut self) -> Result<Vec<Envelope<Self::Provenance>>, Error>;
    fn complete_cleanup(&mut self, request: &Request, budget: usize) -> Response<Self::Provenance>;
    fn stop(&mut self) -> Result<(), Error>;
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Thread,
    Reentry,
    Protocol,
    Callback,
    Overflow,
    Budget,
    PumpStop,
    Unknown,
}
pub struct Host<B: Backend> {
    backend: B,
    adapter: Adapter<B::Provenance>,
    bridge: bridge::Bridge<B::Provenance>,
    pending: Option<Response<B::Provenance>>,
    completion: Option<super::CleanupProof<B::Provenance>>,
    creator: ThreadId,
    entered: bool,
    stopped: bool,
    faulted: bool,
    original: Option<Error>,
    cleanup_attempted: bool,
    _thread_bound: PhantomData<Rc<()>>,
}
impl<B: Backend> Host<B> {
    pub(super) fn new(main: Authoritative, backend: B) -> Self {
        Self {
            backend,
            adapter: Adapter::new(main),
            bridge: bridge::Bridge::new(),
            pending: None,
            completion: None,
            creator: thread::current().id(),
            entered: false,
            stopped: false,
            faulted: false,
            original: None,
            cleanup_attempted: false,
            _thread_bound: PhantomData,
        }
    }
    fn fault<T>(&mut self, error: Error) -> Result<T, Error> {
        self.completion = None;
        self.original.get_or_insert(error);
        self.faulted = true;
        self.adapter.native_unknown();
        Err(error)
    }
    fn guard(&mut self) -> Result<(), Error> {
        if self.creator != thread::current().id() {
            return self.fault(Error::Thread);
        }
        if self.entered {
            return self.fault(Error::Reentry);
        }
        if self.faulted || self.adapter.faulted() || self.stopped {
            return self.fault(Error::Unknown);
        }
        Ok(())
    }
    fn submit(&mut self, request: Request) -> Result<(), Error> {
        // No coordinator or Ledger borrow survives this call into Native.
        self.entered = true;
        let response = self.backend.dispatch(&request);
        self.entered = false;
        if response.request != request {
            return self.fault(Error::Protocol);
        }
        match &response.outcome {
            Outcome::CreateSucceeded(owner) => {
                if self.pending.is_some() {
                    return self.fault(Error::Protocol);
                }
                if let Err(error) = self.bridge.activate(owner.clone()) {
                    return self.fault(error);
                }
                self.pending = Some(response);
            }
            Outcome::CloseStarted => {
                if self.adapter.respond(response.clone()).is_err() {
                    return self.fault(Error::Protocol);
                }
                self.pending = Some(response);
            }
            Outcome::CleanupPending => {
                if request.kind() != Kind::VerifyOwnSurfaceCleanup || self.pending.is_some() {
                    return self.fault(Error::Protocol);
                }
                self.pending = Some(response);
            }
            Outcome::CleanupVerified(_) => return self.fault(Error::Protocol),
            Outcome::CreateFailed
            | Outcome::CleanupFailed
            | Outcome::NativeOutcomeUnknown
            | Outcome::CloseCompleted
            | Outcome::SurfaceLost => return self.fault(Error::Unknown),
        }
        Ok(())
    }
    pub fn pump(&mut self, budget: usize) -> Result<usize, Error> {
        self.guard()?;
        if budget == 0 || budget > 16 {
            return self.fault(Error::Budget);
        }
        self.entered = true;
        let notices = self.backend.drain();
        self.entered = false;
        let notices = match notices {
            Ok(value) => value,
            Err(error) => return self.fault(error),
        };
        if notices.len() > 16 {
            return self.fault(Error::Overflow);
        }
        if notices.len() > budget {
            return self.fault(Error::Budget);
        }
        let count = notices.len();
        for notice in notices {
            if let Err(error) = self.deliver(notice) {
                return self.fault(error);
            }
        }
        self.complete_after_drain(budget, count)?;
        Ok(count)
    }
    fn deliver(&mut self, notice: Envelope<B::Provenance>) -> Result<(), Error> {
        self.bridge.validate(&notice)?;
        let pending = self.pending.clone();
        match (notice.kind, pending) {
            (NoticeKind::Created, Some(response))
                if response.request.kind() == Kind::CreateOwnSurface
                    && notice.binding == *response.request.binding() =>
            {
                self.pending = None;
                let next = self
                    .adapter
                    .respond(response)
                    .map_err(|_| Error::Protocol)?;
                if let Some(request) = next {
                    self.submit(request)?;
                }
            }
            (NoticeKind::Destroyed, Some(response))
                if response.request.kind() == Kind::BeginCloseOwnSurface
                    && notice.binding == *response.request.binding() =>
            {
                self.pending = None;
                self.adapter
                    .respond(Response {
                        request: response.request,
                        outcome: Outcome::CloseCompleted,
                    })
                    .map_err(|_| Error::Protocol)?;
            }
            (NoticeKind::CloseRequested, None)
                if self.bridge.origin() == Some(&notice.binding)
                    && matches!(self.adapter.state(), State::Available(_)) =>
            {
                self.close()?
            }
            (NoticeKind::Destroyed, None) if self.bridge.origin() == Some(&notice.binding) => {
                // Unsolicited loss has no matching disposal receipt: retain Unknown, never cleanup success.
                return Err(Error::Unknown);
            }
            _ => return Err(Error::Callback),
        }
        Ok(())
    }
    pub fn stop(&mut self) -> Result<(), Error> {
        self.completion = None;
        self.guard()?;
        // Stop first closes command admission, but cannot prove Native owner release.
        self.adapter.native_unknown();
        self.entered = true;
        let result = self.backend.stop();
        self.entered = false;
        self.stopped = true;
        if result.is_err() {
            return self.fault(Error::PumpStop);
        }
        Ok(())
    }
    pub fn state(&self) -> State {
        self.adapter.state()
    }
    pub const fn faulted(&self) -> bool {
        self.faulted || self.adapter.faulted()
    }
    #[cfg(test)]
    pub fn inspect(&self) -> &Authoritative {
        self.adapter.inspect()
    }
}
#[cfg(all(windows, not(test)))]
#[path = "creator_thread_native.rs"]
mod native;
#[cfg(all(windows, not(test)))]
pub use native::NativeBackend;
#[path = "synchronous_driver.rs"]
pub mod synchronous_driver;
#[cfg(test)]
#[path = "creator_thread_host_tests.rs"]
mod tests;
#[cfg(test)]
#[path = "integrated_execution_tests.rs"]
mod integrated_execution_tests;
