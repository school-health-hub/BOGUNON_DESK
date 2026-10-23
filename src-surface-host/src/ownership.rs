use crate::lifecycle::Attempt;
use std::{cell::Cell, fmt, rc::Rc};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Resource {
    Host,
    Window,
    Environment,
    Controller,
    WebView,
    ComReference,
    EventToken,
    BackendRegistration,
}

const RESOURCE_COUNT: usize = 7;

const fn index(resource: Resource) -> Option<usize> {
    match resource {
        Resource::Host => Some(0),
        Resource::Window => Some(1),
        Resource::Environment => Some(2),
        Resource::Controller => Some(3),
        Resource::WebView => Some(4),
        Resource::ComReference => Some(5),
        Resource::EventToken => Some(6),
        Resource::BackendRegistration => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Slot {
    NotAttempted,
    Owned(u64),
    Unresolved,
    Released(u64),
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum OwnershipError {
    #[error("operation belongs to a stale attempt")]
    StaleAttempt,
    #[error("resource has already been recorded")]
    AlreadyRecorded,
    #[error("resource is not owned by this attempt")]
    NotOwned,
    #[error("resource identity does not match")]
    WrongIdentity,
    #[error("resource was already released")]
    DuplicateRelease,
    #[error("resource ownership is unresolved")]
    Unresolved,
    #[error("backend registration requires its ownership lease")]
    LeaseRequired,
}

#[derive(Clone)]
pub(crate) struct LedgerIdentity(Rc<()>);

impl fmt::Debug for LedgerIdentity {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("LedgerIdentity(<redacted>)")
    }
}

impl PartialEq for LedgerIdentity {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl Eq for LedgerIdentity {}

pub struct Ledger {
    attempt: Attempt,
    slots: [Slot; RESOURCE_COUNT],
    backend_registration: Rc<Cell<Slot>>,
    identity: LedgerIdentity,
    cleanup_authority_issued: bool,
}

impl Ledger {
    pub fn new(attempt: Attempt) -> Self {
        let identity = LedgerIdentity(Rc::new(()));
        Self {
            attempt,
            slots: [Slot::NotAttempted; RESOURCE_COUNT],
            backend_registration: Rc::new(Cell::new(Slot::NotAttempted)),
            identity,
            cleanup_authority_issued: false,
        }
    }

    pub(crate) fn identity(&self) -> LedgerIdentity {
        self.identity.clone()
    }

    pub(crate) fn claim_cleanup_authority(
        &mut self,
        attempt: Attempt,
    ) -> Result<LedgerIdentity, OwnershipError> {
        self.require_attempt(attempt)?;
        if self.cleanup_authority_issued {
            return Err(OwnershipError::AlreadyRecorded);
        }
        self.cleanup_authority_issued = true;
        Ok(self.identity())
    }

    pub(crate) fn acquire_backend_registration(
        &mut self,
        attempt: Attempt,
        identity: u64,
    ) -> Result<BackendRegistrationLease, OwnershipError> {
        self.require_attempt(attempt)?;
        if self.backend_registration.get() != Slot::NotAttempted {
            return Err(OwnershipError::AlreadyRecorded);
        }
        self.backend_registration.set(Slot::Owned(identity));
        Ok(BackendRegistrationLease {
            attempt,
            identity,
            slot: Rc::clone(&self.backend_registration),
        })
    }

    pub fn acquire(
        &mut self,
        attempt: Attempt,
        resource: Resource,
        identity: u64,
    ) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        let Some(index) = index(resource) else {
            return Err(OwnershipError::LeaseRequired);
        };
        let slot = &mut self.slots[index];
        if *slot != Slot::NotAttempted {
            return Err(OwnershipError::AlreadyRecorded);
        }
        *slot = Slot::Owned(identity);
        Ok(())
    }

    pub fn unresolved(
        &mut self,
        attempt: Attempt,
        resource: Resource,
    ) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        let Some(index) = index(resource) else {
            return Err(OwnershipError::LeaseRequired);
        };
        let slot = &mut self.slots[index];
        if *slot != Slot::NotAttempted {
            return Err(OwnershipError::AlreadyRecorded);
        }
        *slot = Slot::Unresolved;
        Ok(())
    }

    pub fn release(
        &mut self,
        attempt: Attempt,
        resource: Resource,
        identity: u64,
    ) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        let Some(index) = index(resource) else {
            return Err(OwnershipError::LeaseRequired);
        };
        let slot = &mut self.slots[index];
        match *slot {
            Slot::Owned(value) if value == identity => {
                *slot = Slot::Released(identity);
                Ok(())
            }
            Slot::Owned(_) => Err(OwnershipError::WrongIdentity),
            Slot::Released(value) if value == identity => Err(OwnershipError::DuplicateRelease),
            Slot::Released(_) => Err(OwnershipError::WrongIdentity),
            Slot::Unresolved => Err(OwnershipError::Unresolved),
            Slot::NotAttempted => Err(OwnershipError::NotOwned),
        }
    }

    pub fn quarantine_release(
        &mut self,
        attempt: Attempt,
        resource: Resource,
        identity: u64,
    ) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        let Some(index) = index(resource) else {
            return Err(OwnershipError::LeaseRequired);
        };
        let slot = &mut self.slots[index];
        match *slot {
            Slot::Owned(value) if value == identity => {
                *slot = Slot::Unresolved;
                Ok(())
            }
            Slot::Owned(_) | Slot::Released(_) => Err(OwnershipError::WrongIdentity),
            Slot::Unresolved => Err(OwnershipError::Unresolved),
            Slot::NotAttempted => Err(OwnershipError::NotOwned),
        }
    }

    pub fn is_resolved(&self) -> bool {
        self.slots
            .iter()
            .all(|slot| matches!(slot, Slot::NotAttempted | Slot::Released(_)))
            && matches!(
                self.backend_registration.get(),
                Slot::NotAttempted | Slot::Released(_)
            )
    }

    #[cfg(test)]
    pub(crate) fn backend_registration_is_unresolved(&self) -> bool {
        self.backend_registration.get() == Slot::Unresolved
    }

    fn require_attempt(&self, attempt: Attempt) -> Result<(), OwnershipError> {
        if self.attempt == attempt {
            Ok(())
        } else {
            Err(OwnershipError::StaleAttempt)
        }
    }
}

pub(crate) struct BackendRegistrationLease {
    attempt: Attempt,
    identity: u64,
    slot: Rc<Cell<Slot>>,
}

impl BackendRegistrationLease {
    pub(crate) fn release(&mut self, attempt: Attempt) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        match self.slot.get() {
            Slot::Owned(value) if value == self.identity => {
                self.slot.set(Slot::Released(self.identity));
                Ok(())
            }
            Slot::Owned(_) | Slot::Released(_) => Err(OwnershipError::WrongIdentity),
            Slot::Unresolved => Err(OwnershipError::Unresolved),
            Slot::NotAttempted => Err(OwnershipError::NotOwned),
        }
    }

    pub(crate) fn quarantine(&mut self, attempt: Attempt) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        match self.slot.get() {
            Slot::Owned(value) if value == self.identity => {
                self.slot.set(Slot::Unresolved);
                Ok(())
            }
            Slot::Unresolved => Ok(()),
            Slot::Owned(_) | Slot::Released(_) => Err(OwnershipError::WrongIdentity),
            Slot::NotAttempted => Err(OwnershipError::NotOwned),
        }
    }

    fn require_attempt(&self, attempt: Attempt) -> Result<(), OwnershipError> {
        if self.attempt == attempt {
            Ok(())
        } else {
            Err(OwnershipError::StaleAttempt)
        }
    }
}

impl Drop for BackendRegistrationLease {
    fn drop(&mut self) {
        if self.slot.get() == Slot::Owned(self.identity) {
            self.slot.set(Slot::Unresolved);
        }
    }
}
