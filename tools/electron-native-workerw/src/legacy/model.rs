#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum State {
    NormalWindow,
    ProbeReady,
    Attaching,
    Attached,
    Detaching,
    Fallback,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct OperationId(pub u64);

/// Numeric handles alone cannot distinguish destruction and handle reuse.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct WindowIdentity {
    pub handle: u64,
    pub process: ProcessIdentity,
    pub thread: u32,
    pub generation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ProcessIdentity {
    pub pid: u32,
    pub creation_time: u64,
    pub verified_image: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Rect(pub i32, pub i32, pub i32, pub i32);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Placement {
    pub flags: u32,
    pub show_command: u32,
    pub normal: Rect,
    pub minimized_position: (i32, i32),
    pub maximized_position: (i32, i32),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct WindowSnapshot {
    pub main: WindowIdentity,
    pub parent: Option<WindowIdentity>,
    pub owner: Option<WindowIdentity>,
    pub style: u32,
    pub extended_style: u32,
    pub placement: Placement,
    pub bounds: Rect,
    pub visible: bool,
    pub minimized: bool,
    pub maximized: bool,
    pub monitor: u64,
    pub dpi: u32,
    pub dpi_context: u64,
    pub z_order_anchor: Option<WindowIdentity>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Snapshot {
    pub window: WindowSnapshot,
    pub explorer: ProcessIdentity,
    pub progman: WindowIdentity,
    pub def_view_host: WindowIdentity,
    pub worker: WindowIdentity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Stage {
    Hide,
    Styles,
    Parent,
    Frame,
    Placement,
    Show,
}
pub(super) const STAGES: [Stage; 6] = [
    Stage::Hide,
    Stage::Styles,
    Stage::Parent,
    Stage::Frame,
    Stage::Placement,
    Stage::Show,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Failure {
    Snapshot,
    MainIdentity,
    ExplorerIdentity,
    WorkerInvalid,
    DpiMismatch,
    Mutation(Stage),
    Restore(Stage),
    Verification,
    Cancelled,
}

/// Only a mock implementation exists, behind cfg(test). No HWND/FFI bridge exists.
pub(super) trait Adapter {
    fn snapshot(&mut self) -> Result<Snapshot, Failure>;
    /// Fresh main identity, shell topology/identity, visibility and DPI checks.
    fn validate_attach(&mut self, snapshot: &Snapshot) -> Result<(), Failure>;
    /// Must reject destroyed/reused HWNDs before any rollback write.
    fn validate_restore(&mut self, snapshot: &Snapshot) -> Result<(), Failure>;
    /// Err may have partially changed state; the attempted stage is rolled back too.
    fn apply(&mut self, stage: Stage, snapshot: &Snapshot) -> Result<(), Failure>;
    fn restore(&mut self, stage: Stage, snapshot: &Snapshot) -> Result<(), Failure>;
    fn verify_attached(&mut self, snapshot: &Snapshot) -> Result<(), Failure>;
    /// Full original window equality, not just a null parent check.
    fn verify_restored(&mut self, snapshot: &Snapshot) -> Result<(), Failure>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Record {
    pub id: OperationId,
    pub snapshot: Option<Snapshot>,
    pub attempted: Vec<Stage>,
    pub restored: Vec<Stage>,
    pub cause: Option<Failure>,
    pub rollback_errors: Vec<Failure>,
    pub verified_restored: bool,
}

impl Record {
    pub const fn new(id: OperationId) -> Self {
        Self {
            id,
            snapshot: None,
            attempted: Vec::new(),
            restored: Vec::new(),
            cause: None,
            rollback_errors: Vec::new(),
            verified_restored: false,
        }
    }
}
