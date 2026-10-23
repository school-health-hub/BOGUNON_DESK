use crate::lifecycle::Attempt;
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

const RESOURCE_COUNT: usize = 8;

const fn index(resource: Resource) -> usize {
    match resource {
        Resource::Host => 0,
        Resource::Window => 1,
        Resource::Environment => 2,
        Resource::Controller => 3,
        Resource::WebView => 4,
        Resource::ComReference => 5,
        Resource::EventToken => 6,
        Resource::BackendRegistration => 7,
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
}

pub struct Ledger {
    attempt: Attempt,
    slots: [Slot; RESOURCE_COUNT],
}

impl Ledger {
    pub const fn new(attempt: Attempt) -> Self {
        Self {
            attempt,
            slots: [Slot::NotAttempted; RESOURCE_COUNT],
        }
    }

    pub fn acquire(
        &mut self,
        attempt: Attempt,
        resource: Resource,
        identity: u64,
    ) -> Result<(), OwnershipError> {
        self.require_attempt(attempt)?;
        let slot = &mut self.slots[index(resource)];
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
        let slot = &mut self.slots[index(resource)];
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
        let slot = &mut self.slots[index(resource)];
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
        let slot = &mut self.slots[index(resource)];
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
    }

    fn require_attempt(&self, attempt: Attempt) -> Result<(), OwnershipError> {
        if self.attempt == attempt {
            Ok(())
        } else {
            Err(OwnershipError::StaleAttempt)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn releases_only_exactly_owned_resources_once() {
        let attempt = Attempt::new(1, 2).unwrap();
        let mut ledger = Ledger::new(attempt);
        assert_eq!(ledger.acquire(attempt, Resource::Window, 17), Ok(()));
        assert_eq!(
            ledger.release(attempt, Resource::Window, 18),
            Err(OwnershipError::WrongIdentity)
        );
        assert_eq!(ledger.release(attempt, Resource::Window, 17), Ok(()));
        assert_eq!(
            ledger.release(attempt, Resource::Window, 17),
            Err(OwnershipError::DuplicateRelease)
        );
        assert!(ledger.is_resolved());
    }

    #[test]
    fn partial_creation_without_a_returned_handle_is_unresolved() {
        let attempt = Attempt::new(1, 2).unwrap();
        let mut ledger = Ledger::new(attempt);
        assert_eq!(ledger.unresolved(attempt, Resource::Controller), Ok(()));
        assert!(!ledger.is_resolved());
        assert_eq!(
            ledger.release(attempt, Resource::Controller, 7),
            Err(OwnershipError::Unresolved)
        );
    }

    #[test]
    fn failed_native_release_quarantines_owned_resource_and_blocks_receipt() {
        let Some(attempt) = Attempt::new(1, 2) else {
            panic!("non-zero generation and sequence must create an attempt");
        };
        let mut ledger = Ledger::new(attempt);
        assert_eq!(ledger.acquire(attempt, Resource::Window, 17), Ok(()));

        assert_eq!(
            ledger.quarantine_release(attempt, Resource::Window, 17),
            Ok(())
        );

        assert!(!ledger.is_resolved());
        assert_eq!(
            ledger.release(attempt, Resource::Window, 17),
            Err(OwnershipError::Unresolved)
        );
    }
}
