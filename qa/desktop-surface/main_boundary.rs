use std::collections::VecDeque;

use crate::disposable_surface::{Completion, State, Support};
use crate::main_boundary_state::Authoritative;
use crate::surface_event_router::Router;
use crate::surface_event_types::{Action, Binding, CommandRequest, Event, Projection, RouteError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Route(RouteError),
    Instance,
    Generation,
    Operation,
    Unavailable,
    Sequence,
    Permission,
    Disallowed,
    CleanupUncertain,
    ProtocolFault,
    Revision,
}

/// Main-side coordinator policy; lifecycle transitions remain owned by Router/Surface.
pub struct Boundary {
    main: Authoritative,
    router: Router,
    binding: Option<Binding>,
    cleanup_uncertain: bool,
    fault: bool,
    allow_open: bool,
    pending: VecDeque<CommandRequest>,
}
impl Boundary {
    pub fn new(main: Authoritative) -> Self {
        let router = Router::new(main.projection(), 3);
        Self {
            main,
            router,
            binding: None,
            cleanup_uncertain: false,
            fault: false,
            allow_open: true,
            pending: VecDeque::new(),
        }
    }
    pub fn create(&mut self) -> Result<Binding, Error> {
        self.creation(false)
    }
    pub fn retry_create(&mut self) -> Result<Binding, Error> {
        self.creation(true)
    }
    fn creation(&mut self, retry: bool) -> Result<Binding, Error> {
        if self.cleanup_uncertain {
            return Err(Error::CleanupUncertain);
        }
        if self.fault {
            return Err(Error::ProtocolFault);
        }
        let binding = if retry {
            self.router.retry_create(Support::Supported)
        } else {
            self.router.create(Support::Supported)
        }
        .map_err(Error::Route)?;
        self.binding = Some(binding.clone());
        self.pending.clear();
        self.cleanup_uncertain = true;
        Ok(binding)
    }
    pub fn created(&mut self, binding: &Binding, result: Completion) -> Result<(), Error> {
        let result = self.router.created(binding, result).map_err(Error::Route);
        self.callback_result(result)
    }
    pub fn lost(&mut self, binding: &Binding) -> Result<(), Error> {
        let result = self.router.lost(binding).map_err(Error::Route);
        self.cleanup_uncertain = true;
        self.callback_result(result)
    }
    pub fn dispose(&mut self) -> Result<Binding, Error> {
        let binding = self.router.dispose().map_err(Error::Route)?;
        self.binding = Some(binding.clone());
        self.cleanup_uncertain = true;
        Ok(binding)
    }
    pub fn disposed(&mut self, binding: &Binding, result: Completion) -> Result<(), Error> {
        let result = self.router.disposed(binding, result).map_err(Error::Route);
        self.callback_result(result)
    }
    fn callback_result(&mut self, result: Result<(), Error>) -> Result<(), Error> {
        if result.is_err() {
            self.protocol_fault();
        }
        result
    }
    /// Explicit synthetic confirmation only. This is not native cleanup evidence.
    pub fn confirm_cleanup(&mut self, binding: &Binding) -> Result<(), Error> {
        self.check_binding(binding)?;
        match self.router.state() {
            State::Absent | State::Lost(_) | State::Failed(..) => {}
            State::Creating(_) | State::Available(_) | State::Disposing(_) | State::Unsupported => {
                return Err(Error::Unavailable)
            }
        }
        self.cleanup_uncertain = false;
        self.fault = false;
        self.pending.clear();
        Ok(())
    }
    pub fn protocol_fault(&mut self) {
        self.fault = true;
        self.cleanup_uncertain = true;
    }
    fn check_binding(&self, binding: &Binding) -> Result<(), Error> {
        let current = self.binding.as_ref().ok_or(Error::Instance)?;
        if current.instance() != binding.instance() {
            return Err(Error::Instance);
        }
        if current.operation().generation() != binding.operation().generation() {
            return Err(Error::Generation);
        }
        if current.operation() != binding.operation() {
            return Err(Error::Operation);
        }
        Ok(())
    }
    fn available(&self, binding: &Binding) -> Result<(), Error> {
        self.check_binding(binding)?;
        if self.fault {
            return Err(Error::ProtocolFault);
        }
        self.router
            .projection(binding)
            .map_err(|_| Error::Unavailable)?;
        Ok(())
    }
    pub fn projection(&self, binding: &Binding) -> Result<&Projection, Error> {
        self.available(binding)?;
        self.router.projection(binding).map_err(Error::Route)
    }
    pub fn route(&mut self, event: Event) -> Result<CommandRequest, Error> {
        self.available(&event.binding)?;
        if self.pending.len() == 8 {
            self.protocol_fault();
            return Err(Error::ProtocolFault);
        }
        let request = self.router.accept(event).map_err(Error::Route)?;
        self.pending.push_back(CommandRequest {
            binding: request.binding().clone(),
            sequence: request.sequence(),
            action: request.action(),
            revision: request.revision(),
        });
        Ok(request)
    }
    /// Rechecks current Main authority and lifecycle after queueing, before any decision.
    pub fn process(&mut self, request: &CommandRequest) -> Result<Action, Error> {
        self.available(request.binding())?;
        if self.pending.front() != Some(request) {
            return Err(Error::Sequence);
        }
        self.pending.pop_front();
        if request.revision() != self.main.projection().revision() {
            return Err(Error::Revision);
        }
        if !self.main.authorized() {
            return Err(Error::Permission);
        }
        match request.action() {
            Action::OpenMain if !self.allow_open => Err(Error::Disallowed),
            Action::OpenMain | Action::RefreshProjection => Ok(request.action()),
        }
    }
    pub fn observe_notices(
        &mut self,
        binding: &Binding,
        notices: Vec<crate::own_coordinator::Notice>,
    ) -> Result<(), Error> {
        if self.check_binding(binding).is_err() {
            self.protocol_fault();
            return Err(Error::ProtocolFault);
        }
        if crate::own_coordinator::observed(&mut self.router, binding, notices).is_err() {
            self.protocol_fault();
            return Err(Error::ProtocolFault);
        }
        Ok(())
    }
    pub(super) fn main_revision(&self) -> u64 {
        self.main.projection().revision()
    }
    pub(super) fn lifecycle_state(&self) -> State {
        self.router.state()
    }
    /// Trusted Main host update; never part of the Surface event schema.
    pub(super) fn update_main(&mut self, open_tasks: u32) -> Result<(), Error> {
        let projection = self.main.update(open_tasks).ok_or(Error::Revision)?;
        self.router.refresh_projection(projection);
        Ok(())
    }
    pub fn set_authenticated(&mut self, authenticated: bool) {
        self.main.set_authenticated(authenticated);
    }
    pub fn set_permission(&mut self, permission: bool) {
        self.main.set_permission(permission);
    }
    pub fn allow_open(&mut self, allowed: bool) {
        self.allow_open = allowed;
    }
    #[cfg(test)]
    pub fn inspect(&self) -> &Authoritative {
        &self.main
    }
}
