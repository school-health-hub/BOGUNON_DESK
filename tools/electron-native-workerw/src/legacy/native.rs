use super::{
    model::*,
    native_bridge, native_writes,
    observation::{self as o, ReadQueries, SnapshotReader},
    observation_reader::Reader,
    owned::OwnedSurface,
    read_only_windows::{self, hwnd, NativeQueries},
};
use windows::Win32::{
    Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, RECT},
    UI::{HiDpi::*, WindowsAndMessaging::*},
};

/// Intentionally no issuer. A future separately approved disposable-VM bridge must provide
/// icon/input and rollback qualification before this private adapter can be constructed.
struct ExecutionPermit {
    icon_input_and_cleanup_qualified: bool,
}
pub(super) struct NativeAdapter {
    pub reader: Reader<NativeQueries>,
    pub owned: OwnedSurface,
    baseline: Option<o::ObservedSnapshot>,
    anchor: Option<o::WindowIdentity>,
    permit: ExecutionPermit,
    anchor_lost: bool,
}
impl NativeAdapter {
    fn prepare(id: o::WindowId, permit: ExecutionPermit) -> Result<Self, Failure> {
        if !permit.icon_input_and_cleanup_qualified {
            return Err(Failure::Verification);
        }
        let reader = read_only_windows::reader().map_err(|_| Failure::Snapshot)?;
        let owned =
            OwnedSurface::capture(id, &reader.0.expected).map_err(|_| Failure::MainIdentity)?;
        Ok(Self {
            reader,
            owned,
            baseline: None,
            anchor: None,
            permit,
            anchor_lost: false,
        })
    }
    fn anchor(&mut self) -> Result<Option<o::WindowIdentity>, Failure> {
        // SAFETY: read-only predecessor query on creator-owned window; zero has LastError semantics.
        unsafe { SetLastError(ERROR_SUCCESS) };
        let value = unsafe { GetWindow(hwnd(self.owned.identity.id), GW_HWNDPREV) };
        // SAFETY: immediately read only the calling thread error slot.
        let error = unsafe { GetLastError() }.0;
        match value {
            Ok(h) => self
                .reader
                .requery_identity(o::WindowId(h.0.addr()))
                .map(Some)
                .map_err(|_| Failure::MainIdentity),
            Err(_) if error == 0 => Ok(None),
            Err(_) => Err(Failure::Snapshot),
        }
    }
    fn owned(&self) -> Result<(), Failure> {
        self.owned.validate().map_err(|_| Failure::MainIdentity)
    }
    fn baseline(&self) -> Result<&o::ObservedSnapshot, Failure> {
        self.baseline.as_ref().ok_or(Failure::Snapshot)
    }
    fn dpi(&self, w: &o::ObservedWindow) -> Result<(), Failure> {
        let base = self.baseline()?;
        if w.monitor != base.main.monitor
            || w.dpi != base.main.dpi
            || !self.reader.0.dpi_equal(w.context, base.main.context)
            || !self.reader.0.dpi_equal(w.context, w.caller_context)
        {
            return Err(Failure::DpiMismatch);
        }
        Ok(())
    }
}
impl Adapter for NativeAdapter {
    fn snapshot(&mut self) -> Result<Snapshot, Failure> {
        self.owned()?;
        let observed = self
            .reader
            .collect(self.owned.identity.id)
            .map_err(|_| Failure::Snapshot)?;
        // Initial scope: an unowned ordinary, non-minimized/non-maximized Host window only.
        if !matches!(observed.main.parent, o::Parent::DesktopRoot(_))
            || observed.main.owner.is_some()
            || observed.main.minimized
            || observed.main.maximized
            || observed.main.extended_style & WS_EX_TOPMOST.0 != 0
        {
            return Err(Failure::Snapshot);
        }
        let o::ScreenRect(l, t, r, b) = observed.main.screen;
        let o::ScreenRect(wl, wt, wr, wb) = observed.main.monitor.work;
        if l < wl || t < wt || r > wr || b > wb || l >= r || t >= b {
            return Err(Failure::Snapshot);
        }
        self.anchor = self.anchor()?;
        let result = native_bridge::snapshot(&observed, self.owned.cookie, self.anchor.as_ref());
        self.baseline = Some(observed);
        Ok(result)
    }
    fn validate_attach(&mut self, _: &Snapshot) -> Result<(), Failure> {
        self.owned()?;
        let base = self.baseline()?.clone();
        if !self.permit.icon_input_and_cleanup_qualified
            || base.started.elapsed() > std::time::Duration::from_secs(2)
        {
            return Err(Failure::Verification);
        }
        self.reader
            .topology_consistent(&base)
            .map_err(|_| Failure::ExplorerIdentity)?;
        let current = self
            .reader
            .0
            .window(self.owned.identity.id)
            .map_err(|_| Failure::MainIdentity)?;
        self.dpi(&current)?;
        let mut bounds = RECT::default();
        // SAFETY: fresh retained WorkerW identity, initialized output, read-only bounds query.
        unsafe { GetWindowRect(hwnd(base.worker.id), &mut bounds) }
            .map_err(|_| Failure::WorkerInvalid)?;
        let o::ScreenRect(l, t, r, b) = base.main.screen;
        if bounds.left > l || bounds.top > t || bounds.right < r || bounds.bottom < b {
            return Err(Failure::WorkerInvalid);
        }
        // SAFETY: retained observed WorkerW token is queried only, no Shell mutation.
        let worker_context = unsafe { GetWindowDpiAwarenessContext(hwnd(base.worker.id)) };
        if !self.reader.0.dpi_equal(
            current.context,
            o::DpiContext(worker_context.0.addr() as isize),
        ) {
            return Err(Failure::DpiMismatch);
        }
        Ok(())
    }
    fn validate_restore(&mut self, _: &Snapshot) -> Result<(), Failure> {
        self.owned()?;
        let current = self
            .reader
            .0
            .window(self.owned.identity.id)
            .map_err(|_| Failure::MainIdentity)?;
        self.dpi(&current)
        // Original parent is desktop root; restoration never writes to or reuses stale WorkerW.
    }
    fn apply(&mut self, stage: Stage, s: &Snapshot) -> Result<(), Failure> {
        self.validate_attach(s)?;
        native_writes::apply(stage, s, &self.owned)
    }
    fn restore(&mut self, stage: Stage, s: &Snapshot) -> Result<(), Failure> {
        self.validate_restore(s)?;
        if let Some(anchor) = &self.anchor {
            if self.reader.requery_identity(anchor.id).ok().as_ref() != Some(anchor) {
                self.anchor_lost = true;
            }
        }
        // A missing unrelated predecessor must not block safe unparent/style/geometry restoration.
        native_writes::restore(stage, s, &self.owned, !self.anchor_lost)
    }
    fn verify_attached(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.validate_attach(s)?;
        let current = self
            .reader
            .0
            .window(self.owned.identity.id)
            .map_err(|_| Failure::Verification)?;
        if !matches!(&current.parent,o::Parent::Child(p) if p==&self.baseline()?.worker)
            || current.owner.is_some()
            || !current.visible
            || current.minimized
            || current.maximized
            || current.style != (s.window.style | WS_CHILD.0) & !WS_POPUP.0
            || current.extended_style != s.window.extended_style & !WS_EX_APPWINDOW.0
            || current.screen != self.baseline()?.main.screen
        {
            return Err(Failure::Verification);
        }
        Ok(())
    }
    fn verify_restored(&mut self, s: &Snapshot) -> Result<(), Failure> {
        self.validate_restore(s)?;
        if self.anchor_lost {
            return Err(Failure::Verification);
        }
        let mut current = self.baseline()?.clone();
        current.main = self
            .reader
            .0
            .window(self.owned.identity.id)
            .map_err(|_| Failure::Verification)?;
        let anchor = self.anchor()?;
        if native_bridge::snapshot(&current, self.owned.cookie, anchor.as_ref()).window != s.window
        {
            return Err(Failure::Verification);
        }
        Ok(())
    }
}
