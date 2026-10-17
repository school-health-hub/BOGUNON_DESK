use super::{verify, Observations, OwnerReceipt, Ownership};
use crate::{
    native_contract::{Kind, Outcome, Request, Response},
    own_callbacks::Ledger,
    own_coordinator::{Notice, NoticeKind},
};
#[derive(Debug, Clone, Copy)]
pub enum Fault {
    None,
    PartialCreate,
    Thread,
    Token,
    Class,
    Pid,
    Tid,
    Instance,
    Destroy,
    RemainingUnknown,
    RemainingNonzero,
    Release,
    Unknown,
}
/// In-memory observations only; constants are fake handles/identities, never OS values.
pub struct Fake {
    ledger: Ledger,
    retained: Option<Ownership>,
    destroyed: bool,
    handle: usize,
    last: Option<Request>,
    close_completed: bool,
}
impl Fake {
    pub fn new() -> Self {
        Self {
            ledger: Ledger::new(),
            retained: None,
            destroyed: false,
            handle: 100,
            last: None,
            close_completed: false,
        }
    }
    pub fn execute(&mut self, request: &Request, fault: Fault) -> Response {
        if !self.valid(request) {
            return Response {
                request: request.clone(),
                outcome: Outcome::NativeOutcomeUnknown,
            };
        }
        self.last = Some(request.clone());
        let outcome = match request.kind() {
            Kind::CreateOwnSurface => self.create(request, fault),
            Kind::BeginCloseOwnSurface => self.close(request),
            Kind::VerifyOwnSurfaceCleanup => self.cleanup(request, fault),
        };
        Response {
            request: request.clone(),
            outcome,
        }
    }
    fn valid(&self, request: &Request) -> bool {
        let sequence = match &self.last {
            Some(last) => last.sequence().checked_add(1),
            None => Some(1),
        };
        if sequence != Some(request.sequence()) {
            return false;
        }
        match (request.kind(), request.expected()) {
            (Kind::CreateOwnSurface, crate::disposable_surface::State::Creating(ticket)) => {
                ticket == request.binding().operation()
            }
            (Kind::BeginCloseOwnSurface, crate::disposable_surface::State::Disposing(ticket)) => {
                ticket == request.binding().operation()
                    && self.retained.as_ref().is_some_and(|entry| {
                        entry.binding.instance() == request.binding().instance()
                    })
            }
            (
                Kind::VerifyOwnSurfaceCleanup,
                crate::disposable_surface::State::Absent
                | crate::disposable_surface::State::Lost(_)
                | crate::disposable_surface::State::Failed(..),
            ) => self
                .retained
                .as_ref()
                .is_some_and(|entry| entry.binding == *request.binding()),
            _ => false,
        }
    }
    fn create(&mut self, request: &Request, fault: Fault) -> Outcome {
        self.handle = match self.handle.checked_add(1) {
            Some(handle) => handle,
            None => return Outcome::NativeOutcomeUnknown,
        };
        let Ok(token) = self.ledger.reserve(request.binding()) else {
            return Outcome::NativeOutcomeUnknown;
        };
        if self.ledger.register(self.handle, token).is_err() {
            return Outcome::NativeOutcomeUnknown;
        }
        self.retained = Some(Ownership {
            owner: OwnerReceipt::fresh(),
            binding: request.binding().clone(),
            token,
            creator_thread: 7,
            class: 11,
            pid: 13,
            tid: 7,
        });
        self.destroyed = false;
        self.close_completed = false;
        if matches!(fault, Fault::PartialCreate | Fault::Unknown) {
            return Outcome::NativeOutcomeUnknown;
        }
        if self
            .ledger
            .notice(self.handle, NoticeKind::Created)
            .is_err()
            || self.drain(NoticeKind::Created, request).is_err()
        {
            return Outcome::NativeOutcomeUnknown;
        }
        match &self.retained {
            Some(retained) => Outcome::CreateSucceeded(retained.owner.clone()),
            None => Outcome::NativeOutcomeUnknown,
        }
    }
    fn close(&mut self, request: &Request) -> Outcome {
        if self.ledger.bind_disposal(request.binding()).is_err() {
            return Outcome::NativeOutcomeUnknown;
        }
        let Some(retained) = self.retained.as_mut() else {
            return Outcome::NativeOutcomeUnknown;
        };
        retained.binding = request.binding().clone();
        Outcome::CloseStarted
    }
    pub fn complete_close(&mut self, request: &Request) -> Response {
        if self.last.as_ref() != Some(request)
            || request.kind() != Kind::BeginCloseOwnSurface
            || self.close_completed
        {
            return Response {
                request: request.clone(),
                outcome: Outcome::NativeOutcomeUnknown,
            };
        }
        self.close_completed = true;
        let outcome = if self
            .ledger
            .notice(self.handle, NoticeKind::Destroyed)
            .is_ok()
            && self.drain(NoticeKind::Destroyed, request).is_ok()
        {
            self.destroyed = true;
            Outcome::CloseCompleted
        } else {
            Outcome::NativeOutcomeUnknown
        };
        Response {
            request: request.clone(),
            outcome,
        }
    }
    fn drain(&mut self, kind: NoticeKind, request: &Request) -> Result<(), ()> {
        let mut notices: Vec<Notice> = Vec::with_capacity(16);
        self.ledger.drain(&mut notices).map_err(|_| ())?;
        match notices.as_slice() {
            [notice] if notice.kind == kind && notice.binding == *request.binding() => Ok(()),
            _ => Err(()),
        }
    }
    fn cleanup(&mut self, request: &Request, fault: Fault) -> Outcome {
        let Some(retained) = &self.retained else {
            return Outcome::CleanupFailed;
        };
        let mut observed = Observations {
            identity: retained.clone(),
            current_thread: 7,
            destroyed: self.destroyed,
            remaining: Some(0),
            owner_released: true,
        };
        match fault {
            Fault::None | Fault::PartialCreate => {}
            Fault::Thread => observed.current_thread = 8,
            Fault::Token => observed.identity.token += 1,
            Fault::Class => observed.identity.class += 1,
            Fault::Pid => observed.identity.pid += 1,
            Fault::Tid => observed.identity.tid += 1,
            Fault::Instance => observed.identity.owner = OwnerReceipt::fresh(),
            Fault::Destroy => observed.destroyed = false,
            Fault::RemainingUnknown => observed.remaining = None,
            Fault::RemainingNonzero => observed.remaining = Some(1),
            Fault::Release => observed.owner_released = false,
            Fault::Unknown => return Outcome::NativeOutcomeUnknown,
        }
        match verify(request, retained, &self.ledger, &observed) {
            Ok(proof) => Outcome::CleanupVerified(proof),
            Err(_) => Outcome::CleanupFailed,
        }
    }
    pub fn overflow_callbacks(&mut self, origin: &Request) -> Response {
        let overflow = (0..17).any(|_| {
            self.ledger
                .notice(self.handle, NoticeKind::CloseRequested)
                .is_err()
        });
        Response {
            request: origin.clone(),
            outcome: if overflow {
                Outcome::NativeOutcomeUnknown
            } else {
                Outcome::CleanupFailed
            },
        }
    }
}
