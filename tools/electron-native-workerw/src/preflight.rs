//! Read-only eligibility is not authority. No live permit or receipt issuer exists here.
use crate::{
    lifecycle::Attempt,
    live_contract::{LiveBinding, LiveVerdict},
    ownership::{BackendRegistrationLease, Ledger},
};
use std::time::{Duration, Instant};

#[path = "preflight_types.rs"]
mod types;
#[cfg(any(test, all(windows, feature = "windows-observation-skip-miri")))]
pub(crate) use types::WindowState;
pub use types::{Blocker, Observation, OwnerReservation, PreflightReport, Provenance};
/// Bound reservation of the existing S-3 ledger and registration lease; not a live grant.
pub struct PreflightSession {
    epoch: Instant,
    binding: LiveBinding,
    attempt: Attempt,
    ledger: Ledger,
    lease: BackendRegistrationLease,
    created: Duration,
    expires: Duration,
    last: u64,
    cancelled: bool,
    unknown: bool,
    used: bool,
    cleanup_used: bool,
}
impl PreflightSession {
    pub fn bind_owner(owner: OwnerReservation, ttl: Duration) -> Result<Self, Blocker> {
        let OwnerReservation {
            binding,
            ledger,
            lease,
        } = owner;
        let now = Duration::ZERO;
        if binding.host_pid == 0
            || binding.host_thread == 0
            || binding.explorer_pid == 0
            || binding.explorer_pid == binding.host_pid
            || binding.host_creation == 0
            || binding.surface == 0
            || binding.surface_generation == 0
            || binding.explorer_creation == 0
            || binding.explorer_generation != binding.explorer_creation
            || binding.source_sha == [0; 20]
            || binding.ledger_identity == 0
            || binding.lease_identity == 0
            || ttl.is_zero()
            || ttl > Duration::from_secs(30)
        {
            return Err(Blocker::InvalidBinding);
        }
        let attempt =
            Attempt::new(binding.generation, binding.attempt).ok_or(Blocker::InvalidBinding)?;
        let expires = now.checked_add(ttl).ok_or(Blocker::InvalidBinding)?;
        if !ledger.reservation_matches(attempt, binding.host_creation, binding.surface, &lease) {
            return Err(Blocker::OwnershipChanged);
        }
        Ok(Self {
            epoch: Instant::now(),
            binding,
            attempt,
            ledger,
            lease,
            created: now,
            expires,
            last: 0,
            cancelled: false,
            unknown: false,
            used: false,
            cleanup_used: false,
        })
    }
    #[cfg(all(windows, feature = "windows-observation-skip-miri"))]
    pub(crate) fn ledger_identity(&self) -> crate::ownership::LedgerIdentity {
        self.ledger.identity()
    }
    pub(crate) fn elapsed(&self) -> Duration {
        self.epoch.elapsed()
    }
    #[cfg(all(windows, feature = "windows-observation-skip-miri"))]
    pub fn observe_target(&mut self) -> Result<Observation, Blocker> {
        if self.unknown {
            return Err(Blocker::CleanupUnknown);
        }
        if self.cancelled {
            return Err(Blocker::Cancelled);
        }
        if self.used {
            return Err(Blocker::Replay);
        }
        if self.elapsed() >= self.expires {
            return Err(Blocker::Expired);
        }
        let result = crate::legacy::live_read_only::capture(self, self.binding);
        if result.is_err() {
            self.quarantine();
        }
        result
    }
    pub fn cancel(&mut self) {
        self.cancelled = true;
    }
    pub fn host_lost(&mut self) {
        self.quarantine();
    }
    fn quarantine(&mut self) {
        self.unknown = true;
        let _ = self.lease.quarantine(self.attempt);
    }
    fn evaluate(
        &mut self,
        observation: Option<&Observation>,
        now: Duration,
        sequence: u64,
    ) -> Blocker {
        if self.unknown {
            return Blocker::CleanupUnknown;
        }
        if self.cancelled {
            return Blocker::Cancelled;
        }
        if now < self.created || now >= self.expires {
            return Blocker::Expired;
        }
        if self.used || sequence == 0 || sequence == u64::MAX || sequence <= self.last {
            return Blocker::Replay;
        }
        self.last = sequence;
        let Some(o) = observation else {
            return Blocker::TargetMissing;
        };
        let reason = if o.binding != self.binding || !o.identity_rechecked {
            Some(Blocker::IdentityChanged)
        } else if !self.ledger.reservation_matches(
            self.attempt,
            self.binding.host_creation,
            self.binding.surface,
            &self.lease,
        ) || o.ledger != self.ledger.identity()
        {
            Some(Blocker::OwnershipChanged)
        } else if o.captured < self.created
            || o.captured > now
            || now - o.captured > Duration::from_millis(500)
        {
            Some(Blocker::ObservationStale)
        } else if !o.topology_rechecked || o.worker == 0 {
            Some(Blocker::TopologyChanged)
        } else if !o.same_dpi_context || o.state.dpi == 0 || o.state.monitor == 0 {
            Some(Blocker::MonitorDpiChanged)
        } else if o.state.parent != 0
            || o.state.position[0] >= o.state.position[2]
            || o.state.position[1] >= o.state.position[3]
        {
            Some(Blocker::RecoveryUnproven)
        } else {
            None
        };
        if let Some(reason) = reason {
            self.quarantine();
            return reason;
        }
        self.used = true;
        // Even qualified OS observations cannot mint the separately approved one-shot authority.
        match o.provenance {
            Provenance::Fixture => Blocker::FixtureOnly,
            Provenance::OsReadOnly => Blocker::SeparateApprovalRequired,
        }
    }
    pub fn inspect(&mut self, o: Option<&Observation>, sequence: u64) -> PreflightReport {
        self.inspect_at(o, self.elapsed(), sequence)
    }
    fn inspect_at(
        &mut self,
        o: Option<&Observation>,
        now: Duration,
        sequence: u64,
    ) -> PreflightReport {
        let blocker = self.evaluate(o, now, sequence);
        PreflightReport {
            execution_allowed: false,
            blocker,
            native_cleanup: if self.unknown {
                "CleanupUnknown"
            } else {
                "NotVerified"
            },
        }
    }
    /// This is evidence assessment only; no actual successful cleanup receipt is manufactured.
    pub fn assess_cleanup(
        &mut self,
        before: &Observation,
        attached: &Observation,
        after: &Observation,
    ) -> LiveVerdict {
        self.assess_cleanup_at(before, attached, after, self.elapsed())
    }
    fn assess_cleanup_at(
        &mut self,
        before: &Observation,
        attached: &Observation,
        after: &Observation,
        now: Duration,
    ) -> LiveVerdict {
        if self.unknown || self.cancelled || self.cleanup_used {
            self.quarantine();
            return LiveVerdict::CleanupUnknown;
        }
        self.cleanup_used = true;
        let invalid = now >= self.expires
            || after.captured > now
            || now.saturating_sub(after.captured) > Duration::from_millis(500)
            || before.provenance != attached.provenance
            || attached.provenance != after.provenance
            || !self.ledger.reservation_matches(
                self.attempt,
                self.binding.host_creation,
                self.binding.surface,
                &self.lease,
            )
            || [before, attached, after].iter().any(|o| {
                o.binding != self.binding
                    || o.ledger != self.ledger.identity()
                    || !o.identity_rechecked
                    || !o.topology_rechecked
                    || !o.same_dpi_context
            })
            || before.captured >= attached.captured
            || attached.captured >= after.captured
            || before.worker == 0
            || attached.worker != before.worker
            || after.worker != before.worker
            || attached.state.parent != before.worker
            || before.state != after.state;
        if invalid {
            self.quarantine();
            return LiveVerdict::CleanupUnknown;
        }
        // Neither process exit nor restored parent releases Window/COM/etc ownership.
        // Full S-3 resource release and a separately reviewed live observer are still required.
        let _ = self.ledger.is_resolved();
        LiveVerdict::NotVerified
    }
}
#[cfg(test)]
#[path = "preflight_tests.rs"]
mod tests;

#[cfg(all(windows,feature="windows-test-target-skip-miri"))]
#[path="preflight_target.rs"]
mod target;
