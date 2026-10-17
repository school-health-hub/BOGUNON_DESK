use crate::disposable_surface::{Completion, State, Support, Surface, Ticket};
use crate::surface_event_types::*;

pub struct Router {
    lifecycle: Surface,
    binding: Option<Binding>,
    projection: Projection,
    last_sequence: u64,
}
impl Router {
    pub const fn new(projection: Projection, retry_limit: u8) -> Self {
        Self {
            lifecycle: Surface::new(retry_limit),
            binding: None,
            projection,
            last_sequence: 0,
        }
    }
    pub const fn state(&self) -> State {
        self.lifecycle.state()
    }
    pub fn create(&mut self, support: Support) -> Result<Binding, RouteError> {
        let operation = self
            .lifecycle
            .create(support)
            .map_err(RouteError::Lifecycle)?;
        Ok(self.bind_creation(operation))
    }
    pub fn retry_create(&mut self, support: Support) -> Result<Binding, RouteError> {
        let operation = self
            .lifecycle
            .retry_create(support)
            .map_err(RouteError::Lifecycle)?;
        Ok(self.bind_creation(operation))
    }
    pub fn created(&mut self, binding: &Binding, result: Completion) -> Result<(), RouteError> {
        self.check_binding(binding)?;
        self.lifecycle
            .created(binding.operation, result)
            .map_err(RouteError::Lifecycle)
    }
    pub fn dispose(&mut self) -> Result<Binding, RouteError> {
        let operation = self.lifecycle.dispose().map_err(RouteError::Lifecycle)?;
        self.bind_disposal(operation)
    }
    pub fn retry_dispose(&mut self) -> Result<Binding, RouteError> {
        let operation = self
            .lifecycle
            .retry_dispose()
            .map_err(RouteError::Lifecycle)?;
        self.bind_disposal(operation)
    }
    pub fn disposed(&mut self, binding: &Binding, result: Completion) -> Result<(), RouteError> {
        self.check_binding(binding)?;
        self.lifecycle
            .disposed(binding.operation, result)
            .map_err(RouteError::Lifecycle)
    }
    pub fn lost(&mut self, binding: &Binding) -> Result<(), RouteError> {
        self.check_binding(binding)?;
        self.lifecycle
            .lost(binding.operation.generation())
            .map_err(RouteError::Lifecycle)
    }
    pub fn projection(&self, binding: &Binding) -> Result<&Projection, RouteError> {
        self.check_available(binding)?;
        Ok(&self.projection)
    }
    pub fn accept(&mut self, event: Event) -> Result<CommandRequest, RouteError> {
        self.check_available(&event.binding)?;
        let next = self
            .last_sequence
            .checked_add(1)
            .ok_or(RouteError::SequenceExhausted)?;
        if event.sequence != next {
            return Err(RouteError::Sequence);
        }
        self.last_sequence = next;
        Ok(CommandRequest {
            binding: event.binding,
            sequence: next,
            action: event.action,
            revision: self.projection.revision(),
        })
    }
    fn bind_creation(&mut self, operation: Ticket) -> Binding {
        match &self.binding {
            Some(active) if active.operation == operation => return active.clone(),
            Some(_) | None => {}
        }
        let binding = Binding {
            instance: InstanceId::fresh(),
            operation,
        };
        self.binding = Some(binding.clone());
        self.last_sequence = 0;
        binding
    }
    fn bind_disposal(&mut self, operation: Ticket) -> Result<Binding, RouteError> {
        let active = self.binding.as_mut().ok_or(RouteError::Inactive)?;
        active.operation = operation;
        Ok(active.clone())
    }
    fn check_binding(&self, binding: &Binding) -> Result<(), RouteError> {
        let active = self.binding.as_ref().ok_or(RouteError::Instance)?;
        if active.instance != binding.instance {
            return Err(RouteError::Instance);
        }
        if active.operation != binding.operation {
            return Err(RouteError::Operation);
        }
        Ok(())
    }
    fn check_available(&self, binding: &Binding) -> Result<(), RouteError> {
        self.check_binding(binding)?;
        match self.lifecycle.state() {
            State::Available(generation) if generation == binding.operation.generation() => Ok(()),
            State::Absent
            | State::Creating(_)
            | State::Available(_)
            | State::Lost(_)
            | State::Disposing(_)
            | State::Failed(..)
            | State::Unsupported => Err(RouteError::Inactive),
        }
    }
}
