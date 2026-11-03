use super::{
    machine::{Machine, Progress, Request},
    model::*,
};
use crate::{
    lifecycle::Attempt,
    ownership::{BackendRegistrationLease, Ledger, Resource},
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) struct Context {
    pub attempt: Attempt,
    pub owner: WindowIdentity,
    pub explorer: ProcessIdentity,
    pub sequence: u64,
}
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(super) enum Rejection {
    Session,
    Owner,
    Explorer,
    Replay,
    Retired,
    Busy,
    CleanupUnknown,
    Ownership,
}
/// Trusted Host-local adapter, not a new wire parser or replacement for authenticated S-3 admission.
pub(super) struct HostTransaction {
    machine: Machine,
    binding: Context,
    last: u64,
    retired: bool,
    unknown: bool,
    ledger: Ledger,
    lease: Option<BackendRegistrationLease>,
    active: Option<OperationId>,
}
impl HostTransaction {
    pub fn new(binding: Context) -> Result<Self, Rejection> {
        if Attempt::new(binding.attempt.generation, binding.attempt.nonce).is_none()
            || binding.owner.handle == 0
            || binding.owner.process.pid == 0
            || binding.owner.process.creation_time == 0
            || binding.owner.process.verified_image == 0
            || binding.owner.thread == 0
            || binding.owner.generation == 0
            || binding.explorer.pid == 0
            || binding.explorer.creation_time == 0
            || binding.explorer.verified_image == 0
            || binding.explorer.pid == binding.owner.process.pid
        {
            return Err(Rejection::Session);
        }
        let mut ledger = Ledger::new(binding.attempt);
        ledger
            .acquire(binding.attempt, Resource::Window, binding.owner.handle)
            .map_err(|_| Rejection::Ownership)?;
        Ok(Self {
            machine: Machine::default(),
            binding,
            last: 0,
            retired: false,
            unknown: false,
            ledger,
            lease: None,
            active: None,
        })
    }
    pub fn state(&self) -> &'static str {
        if self.unknown {
            return "CleanupUnknown";
        }
        match self.machine.state() {
            State::NormalWindow | State::ProbeReady => "Detached",
            State::Attaching => "Preparing",
            State::Attached => "ModelAttached",
            State::Detaching => "Recovering",
            State::Fallback => "Detached",
            State::Failed => "CleanupUnknown",
        }
    }
    fn admit(&mut self, c: Context) -> Result<(), Rejection> {
        if self.unknown {
            return Err(Rejection::CleanupUnknown);
        }
        if c.attempt != self.binding.attempt {
            return Err(Rejection::Session);
        }
        if c.owner != self.binding.owner {
            return Err(Rejection::Owner);
        }
        if c.explorer != self.binding.explorer {
            return Err(Rejection::Explorer);
        }
        if c.sequence == 0 || c.sequence <= self.last || c.sequence == u64::MAX {
            return Err(Rejection::Replay);
        }
        self.last = c.sequence;
        Ok(())
    }
    pub fn attach(&mut self, c: Context) -> Result<OperationId, Rejection> {
        self.admit(c)?;
        if self.retired {
            return Err(Rejection::Retired);
        }
        if self.lease.is_some() {
            return Err(Rejection::Busy);
        }
        self.lease = Some(
            self.ledger
                .acquire_backend_registration(c.attempt, c.attempt.nonce)
                .map_err(|_| Rejection::Ownership)?,
        );
        self.machine.probe(true);
        if let Request::Started(id) = self.machine.attach() {
            self.active = Some(id);
            Ok(id)
        } else {
            self.quarantine();
            Err(Rejection::Busy)
        }
    }
    pub fn detach(&mut self, c: Context) -> Result<OperationId, Rejection> {
        self.admit(c)?;
        if self.retired {
            return Err(Rejection::Retired);
        }
        self.retired = true;
        match self.machine.detach() {
            Request::Started(id) | Request::Joined(id) => {
                self.active = Some(id);
                Ok(id)
            }
            _ => Err(Rejection::Busy),
        }
    }
    pub fn step(&mut self, id: OperationId, adapter: &mut impl Adapter) -> Progress {
        if self.unknown {
            return Progress::Stale;
        }
        let mut bound = Bound {
            inner: adapter,
            owner: self.binding.owner,
            explorer: self.binding.explorer,
        };
        let progress = self.machine.advance(id, &mut bound);
        if self.machine.state() == State::Failed {
            self.quarantine();
        }
        if progress == Progress::Finished && self.machine.state() != State::Attached {
            self.retired = true;
            self.active = None;
            // Restoration is not window destruction and cannot resolve the Window resource.
            if let Some(lease) = &mut self.lease {
                if lease.release(self.binding.attempt).is_err() {
                    self.quarantine();
                }
            }
        }
        progress
    }
    pub fn explorer_changed(&mut self, identity: ProcessIdentity) {
        if identity != self.binding.explorer {
            self.quarantine();
        }
    }
    pub fn host_lost(&mut self) {
        self.quarantine();
    }
    pub const fn return_to_normal(&self) -> bool {
        true
    }
    pub fn native_cleanup_verified(&self) -> bool {
        self.ledger.is_resolved()
    }
    fn quarantine(&mut self) {
        self.unknown = true;
        self.retired = true;
        if let Some(lease) = &mut self.lease {
            let _ = lease.quarantine(self.binding.attempt);
        }
    }
}
struct Bound<'a, A: Adapter> {
    inner: &'a mut A,
    owner: WindowIdentity,
    explorer: ProcessIdentity,
}
impl<A: Adapter> Adapter for Bound<'_, A> {
    fn snapshot(&mut self) -> Result<Snapshot, Failure> {
        let s = self.inner.snapshot()?;
        if s.window.main != self.owner {
            return Err(Failure::MainIdentity);
        }
        if s.explorer != self.explorer {
            return Err(Failure::ExplorerIdentity);
        }
        Ok(s)
    }
    fn validate_attach(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.inner.validate_attach(s)
    }
    fn validate_restore(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.inner.validate_restore(s)
    }
    fn apply(&mut self, t: Stage, s: &Snapshot) -> Result<(), Failure> {
        self.inner.apply(t, s)
    }
    fn restore(&mut self, t: Stage, s: &Snapshot) -> Result<(), Failure> {
        self.inner.restore(t, s)
    }
    fn verify_attached(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.inner.verify_attached(s)
    }
    fn verify_restored(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.inner.verify_restored(s)
    }
}
