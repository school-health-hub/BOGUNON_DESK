use crate::{
    async_surface::{AsyncSurface, Event, SyntheticDecision},
    disposable_surface::State,
    main_boundary_state::Authoritative,
    native_contract::{Kind, Outcome, Request, Response},
    surface_event_types::{Action, CommandRequest},
};
#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Faulted,
    Pending,
    Order,
    Correlation,
    Sequence,
    Surface(crate::async_surface::Error),
}
pub struct Adapter<P = crate::native_contract::ownership_receipt::Synthetic> {
    surface: AsyncSurface,
    pending: Option<(Request, bool)>,
    sequence: u64,
    faulted: bool,
    owner: Option<crate::native_contract::verifier::OwnerReceipt<P>>,
    close_requested: bool,
    origin: Option<Request>,
}
impl<P: Clone + PartialEq> Adapter<P> {
    pub fn new(main: Authoritative) -> Self {
        Self {
            surface: AsyncSurface::new(main),
            pending: None,
            sequence: 0,
            faulted: false,
            owner: None,
            close_requested: false,
            origin: None,
        }
    }
    fn guard(&self) -> Result<(), Error> {
        if self.faulted {
            Err(Error::Faulted)
        } else {
            Ok(())
        }
    }
    fn fault<T>(&mut self, error: Error) -> Result<T, Error> {
        self.faulted = true;
        self.surface.native_fault();
        Err(error)
    }
    fn event(&mut self, event: Event) -> Result<SyntheticDecision, Error> {
        if self.surface.has_queued_events()
            && !matches!(event, Event::CloseRequested | Event::SurfaceLost(_))
        {
            return self.fault(Error::Order);
        }
        if let Err(e) = self.surface.enqueue(event) {
            return self.fault(Error::Surface(e));
        }
        loop {
            match self.surface.step() {
                Ok(SyntheticDecision::Command(_)) => return self.fault(Error::Order),
                Err(crate::async_surface::Error::Closed) => continue,
                Ok(value) => return Ok(value),
                Err(e) => return self.fault(Error::Surface(e)),
            }
        }
    }
    fn issue(&mut self, kind: Kind) -> Result<Request, Error> {
        self.guard()?;
        if self.pending.is_some() {
            return self.fault(Error::Pending);
        }
        let Some(sequence) = self.sequence.checked_add(1) else {
            return self.fault(Error::Sequence);
        };
        let Some(binding) = self.surface.binding().cloned() else {
            return self.fault(Error::Order);
        };
        self.sequence = sequence;
        let request = Request {
            kind,
            binding,
            sequence,
            expected: self.surface.state(),
        };
        self.pending = Some((request.clone(), false));
        Ok(request)
    }
    pub fn create(&mut self) -> Result<Request, Error> {
        self.guard()?;
        if self.pending.is_some() {
            return self.fault(Error::Pending);
        }
        self.event(Event::CreateRequested)?;
        self.issue(Kind::CreateOwnSurface)
    }
    pub fn replacement(&mut self) -> Result<Request, Error> {
        self.guard()?;
        if self.pending.is_some() {
            return self.fault(Error::Pending);
        }
        self.event(Event::ReplacementRequested)?;
        self.close_requested = false;
        self.issue(Kind::CreateOwnSurface)
    }
    pub fn close(&mut self) -> Result<Option<Request>, Error> {
        self.guard()?;
        if self.close_requested {
            return self.fault(Error::Pending);
        }
        self.close_requested = true;
        if let Some((request, _)) = &self.pending {
            if request.kind != Kind::CreateOwnSurface {
                return self.fault(Error::Pending);
            }
        }
        self.event(Event::CloseRequested)?;
        if matches!(self.surface.state(), State::Disposing(_)) {
            self.issue(Kind::BeginCloseOwnSurface).map(Some)
        } else {
            Ok(None)
        }
    }
    pub fn verify_cleanup(&mut self) -> Result<Request, Error> {
        self.guard()?;
        if self.pending.is_some() {
            return self.fault(Error::Pending);
        }
        let Some(binding) = self.surface.binding().cloned() else {
            return self.fault(Error::Order);
        };
        self.event(Event::CleanupStarted(binding))?;
        self.issue(Kind::VerifyOwnSurfaceCleanup)
    }
    pub fn respond(&mut self, response: Response<P>) -> Result<Option<Request>, Error> {
        self.guard()?;
        let Some((request, started)) = self.pending.clone() else {
            return self.fault(Error::Correlation);
        };
        if response.request != request || self.surface.state() != request.expected {
            return self.fault(Error::Correlation);
        }
        let binding = request.binding.clone();
        let event = match (request.kind, response.outcome, started) {
            (Kind::CreateOwnSurface, Outcome::CreateSucceeded(owner), false) => {
                if owner.creation().binding != binding
                    || owner.creation().ownership
                        != crate::native_contract::ownership_receipt::ResourceOwnership::Owned
                {
                    return self.fault(Error::Correlation);
                }
                self.owner = Some(owner);
                self.origin = Some(request.clone());
                Event::CreateCompleted(binding)
            }
            (Kind::CreateOwnSurface, Outcome::CreateFailed, false) => Event::CreateFailed(binding),
            (Kind::CreateOwnSurface, Outcome::SurfaceLost, false) => Event::SurfaceLost(binding),
            (Kind::BeginCloseOwnSurface, Outcome::CloseStarted, false) => {
                self.pending = Some((request, true));
                return Ok(None);
            }
            (Kind::BeginCloseOwnSurface, Outcome::CloseCompleted, true) => {
                Event::CloseCompleted(binding)
            }
            (Kind::VerifyOwnSurfaceCleanup, Outcome::CleanupVerified(proof), false)
                if self
                    .owner
                    .as_ref()
                    .is_some_and(|owner| proof.matches(&request, owner)) =>
            {
                Event::CleanupConfirmed(binding)
            }
            (Kind::VerifyOwnSurfaceCleanup, Outcome::CleanupFailed, false) => {
                self.event(Event::CleanupFailed(binding))?;
                return self.fault(Error::Order);
            }
            _ => return self.fault(Error::Order),
        };
        self.pending = None;
        self.event(event)?;
        if request.kind == Kind::CreateOwnSurface
            && matches!(self.surface.state(), State::Disposing(_))
        {
            return self.issue(Kind::BeginCloseOwnSurface).map(Some);
        }
        Ok(None)
    }
    pub fn surface_lost(&mut self, origin: &Request) -> Result<(), Error> {
        self.guard()?;
        if self.pending.is_some()
            || self.origin.as_ref() != Some(origin)
            || self.surface.binding() != Some(origin.binding())
            || !matches!(self.surface.state(), State::Available(_))
        {
            return self.fault(Error::Correlation);
        }
        self.surface.close_commands();
        self.event(Event::SurfaceLost(origin.binding().clone()))?;
        Ok(())
    }
    pub fn process(&mut self, request: &CommandRequest) -> Result<Action, Error> {
        self.guard()?;
        self.surface.process(request).map_err(Error::Surface)
    }
    pub fn enqueue_callback(
        &mut self,
        event: crate::surface_event_types::Event,
    ) -> Result<(), Error> {
        self.guard()?;
        match self.surface.enqueue(Event::CallbackArrived(event)) {
            Ok(()) => Ok(()),
            Err(e) => self.fault(Error::Surface(e)),
        }
    }
    pub(crate) fn native_unknown(&mut self) {
        self.faulted = true;
        self.surface.native_fault();
    }
    pub fn state(&self) -> State {
        self.surface.state()
    }
    pub const fn faulted(&self) -> bool {
        self.faulted
    }
    #[cfg(test)]
    pub fn inspect(&self) -> &Authoritative {
        self.surface.inspect()
    }
    pub fn step_callback(&mut self) -> Result<SyntheticDecision, Error> {
        self.guard()?;
        match self.surface.step() {
            Ok(decision) => Ok(decision),
            Err(e) => self.fault(Error::Surface(e)),
        }
    }
}
