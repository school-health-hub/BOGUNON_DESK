//! Pure, disconnected Surface contract. No Tauri caller authentication or I/O.
//! Synthetic capabilities and receipts must never authorize a native adapter.
mod registry;
pub use registry::{Binding, CleanupReceipt, Registry, Request, State};
use std::marker::PhantomData;

/// Only the Synthetic domain is constructible in this implementation.
#[derive(Debug, PartialEq, Eq)]
pub enum Synthetic {}
/// Reserved domain: no native producer or cleanup receipt issuer exists yet.
#[derive(Debug, PartialEq, Eq)]
pub enum TauriObserved {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Closed,
    Identity,
    Sequence,
    Overflow,
    MainUnavailable,
    Unavailable,
    Stale,
    Cleanup,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    OpenMain,
    RefreshProjection,
}
/// Explicit allowlist: no arbitrary strings, rows or extension map.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Projection {
    revision: u64,
}
impl Projection {
    pub const fn revision(self) -> u64 {
        self.revision
    }
}
/// An observation interface only; deliberately cannot create or mutate Main.
pub trait MainPresence {
    fn existing_admitted_main(&self) -> bool;
}
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    OpenExistingMain,
    Projection(Projection),
}
#[derive(Debug)]
pub struct Pending {
    binding: Binding,
    sequence: u64,
    publication: u64,
    outcome: Outcome,
}

/// Generic domain prevents Synthetic publication/cleanup from becoming Native evidence.
pub struct Broker<Domain> {
    registry: Registry<Domain>,
    projection: Option<Projection>,
    publication: u64,
    revision: u64,
    domain: PhantomData<Domain>,
}
impl Broker<Synthetic> {
    pub fn synthetic() -> Self {
        Self {
            registry: Registry::synthetic(),
            projection: None,
            publication: 0,
            revision: 0,
            domain: PhantomData,
        }
    }
    /// Synthetic producer only. A real approved producer is intentionally absent.
    pub fn publish_synthetic(&mut self, revision: u64) -> Result<(), Error> {
        if revision <= self.revision {
            return Err(Error::Stale);
        }
        self.invalidate_projection()?;
        self.revision = revision;
        self.projection = Some(Projection { revision });
        Ok(())
    }
}
impl<D> Broker<D> {
    pub fn registry(&self) -> &Registry<D> {
        &self.registry
    }
    pub fn registry_mut(&mut self) -> &mut Registry<D> {
        &mut self.registry
    }
    pub fn begin(&mut self, request: Request, main: &impl MainPresence) -> Result<Pending, Error> {
        let action = request.action;
        let sequence = request.sequence;
        self.registry.admit(&request)?;
        let outcome = match action {
            Action::OpenMain => {
                if !main.existing_admitted_main() {
                    return Err(Error::MainUnavailable);
                }
                Outcome::OpenExistingMain
            }
            Action::RefreshProjection => {
                Outcome::Projection(self.projection.ok_or(Error::Unavailable)?)
            }
        };
        Ok(Pending {
            binding: request.binding,
            sequence,
            publication: self.publication,
            outcome,
        })
    }
    /// Revalidate immediately before interpreting an intent; not an OS effect/ACK.
    pub fn complete(&self, pending: Pending, main: &impl MainPresence) -> Result<Outcome, Error> {
        self.registry
            .validate_pending(&pending.binding, pending.sequence)?;
        if self.publication != pending.publication {
            return Err(Error::Stale);
        }
        match pending.outcome {
            Outcome::OpenExistingMain => {
                if !main.existing_admitted_main() {
                    return Err(Error::MainUnavailable);
                }
                Ok(Outcome::OpenExistingMain)
            }
            Outcome::Projection(value) => {
                if self.projection != Some(value) {
                    return Err(Error::Stale);
                }
                Ok(Outcome::Projection(value))
            }
        }
    }
    pub fn logout(&mut self) -> Result<(), Error> {
        self.invalidate_projection()
    }
    pub fn permission_changed(&mut self) -> Result<(), Error> {
        self.invalidate_projection()
    }
    pub fn main_lost(&mut self) -> Result<(), Error> {
        self.invalidate_projection()
    }
    fn invalidate_projection(&mut self) -> Result<(), Error> {
        self.projection = None;
        match self.publication.checked_add(1) {
            Some(next) => {
                self.publication = next;
                Ok(())
            }
            None => {
                self.registry.cleanup_unknown();
                Err(Error::Overflow)
            }
        }
    }
}
#[cfg(test)]
mod tests;
