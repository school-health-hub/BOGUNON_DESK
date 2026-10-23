use crate::{
    lifecycle::Attempt,
    ownership::{BackendRegistrationLease, Ledger, OwnershipError},
};
use std::{
    marker::PhantomData,
    panic::{catch_unwind, AssertUnwindSafe},
    rc::Rc,
    thread::{self, ThreadId},
};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandlerKind {
    NavigationStarting,
    NavigationCompleted,
    NewWindowRequested,
    FrameCreated,
    WebMessageReceived,
}

const HANDLER_COUNT: usize = 5;

const fn handler_index(handler: HandlerKind) -> usize {
    match handler {
        HandlerKind::NavigationStarting => 0,
        HandlerKind::NavigationCompleted => 1,
        HandlerKind::NewWindowRequested => 2,
        HandlerKind::FrameCreated => 3,
        HandlerKind::WebMessageReceived => 4,
    }
}

#[derive(PartialEq, Eq)]
pub struct HandlerToken(pub(crate) u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandlerState {
    Unregistered,
    Registered,
    ReleaseAttempted,
    Released,
    Unresolved,
}

#[derive(PartialEq, Eq)]
enum HandlerSlot {
    Unregistered,
    Registered(HandlerToken),
    ReleaseAttempted,
    Released,
    Unresolved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionOwnership {
    attempt: Attempt,
    identity: u64,
}

impl SessionOwnership {
    pub const fn new(attempt: Attempt, identity: u64) -> Self {
        Self { attempt, identity }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionCleanup {
    Released,
    Unresolved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandlerAddFailure {
    RolledBack,
    Unresolved,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum RendererSessionError {
    #[error("handler is already registered or terminal")]
    HandlerAlreadyRecorded,
    #[error("renderer session cleanup has already started")]
    SessionClosed,
    #[error("native handler registration failed and was rolled back")]
    NativeAddRolledBack,
    #[error("native handler registration ownership is unresolved")]
    NativeAddUnresolved,
    #[error("native handler registration panicked and ownership is unresolved")]
    NativeAddPanicked,
    #[error("renderer session operation was attempted from a non-owner thread")]
    WrongThread,
    #[error("renderer session ownership transition failed: {0}")]
    Ownership(#[from] OwnershipError),
}

pub trait HandlerRegistry {
    type RemoveError;

    /// Returns a token only when native ownership exists.
    ///
    /// `RolledBack` is permitted only when native add failed before creating a
    /// token, or when a created token was removed and that removal succeeded.
    /// Unknown, failed, or panicking rollback and uncertain callback lifetime
    /// must return `Unresolved`. Implementations must not re-enter the owning
    /// `RendererSession` from add/remove callbacks; native callbacks are deferred
    /// until the mutable session operation has completed.
    fn add(&mut self, handler: HandlerKind) -> Result<HandlerToken, HandlerAddFailure>;
    fn remove(
        &mut self,
        handler: HandlerKind,
        token: HandlerToken,
    ) -> Result<(), Self::RemoveError>;
}

pub struct RendererSession<R: HandlerRegistry> {
    registry: R,
    ownership: SessionOwnership,
    lease: BackendRegistrationLease,
    handlers: [HandlerSlot; HANDLER_COUNT],
    registration_order: [Option<HandlerKind>; HANDLER_COUNT],
    registration_count: usize,
    cleanup: Option<SessionCleanup>,
    creator_thread: ThreadId,
    _sta_bound: PhantomData<Rc<()>>,
}

impl<R: HandlerRegistry> RendererSession<R> {
    pub fn begin(
        registry: R,
        ledger: &mut Ledger,
        ownership: SessionOwnership,
    ) -> Result<Self, RendererSessionError> {
        Self::begin_on_thread(registry, ledger, ownership, thread::current().id())
    }

    pub(crate) fn begin_on_thread(
        registry: R,
        ledger: &mut Ledger,
        ownership: SessionOwnership,
        creator_thread: ThreadId,
    ) -> Result<Self, RendererSessionError> {
        let lease = ledger.acquire_backend_registration(ownership.attempt, ownership.identity)?;
        Ok(Self {
            registry,
            ownership,
            lease,
            handlers: std::array::from_fn(|_| HandlerSlot::Unregistered),
            registration_order: [None; HANDLER_COUNT],
            registration_count: 0,
            cleanup: None,
            creator_thread,
            _sta_bound: PhantomData,
        })
    }

    pub fn register(&mut self, handler: HandlerKind) -> Result<(), RendererSessionError> {
        self.require_creator_thread()?;
        if self.cleanup.is_some() {
            return Err(RendererSessionError::SessionClosed);
        }
        if self.handlers[handler_index(handler)] != HandlerSlot::Unregistered {
            return Err(RendererSessionError::HandlerAlreadyRecorded);
        }
        match catch_unwind(AssertUnwindSafe(|| self.registry.add(handler))) {
            Ok(Ok(token)) => {
                self.handlers[handler_index(handler)] = HandlerSlot::Registered(token);
                self.registration_order[self.registration_count] = Some(handler);
                self.registration_count += 1;
                Ok(())
            }
            Ok(Err(HandlerAddFailure::RolledBack)) => {
                Err(RendererSessionError::NativeAddRolledBack)
            }
            Ok(Err(HandlerAddFailure::Unresolved)) => {
                self.quarantine_registration(handler)?;
                Err(RendererSessionError::NativeAddUnresolved)
            }
            Err(_) => {
                self.quarantine_registration(handler)?;
                Err(RendererSessionError::NativeAddPanicked)
            }
        }
    }

    fn quarantine_registration(
        &mut self,
        handler: HandlerKind,
    ) -> Result<(), RendererSessionError> {
        self.handlers[handler_index(handler)] = HandlerSlot::Unresolved;
        self.lease.quarantine(self.ownership.attempt)?;
        self.cleanup = Some(SessionCleanup::Unresolved);
        Ok(())
    }

    pub fn state(&self, handler: HandlerKind) -> HandlerState {
        match self.handlers[handler_index(handler)] {
            HandlerSlot::Unregistered => HandlerState::Unregistered,
            HandlerSlot::Registered(_) => HandlerState::Registered,
            HandlerSlot::ReleaseAttempted => HandlerState::ReleaseAttempted,
            HandlerSlot::Released => HandlerState::Released,
            HandlerSlot::Unresolved => HandlerState::Unresolved,
        }
    }

    /// Propagates a native remove panic after marking that handler attempted.
    /// Remaining handlers are not touched until an explicit retry; the attempted
    /// handler is never retried, and the backend lease remains receipt-blocking.
    pub fn cleanup(&mut self) -> Result<SessionCleanup, RendererSessionError> {
        self.require_creator_thread()?;
        if let Some(outcome) = self.cleanup {
            return Ok(outcome);
        }
        self.release_handlers();
        let released = self
            .handlers
            .iter()
            .all(|slot| matches!(slot, HandlerSlot::Unregistered | HandlerSlot::Released));
        let outcome = if released {
            self.lease.release(self.ownership.attempt)?;
            SessionCleanup::Released
        } else {
            self.lease.quarantine(self.ownership.attempt)?;
            SessionCleanup::Unresolved
        };
        self.cleanup = Some(outcome);
        Ok(outcome)
    }

    fn release_handlers(&mut self) {
        for order_index in (0..self.registration_count).rev() {
            let Some(handler) = self.registration_order[order_index] else {
                continue;
            };
            let slot = &mut self.handlers[handler_index(handler)];
            let HandlerSlot::Registered(token) =
                std::mem::replace(slot, HandlerSlot::ReleaseAttempted)
            else {
                continue;
            };
            *slot = match self.registry.remove(handler, token) {
                Ok(()) => HandlerSlot::Released,
                Err(_) => HandlerSlot::Unresolved,
            };
        }
    }

    fn require_creator_thread(&self) -> Result<(), RendererSessionError> {
        if thread::current().id() == self.creator_thread {
            Ok(())
        } else {
            Err(RendererSessionError::WrongThread)
        }
    }

    #[cfg(test)]
    pub(crate) const fn registry(&self) -> &R {
        &self.registry
    }

    #[cfg(test)]
    pub(crate) fn set_creator_thread(&mut self, creator_thread: ThreadId) {
        self.creator_thread = creator_thread;
    }
}

impl<R: HandlerRegistry> Drop for RendererSession<R> {
    fn drop(&mut self) {
        if self.cleanup.is_some() {
            return;
        }
        if thread::current().id() == self.creator_thread && !thread::panicking() {
            self.release_handlers();
        }
        let _ = self.lease.quarantine(self.ownership.attempt);
    }
}
