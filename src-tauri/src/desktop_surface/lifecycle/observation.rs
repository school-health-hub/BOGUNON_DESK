use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct WindowId(pub usize);
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ProcessIdentity {
    pub pid: u32,
    pub created: u64,
    pub session: u32,
    pub image: Vec<u16>,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct WindowIdentity {
    pub id: WindowId,
    pub process: ProcessIdentity,
    pub thread: u32,
    pub class: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ScreenRect(pub i32, pub i32, pub i32, pub i32);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ClientRect(pub i32, pub i32, pub i32, pub i32);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct PlacementRect(pub i32, pub i32, pub i32, pub i32);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PlacementSpace {
    Workspace,
    Screen,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum Parent {
    DesktopRoot(WindowId),
    Child(WindowIdentity),
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Placement {
    pub flags: u32,
    pub show: u32,
    pub normal: PlacementRect,
    pub minimized: (i32, i32),
    pub maximized: (i32, i32),
    pub space: PlacementSpace,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Monitor {
    pub id: usize,
    pub bounds: ScreenRect,
    pub work: ScreenRect,
}
// Opaque observation only; native equality must use AreDpiAwarenessContextsEqual.
#[derive(Debug, Clone, Copy)]
pub(super) struct DpiContext(pub isize);
#[derive(Debug, Clone)]
pub(super) struct ObservedWindow {
    pub identity: WindowIdentity,
    pub parent: Parent,
    pub owner: Option<WindowIdentity>,
    pub style: u32,
    pub extended_style: u32,
    pub placement: Placement,
    pub screen: ScreenRect,
    pub client: ClientRect,
    pub visible: bool,
    pub minimized: bool,
    pub maximized: bool,
    pub monitor: Monitor,
    pub dpi: u32,
    pub context: DpiContext,
    pub caller_context: DpiContext,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Worker {
    pub identity: WindowIdentity,
    pub parent: Parent,
    pub visible: bool,
    pub usable: bool,
    pub has_def_view: bool,
    pub follows_host: bool,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Topology {
    pub shell: WindowIdentity,
    pub progman: WindowIdentity,
    pub host: WindowIdentity,
    pub def_view: WindowIdentity,
    pub def_view_parent: WindowId,
    pub workers: Vec<Worker>,
}
/// A time-bounded observation, never an attach authorization or lifetime proof.
#[derive(Debug, Clone)]
pub(super) struct ObservedSnapshot {
    pub started: Instant,
    pub finished: Instant,
    pub main: ObservedWindow,
    pub explorer: ProcessIdentity,
    pub topology: Topology,
    pub worker: WindowIdentity,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum QueryError {
    Api(&'static str, u32),
    Hresult(&'static str, i32),
    InvalidValue(&'static str),
    IdentityChanged,
    ShellIdentity,
    TopologyChanged,
    AmbiguousWorker,
    DpiMismatch,
}
pub(super) trait SnapshotReader {
    fn collect(&mut self, main: WindowId) -> Result<ObservedSnapshot, QueryError>;
    fn requery_identity(&mut self, window: WindowId) -> Result<WindowIdentity, QueryError>;
    fn topology_consistent(&mut self, snapshot: &ObservedSnapshot) -> Result<(), QueryError>;
}

pub(super) trait ReadQueries {
    fn window(&mut self, id: WindowId) -> Result<ObservedWindow, QueryError>;
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError>;
    fn topology(&mut self) -> Result<Topology, QueryError>;
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool;
    fn expected_explorer(&self) -> &[u16];
}

pub(super) fn checked_style(value: isize, error: u32) -> Result<u32, QueryError> {
    if value == 0 && error != 0 {
        return Err(QueryError::Api("GetWindowLongPtrW", error));
    }
    let bytes = value.to_le_bytes();
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
pub(super) fn checked_optional_window(
    value: Option<WindowId>,
    error: u32,
) -> Result<Option<WindowId>, QueryError> {
    if value.is_none() && error != 0 {
        Err(QueryError::Api("GetWindow", error))
    } else {
        Ok(value)
    }
}
