use super::{BrokerError, RequestKind};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub(crate) struct Binding {
    instance: Arc<()>,
    generation: u64,
    operation: Arc<()>,
}

impl Binding {
    pub(crate) fn request(&self, sequence: u64, kind: RequestKind) -> Request {
        Request {
            binding: self.clone(),
            sequence,
            kind,
        }
    }

    #[cfg(test)]
    pub(super) fn with_generation(mut self, generation: u64) -> Self {
        self.generation = generation;
        self
    }
}

#[derive(Debug)]
pub(crate) struct Request {
    pub(super) binding: Binding,
    pub(super) sequence: u64,
    pub(super) kind: RequestKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RegistryState {
    Active,
    LeaseExpired,
    Retired,
    FailedClosed,
}

pub(super) struct Registry {
    binding: Binding,
    sequence: u64,
    state: RegistryState,
}

impl Registry {
    pub(super) fn new() -> Self {
        Self {
            binding: Binding {
                instance: Arc::new(()),
                generation: 1,
                operation: Arc::new(()),
            },
            sequence: 0,
            state: RegistryState::Active,
        }
    }

    pub(super) fn binding(&self) -> Binding {
        self.binding.clone()
    }

    pub(super) const fn state(&self) -> RegistryState {
        self.state
    }

    pub(super) fn expire_lease(&mut self) {
        if self.state == RegistryState::Active {
            self.state = RegistryState::LeaseExpired;
        }
    }

    pub(super) fn retire(&mut self) {
        if self.state != RegistryState::FailedClosed {
            self.state = RegistryState::Retired;
        }
    }

    pub(super) fn fail_closed(&mut self) {
        self.state = RegistryState::FailedClosed;
    }

    pub(super) fn admit(&mut self, request: &Request) -> Result<(), BrokerError> {
        match self.state {
            RegistryState::Active => {}
            RegistryState::LeaseExpired => return Err(BrokerError::LeaseExpired),
            RegistryState::Retired | RegistryState::FailedClosed => {
                return Err(BrokerError::SurfaceRetired);
            }
        }
        if !Arc::ptr_eq(&self.binding.instance, &request.binding.instance)
            || !Arc::ptr_eq(&self.binding.operation, &request.binding.operation)
        {
            return Err(BrokerError::UnregisteredSurface);
        }
        if self.binding.generation != request.binding.generation {
            return Err(BrokerError::StaleGeneration);
        }
        if request.sequence <= self.sequence {
            return Err(BrokerError::StaleRequest);
        }
        if request.sequence == u64::MAX {
            self.state = RegistryState::FailedClosed;
            return Err(BrokerError::SequenceOverflow);
        }
        self.sequence = request.sequence;
        Ok(())
    }

    pub(super) fn validate_pending(
        &self,
        binding: &Binding,
        sequence: u64,
    ) -> Result<(), BrokerError> {
        match self.state {
            RegistryState::Active => {}
            RegistryState::LeaseExpired => return Err(BrokerError::LeaseExpired),
            RegistryState::Retired | RegistryState::FailedClosed => {
                return Err(BrokerError::SurfaceRetired);
            }
        }
        if !Arc::ptr_eq(&self.binding.instance, &binding.instance)
            || !Arc::ptr_eq(&self.binding.operation, &binding.operation)
        {
            return Err(BrokerError::UnregisteredSurface);
        }
        if self.binding.generation != binding.generation {
            return Err(BrokerError::StaleGeneration);
        }
        if self.sequence != sequence {
            return Err(BrokerError::StaleRequest);
        }
        Ok(())
    }
}
