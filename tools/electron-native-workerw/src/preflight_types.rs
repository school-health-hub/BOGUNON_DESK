use crate::{live_contract::LiveBinding, ownership::LedgerIdentity};
use serde::Serialize;
use std::time::Duration;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Provenance {
    OsReadOnly,
    Fixture,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct WindowState {
    pub parent: u64,
    pub placement_flags: u32,
    pub placement_show: u32,
    pub placement_screen: bool,
    pub position: [i32; 4],
    pub placement: [i32; 8],
    pub visible: bool,
    pub style: u32,
    pub extended_style: u32,
    pub predecessor: Option<(u64, u32, u64)>,
    pub monitor: u64,
    pub monitor_bounds: [i32; 4],
    pub work: [i32; 4],
    pub dpi: u32,
}
/// No Deserialize/public constructor: fixture data cannot enter the OS evidence path.
pub struct Observation {
    pub(crate) binding: LiveBinding,
    pub(crate) provenance: Provenance,
    pub(crate) ledger: LedgerIdentity,
    pub(crate) captured: Duration,
    pub(crate) state: WindowState,
    pub(crate) worker: u64,
    pub(crate) identity_rechecked: bool,
    pub(crate) topology_rechecked: bool,
    pub(crate) same_dpi_context: bool,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Blocker {
    TargetMissing,
    InvalidBinding,
    Cancelled,
    Expired,
    Replay,
    ObservationStale,
    IdentityChanged,
    OwnershipChanged,
    TopologyChanged,
    MonitorDpiChanged,
    RecoveryUnproven,
    FixtureOnly,
    SeparateApprovalRequired,
    CleanupUnknown,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub execution_allowed: bool,
    pub blocker: Blocker,
    pub native_cleanup: &'static str,
}

/// Move-only authority from an existing Host owner. No issuer/deserializer in NATIVE-05A.
/// Numeric binding IDs are metadata; actual S-3 ledger/lease object identity is authoritative.
pub struct OwnerReservation {
    pub(crate) binding: LiveBinding,
    pub(crate) ledger: crate::ownership::Ledger,
    pub(crate) lease: crate::ownership::BackendRegistrationLease,
}
