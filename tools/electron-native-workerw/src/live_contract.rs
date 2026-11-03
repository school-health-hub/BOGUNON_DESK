//! Future OS authority boundary. There is deliberately no live issuer in NATIVE-04B.
//! A model report cannot be deserialized or converted into either opaque authority.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LiveBinding {
    pub generation: u64,
    pub attempt: u64,
    pub host_creation: u64,
    pub host_pid: u32,
    pub source_sha: [u8; 20],
    pub ledger_identity: u64,
    pub lease_identity: u64,
    pub surface: u64,
    pub explorer_creation: u64,
    pub explorer_generation: u64,
    pub surface_generation: u64,
    pub sequence: u64,
}
#[derive(Debug, PartialEq, Eq)]
pub enum LiveVerdict {
    NotVerified,
    CleanupUnknown,
}
/// Reserved authority: exact binding, approval, environment, expiry and one-shot consumption.
/// Private fields and no issuer prevent DryRun callers from constructing a permit.
pub struct ExecutionPermit {
    binding: LiveBinding,
    expires_at: u64,
    approval_scope: bool,
    isolated_environment: bool,
    preflight_verified: bool,
    cancelled: bool,
    consumed: bool,
}
impl ExecutionPermit {
    pub fn permits(&self, binding: LiveBinding, now: u64) -> bool {
        self.binding == binding
            && now < self.expires_at
            && !self.cancelled
            && !self.consumed
            && self.approval_scope
            && self.isolated_environment
            && self.preflight_verified
    }
    pub fn cancel(&mut self) {
        self.cancelled = true;
    }
}
/// OS-observed evidence must include before/attached/restored parent, state and Z-order,
/// ownership ledger/lease and residual-resource observations. No constructor until NATIVE-05.
#[derive(Clone, Copy, PartialEq, Eq)]
struct WindowObservation {
    parent: u64,
    style: u32,
    extended_style: u32,
    dpi: u32,
    bounds: [i32; 4],
    z_order_predecessor: u64,
}
pub struct LiveCleanupReceipt {
    binding: LiveBinding,
    before: WindowObservation,
    attached_parent: u64,
    observed_attached_parent: u64,
    restored: WindowObservation,
    residual_resources: u32,
    ledger_resolved: bool,
    consumed: bool,
}
impl LiveCleanupReceipt {
    pub fn verify_once(&mut self, binding: LiveBinding) -> LiveVerdict {
        if self.consumed
            || self.binding != binding
            || self.before != self.restored
            || self.attached_parent == 0
            || self.attached_parent != self.observed_attached_parent
            || self.residual_resources != 0
            || !self.ledger_resolved
        {
            self.consumed = true;
            return LiveVerdict::CleanupUnknown;
        }
        self.consumed = true;
        // No OS observer is wired in this stage: even an internal fixture is not OS evidence.
        LiveVerdict::NotVerified
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn binding() -> LiveBinding {
        LiveBinding {
            generation: 1,
            attempt: 2,
            host_creation: 3,
            surface: 4,
            explorer_creation: 5,
            sequence: 6,
            host_pid: 7,
            source_sha: [8; 20],
            ledger_identity: 9,
            lease_identity: 10,
            explorer_generation: 11,
            surface_generation: 12,
        }
    }
    #[test]
    fn permit_is_expiring_cancelable_and_one_shot() {
        let mut p = ExecutionPermit {
            binding: binding(),
            expires_at: 10,
            cancelled: false,
            consumed: false,
            approval_scope: true,
            isolated_environment: true,
            preflight_verified: true,
        };
        assert!(p.permits(binding(), 9));
        assert!(!p.permits(binding(), 10));
        p.cancel();
        assert!(!p.permits(binding(), 9));
        p.cancelled = false;
        p.consumed = true;
        assert!(!p.permits(binding(), 9));
    }
    #[test]
    fn old_receipt_and_replay_are_unknown_and_fixture_is_never_live_success() {
        let window = WindowObservation {
            parent: 0,
            style: 1,
            extended_style: 2,
            dpi: 96,
            bounds: [0, 0, 640, 480],
            z_order_predecessor: 3,
        };
        let mut r = LiveCleanupReceipt {
            binding: binding(),
            before: window,
            restored: window,
            attached_parent: 4,
            observed_attached_parent: 4,
            residual_resources: 0,
            ledger_resolved: true,
            consumed: false,
        };
        let mut old = binding();
        old.attempt = 99;
        assert_eq!(r.verify_once(old), LiveVerdict::CleanupUnknown);
        assert_eq!(r.verify_once(binding()), LiveVerdict::CleanupUnknown);
        r.consumed = false; // A separate internal fixture; never an actual observer/issuer.
        assert_eq!(r.verify_once(binding()), LiveVerdict::NotVerified);
        assert_eq!(r.verify_once(binding()), LiveVerdict::CleanupUnknown);
    }
}
