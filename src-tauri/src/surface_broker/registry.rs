use super::{Action, Error, Synthetic, TauriObserved};
use std::{marker::PhantomData, sync::Arc};

#[derive(Debug, Clone)]
pub struct Binding {
    instance: Arc<()>,
    pub(super) generation: u64,
    pub(super) operation: Arc<()>,
}
impl Binding {
    pub(crate) fn matches(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.instance, &other.instance)
            && self.generation == other.generation
            && Arc::ptr_eq(&self.operation, &other.operation)
    }
}
#[derive(Debug)]
pub struct Request {
    pub(super) binding: Binding,
    pub(super) sequence: u64,
    pub(super) action: Action,
}
impl Binding {
    /// In-process model input, never a credential for JS or Tauri IPC.
    pub fn request(&self, sequence: u64, action: Action) -> Request {
        Request {
            binding: self.clone(),
            sequence,
            action,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Active,
    Retiring,
    Retired,
    CleanupUnknown,
}
/// Not Clone, not Deserialize; Native QA Proof is not accepted here.
#[derive(Debug)]
pub struct CleanupReceipt<Domain> {
    binding: Binding,
    domain: PhantomData<Domain>,
}
#[derive(Debug)]
pub struct Registry<Domain> {
    binding: Binding,
    sequence: u64,
    state: State,
    domain: PhantomData<Domain>,
}
impl Registry<Synthetic> {
    pub fn synthetic() -> Self {
        Self {
            binding: Binding {
                instance: Arc::new(()),
                generation: 1,
                operation: Arc::new(()),
            },
            sequence: 0,
            state: State::Active,
            domain: PhantomData,
        }
    }
    /// Explicit model confirmation only; not actual Tauri cleanup evidence.
    pub fn confirm_synthetic_cleanup(&mut self) -> Result<CleanupReceipt<Synthetic>, Error> {
        match self.state {
            State::Retiring => {
                self.state = State::Retired;
                Ok(CleanupReceipt {
                    binding: self.binding.clone(),
                    domain: PhantomData,
                })
            }
            State::Active | State::Retired | State::CleanupUnknown => Err(Error::Cleanup),
        }
    }
}
impl Registry<TauriObserved> {
    pub(crate) fn adapter_reservation() -> Self {
        Self {
            binding: Binding {
                instance: Arc::new(()),
                generation: 1,
                operation: Arc::new(()),
            },
            sequence: 0,
            state: State::Active,
            domain: PhantomData,
        }
    }
}
impl<D> Registry<D> {
    pub fn binding(&self) -> Binding {
        self.binding.clone()
    }
    pub const fn state(&self) -> State {
        self.state
    }
    pub fn retiring(&mut self) -> Result<(), Error> {
        match self.state {
            State::Active => {
                self.state = State::Retiring;
                Ok(())
            }
            State::Retiring | State::Retired | State::CleanupUnknown => Err(Error::Closed),
        }
    }
    pub fn lost(&mut self) {
        self.cleanup_unknown();
    }
    pub fn cleanup_unknown(&mut self) {
        self.state = State::CleanupUnknown;
    }
    pub fn replace(&mut self, receipt: CleanupReceipt<D>) -> Result<(), Error> {
        if self.state != State::Retired || !self.binding.matches(&receipt.binding) {
            return Err(Error::Cleanup);
        }
        let Some(next) = self.binding.generation.checked_add(1) else {
            self.cleanup_unknown();
            return Err(Error::Overflow);
        };
        self.binding = Binding {
            instance: Arc::new(()),
            generation: next,
            operation: Arc::new(()),
        };
        self.sequence = 0;
        self.state = State::Active;
        Ok(())
    }
    pub(super) fn admit(&mut self, request: &Request) -> Result<(), Error> {
        self.admit_lifecycle(&request.binding, request.sequence)
    }
    pub(crate) fn admit_lifecycle(
        &mut self,
        binding: &Binding,
        sequence: u64,
    ) -> Result<(), Error> {
        if self.state != State::Active {
            return Err(Error::Closed);
        }
        if !self.binding.matches(binding) {
            return Err(Error::Identity);
        }
        if sequence <= self.sequence {
            return Err(Error::Sequence);
        }
        // Reserve the terminal value as a fail-closed exhaustion signal.
        if sequence == u64::MAX {
            self.cleanup_unknown();
            return Err(Error::Overflow);
        }
        self.sequence = sequence;
        Ok(())
    }
    pub(super) fn validate_pending(&self, binding: &Binding, sequence: u64) -> Result<(), Error> {
        if self.state != State::Active {
            return Err(Error::Closed);
        }

        if !self.binding.matches(binding) {
            return Err(Error::Identity);
        }
        if self.sequence != sequence {
            return Err(Error::Stale);
        }
        Ok(())
    }
}
