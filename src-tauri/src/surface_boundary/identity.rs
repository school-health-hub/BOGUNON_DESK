use std::{num::NonZeroU64, sync::Arc};

#[derive(Debug, Clone)]
pub(crate) struct AttemptBinding {
    instance: Arc<()>,
    generation: NonZeroU64,
    operation: Arc<()>,
}

impl AttemptBinding {
    pub(crate) fn new(generation: NonZeroU64) -> Self {
        Self {
            instance: Arc::new(()),
            generation,
            operation: Arc::new(()),
        }
    }

    pub(crate) fn matches(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.instance, &other.instance)
            && self.generation == other.generation
            && Arc::ptr_eq(&self.operation, &other.operation)
    }

    #[cfg(test)]
    pub(super) fn with_generation(mut self, generation: NonZeroU64) -> Self {
        self.generation = generation;
        self
    }
}

#[derive(Debug, Clone)]
pub(crate) struct IdentityToken(Arc<()>);

impl IdentityToken {
    pub(crate) fn new() -> Self {
        Self(Arc::new(()))
    }

    pub(crate) fn matches(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct DirectoryIdentity {
    volume: u64,
    file: u128,
}

impl DirectoryIdentity {
    pub(crate) const fn new(volume: u64, file: u128) -> Self {
        Self { volume, file }
    }
}
