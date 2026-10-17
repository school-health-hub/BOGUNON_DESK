#[path = "async_surface_events.rs"]
mod events;

use crate::disposable_surface::{Completion, State};
use crate::main_boundary::{Boundary, Error as BoundaryError};
use crate::main_boundary_state::Authoritative;
use crate::surface_event_types::{Action, Binding, CommandRequest, Event as Callback};
use std::collections::VecDeque;

#[derive(Debug, Clone)]
pub enum Event {
    CreateRequested,
    CreateCompleted(Binding),
    CreateFailed(Binding),
    CloseRequested,
    CloseCompleted(Binding),
    SurfaceLost(Binding),
    CallbackArrived(Callback),
    CleanupStarted(Binding),
    CleanupConfirmed(Binding),
    CleanupFailed(Binding),
    ReplacementRequested,
}
#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Boundary(BoundaryError),
    Stale,
    Order,
    Closed,
    Overflow,
}
/// Pure model outputs: neither a native permit nor an effect request.
#[derive(Debug, PartialEq, Eq)]
pub enum SyntheticDecision {
    Idle,
    Binding(Binding),
    Accepted,
    Command(Action),
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Cleanup {
    Unknown,
    Started,
    Failed,
    Confirmed,
}

pub struct AsyncSurface {
    boundary: Boundary,
    binding: Option<Binding>,
    events: VecDeque<(Event, u64)>,
    closed: bool,
    cleanup: Cleanup,
    overflow: bool,
}
impl AsyncSurface {
    pub fn new(main: Authoritative) -> Self {
        Self {
            boundary: Boundary::new(main),
            binding: None,
            events: VecDeque::new(),
            closed: false,
            cleanup: Cleanup::Unknown,
            overflow: false,
        }
    }
    pub fn enqueue(&mut self, event: Event) -> Result<(), Error> {
        if self.events.len() == 8 {
            self.overflow = true;
            self.closed = true;
            self.boundary.protocol_fault();
            return Err(Error::Overflow);
        }
        if matches!(event, Event::CloseRequested) {
            self.closed = true;
        }
        if matches!(event, Event::CallbackArrived(_)) && self.closed {
            return Err(Error::Closed);
        }
        self.events
            .push_back((event, self.boundary.main_revision()));
        Ok(())
    }
    pub fn step(&mut self) -> Result<SyntheticDecision, Error> {
        let Some((event, revision)) = self.events.pop_front() else {
            return Ok(SyntheticDecision::Idle);
        };
        if matches!(event, Event::CallbackArrived(_)) && revision != self.boundary.main_revision() {
            return Err(Error::Boundary(BoundaryError::Revision));
        }
        self.apply(event)
    }
    fn exact(&self, binding: &Binding) -> Result<(), Error> {
        if self.binding.as_ref() == Some(binding) {
            Ok(())
        } else {
            Err(Error::Stale)
        }
    }
    fn terminal(&self) -> bool {
        matches!(
            self.state(),
            State::Absent | State::Lost(_) | State::Failed(..)
        )
    }
    fn begin(&mut self, replacement: bool) -> Result<SyntheticDecision, Error> {
        if self.overflow {
            return Err(Error::Overflow);
        }
        if !replacement && self.binding.is_some() {
            return Err(Error::Order);
        }
        if replacement && self.cleanup != Cleanup::Confirmed {
            return Err(Error::Order);
        }
        let binding = match (replacement, self.state()) {
            (true, State::Lost(_) | State::Failed(..) | State::Unsupported) => {
                self.boundary.retry_create()
            }
            (true, State::Absent) | (false, State::Absent) => self.boundary.create(),
            _ => return Err(Error::Order),
        }
        .map_err(Error::Boundary)?;
        self.binding = Some(binding.clone());
        self.cleanup = Cleanup::Unknown;
        if replacement
            && !self
                .events
                .iter()
                .any(|(event, _)| matches!(event, Event::CloseRequested))
        {
            self.closed = false;
        }
        Ok(SyntheticDecision::Binding(binding))
    }
    fn close(&mut self) -> Result<SyntheticDecision, Error> {
        self.closed = true;
        match self.state() {
            State::Available(_) => {
                let binding = self.boundary.dispose().map_err(Error::Boundary)?;
                self.binding = Some(binding.clone());
                self.cleanup = Cleanup::Unknown;
                Ok(SyntheticDecision::Binding(binding))
            }
            State::Creating(_) | State::Lost(_) => Ok(SyntheticDecision::Accepted),
            State::Absent | State::Disposing(_) | State::Failed(..) | State::Unsupported => {
                Err(Error::Order)
            }
        }
    }
    fn complete_create(
        &mut self,
        binding: &Binding,
        result: Completion,
    ) -> Result<SyntheticDecision, Error> {
        self.boundary
            .created(binding, result)
            .map_err(Error::Boundary)?;
        if self.closed && result == Completion::Succeeded {
            self.close()
        } else {
            Ok(SyntheticDecision::Accepted)
        }
    }
    pub fn process(&mut self, request: &CommandRequest) -> Result<Action, Error> {
        self.exact(request.binding())?;
        if self.closed {
            return Err(Error::Closed);
        }
        self.boundary.process(request).map_err(Error::Boundary)
    }
    pub fn update_main(&mut self, open_tasks: u32) -> Result<(), Error> {
        self.boundary
            .update_main(open_tasks)
            .map_err(Error::Boundary)
    }
    pub(crate) fn has_queued_events(&self) -> bool {
        !self.events.is_empty()
    }
    pub(crate) fn close_commands(&mut self) {
        self.closed = true;
    }
    pub(crate) fn native_fault(&mut self) {
        self.closed = true;
        self.overflow = true;
        self.boundary.protocol_fault();
    }
    pub fn state(&self) -> State {
        self.boundary.lifecycle_state()
    }
    pub fn binding(&self) -> Option<&Binding> {
        self.binding.as_ref()
    }
    #[cfg(test)]
    pub fn inspect(&self) -> &Authoritative {
        self.boundary.inspect()
    }
}
