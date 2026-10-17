use super::{Kind, Request};
use crate::{disposable_surface::State, surface_event_types::Binding};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Failure {
    Protocol,
    CreatorThread,
    LedgerOverflow,
    CallbackOverflow,
    CallbackIdentity,
    Reentry,
    ClassRegistration,
    CreateWindow,
    IdentityMismatch,
    PartialCreate,
    DestroyWindow,
    ResidualUnknown,
    ResidualWindows,
    ClassRelease,
    CallbackContext,
    OwnerRelease,
    NativeOutcomeUnknown,
}
/// Pure admission rules reused by the actual Native owner; no OS facts or proofs.
pub struct Policy {
    origin: Option<Binding>,
    active: Option<Binding>,
    sequence: Option<u64>,
    closed: bool,
    finalized: bool,
    fault: Option<Failure>,
}
impl Policy {
    pub const fn new() -> Self {
        Self {
            origin: None,
            active: None,
            sequence: None,
            closed: false,
            finalized: false,
            fault: None,
        }
    }
    pub fn fault(&mut self, error: Failure) -> Failure {
        self.fault = Some(error);
        error
    }
    fn next(&mut self, request: &Request, kind: Kind) -> Result<(), Failure> {
        let sequence_matches = match self.sequence {
            Some(previous) => previous.checked_add(1) == Some(request.sequence()),
            None => kind == Kind::CreateOwnSurface && request.sequence() > 0,
        };
        if self.fault.is_some() || request.kind() != kind || !sequence_matches {
            return Err(self.fault(Failure::Protocol));
        }
        self.sequence = Some(request.sequence());
        Ok(())
    }
    pub fn create(&mut self, request: &Request) -> Result<(), Failure> {
        self.next(request, Kind::CreateOwnSurface)?;
        if self.origin.is_some()
            || request.expected() != State::Creating(request.binding().operation())
        {
            return Err(self.fault(Failure::Protocol));
        }
        self.origin = Some(request.binding().clone());
        self.active = self.origin.clone();
        Ok(())
    }
    pub fn close(&mut self, request: &Request) -> Result<(), Failure> {
        self.next(request, Kind::BeginCloseOwnSurface)?;
        let valid = self.origin.as_ref().is_some_and(|origin| {
            origin.instance() == request.binding().instance()
                && origin.operation().generation() == request.binding().operation().generation()
                && origin.operation() != request.binding().operation()
        });
        if !valid
            || self.closed
            || self.finalized
            || request.expected() != State::Disposing(request.binding().operation())
        {
            return Err(self.fault(Failure::Protocol));
        }
        self.closed = true;
        self.active = Some(request.binding().clone());
        Ok(())
    }
    pub fn finalize(&mut self, request: &Request) -> Result<(), Failure> {
        self.next(request, Kind::VerifyOwnSurfaceCleanup)?;
        if self.finalized
            || !self.closed
            || self.active.as_ref() != Some(request.binding())
            || request.expected() != State::Absent
        {
            return Err(self.fault(Failure::Protocol));
        }
        self.finalized = true;
        Ok(())
    }
    pub const fn operating(&self) -> bool {
        self.fault.is_none() && !self.finalized
    }
    pub const fn healthy(&self) -> bool {
        self.fault.is_none()
    }
}
