//! Pure C-2B broker contract. It performs no Tauri IPC, I/O or native creation.

mod policy;
mod projection;
mod registry;

pub(crate) use policy::RequestKind;
pub(crate) use projection::Projection;
pub(crate) use registry::{Binding, RegistryState, Request};

use projection::Publication;
use registry::Registry;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BrokerError {
    UnsupportedRequest,
    UnregisteredSurface,
    StaleGeneration,
    StaleRequest,
    SequenceOverflow,
    LeaseExpired,
    SurfaceRetired,
    MainUnavailable,
    ProjectionUnavailable,
    StaleRevision,
    PublicationOverflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BrokerResponse {
    OpenExistingMain,
    Projection(Projection),
}

pub(crate) trait MainPresence {
    fn existing_admitted_main(&self) -> bool;
}

#[derive(Debug)]
pub(crate) struct PendingResponse {
    binding: Binding,
    sequence: u64,
    main_epoch: u64,
    publication_epoch: u64,
    response: BrokerResponse,
}

pub(crate) struct Broker {
    registry: Registry,
    publication: Publication,
    main_epoch: u64,
    main_admitted: bool,
}

impl Broker {
    pub(crate) fn new() -> Self {
        Self {
            registry: Registry::new(),
            publication: Publication::new(),
            main_epoch: 1,
            main_admitted: true,
        }
    }

    pub(crate) fn binding(&self) -> Binding {
        self.registry.binding()
    }

    pub(crate) const fn state(&self) -> RegistryState {
        self.registry.state()
    }

    pub(crate) fn publish_revision(
        &mut self,
        revision: u64,
        main: &impl MainPresence,
    ) -> Result<(), BrokerError> {
        self.require_main(main)?;
        if let Err(error) = self.publication.publish(revision) {
            if error == BrokerError::PublicationOverflow {
                self.registry.fail_closed();
            }
            return Err(error);
        }
        Ok(())
    }

    pub(crate) fn begin(
        &mut self,
        request: Request,
        main: &impl MainPresence,
    ) -> Result<PendingResponse, BrokerError> {
        self.registry.admit(&request)?;
        self.require_main(main)?;
        let (response, publication_epoch) = match request.kind {
            RequestKind::OpenMain => (BrokerResponse::OpenExistingMain, 0),
            RequestKind::RefreshProjection => {
                let (projection, epoch) = self
                    .publication
                    .snapshot()
                    .ok_or(BrokerError::ProjectionUnavailable)?;
                (BrokerResponse::Projection(projection), epoch)
            }
        };
        Ok(PendingResponse {
            binding: request.binding,
            sequence: request.sequence,
            main_epoch: self.main_epoch,
            publication_epoch,
            response,
        })
    }

    pub(crate) fn complete(
        &self,
        pending: PendingResponse,
        main: &impl MainPresence,
    ) -> Result<BrokerResponse, BrokerError> {
        self.registry
            .validate_pending(&pending.binding, pending.sequence)?;
        self.require_main(main)?;
        if self.main_epoch != pending.main_epoch {
            return Err(BrokerError::StaleRequest);
        }
        match pending.response {
            BrokerResponse::OpenExistingMain => Ok(BrokerResponse::OpenExistingMain),
            BrokerResponse::Projection(projection) => {
                if !self
                    .publication
                    .is_current(projection, pending.publication_epoch)
                {
                    return Err(BrokerError::StaleRequest);
                }
                Ok(BrokerResponse::Projection(projection))
            }
        }
    }

    pub(crate) fn invalidate_projection(&mut self) -> Result<(), BrokerError> {
        if let Err(error) = self.publication.invalidate() {
            self.registry.fail_closed();
            return Err(error);
        }
        Ok(())
    }

    pub(crate) fn retire_main(&mut self) -> Result<(), BrokerError> {
        self.main_admitted = false;
        let Some(next_epoch) = self.main_epoch.checked_add(1) else {
            self.registry.fail_closed();
            return Err(BrokerError::PublicationOverflow);
        };
        self.main_epoch = next_epoch;
        self.invalidate_projection()
    }

    pub(crate) fn expire_surface_lease(&mut self) {
        self.registry.expire_lease();
    }

    pub(crate) fn retire_surface(&mut self) {
        self.registry.retire();
    }

    fn require_main(&self, main: &impl MainPresence) -> Result<(), BrokerError> {
        if self.main_admitted && main.existing_admitted_main() {
            Ok(())
        } else {
            Err(BrokerError::MainUnavailable)
        }
    }
}

#[cfg(test)]
mod tests;
