use super::{
    observation::*,
    observation_reader::Reader,
    read_only_process::{api, expected_explorer, process},
};
use windows::Win32::{
    Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, HWND, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONULL},
    System::Threading::GetCurrentProcessId,
    UI::{HiDpi::*, WindowsAndMessaging::*},
};

pub(super) struct NativeQueries {
    pub(super) expected: Vec<u16>,
}
pub(super) fn reader() -> Result<Reader<NativeQueries>, QueryError> {
    Ok(Reader(NativeQueries {
        expected: expected_explorer()?,
    }))
}
pub(super) fn hwnd(id: WindowId) -> HWND {
    HWND(std::ptr::without_provenance_mut(id.0))
}
pub(super) fn window_id(handle: HWND) -> Result<WindowId, QueryError> {
    if handle.is_invalid() {
        Err(QueryError::InvalidValue("null window"))
    } else {
        Ok(WindowId(handle.0.addr()))
    }
}
pub(super) fn identity(id: WindowId, expected: &[u16]) -> Result<WindowIdentity, QueryError> {
    let handle = hwnd(id);
    let mut pid = 0;
    // SAFETY: FFI category 8: HWND is an opaque OS token, pid is initialized writable storage.
    let thread = unsafe { GetWindowThreadProcessId(handle, Some(&mut pid)) };
    if thread == 0 || pid == 0 {
        return Err(QueryError::InvalidValue("window identity"));
    }
    let process = process(pid, expected)?;
    let mut class = [0u16; 256];
    // SAFETY: FFI category 8/10: bounded initialized output buffer, no HWND dereference in Rust.
    let count = unsafe { GetClassNameW(handle, &mut class) };
    let count = usize::try_from(count).map_err(|_| QueryError::InvalidValue("class length"))?;
    if count == 0 || count >= class.len() - 1 {
        return Err(QueryError::InvalidValue("class length"));
    }
    let class =
        String::from_utf16(&class[..count]).map_err(|_| QueryError::InvalidValue("class utf16"))?;
    let mut final_pid = 0;
    // SAFETY: FFI category 8: second query uses distinct initialized PID storage.
    let final_thread = unsafe { GetWindowThreadProcessId(handle, Some(&mut final_pid)) };
    if final_pid != pid || final_thread != thread {
        return Err(QueryError::IdentityChanged);
    }
    Ok(WindowIdentity {
        id,
        process,
        thread,
        class,
    })
}
fn style(handle: HWND, index: WINDOW_LONG_PTR_INDEX) -> Result<u32, QueryError> {
    // SAFETY: FFI category 8: resets only the calling thread's error slot, not a window.
    unsafe { SetLastError(ERROR_SUCCESS) };
    // SAFETY: FFI category 8: read-only index supplied only as GWL_STYLE/GWL_EXSTYLE.
    let value = unsafe { GetWindowLongPtrW(handle, index) };
    // SAFETY: FFI category 8: immediately reads this thread's error slot.
    let error = unsafe { GetLastError() }.0;
    checked_style(value, error)
}
pub(super) fn parent(id: WindowId, expected: &[u16]) -> Result<Parent, QueryError> {
    // SAFETY: FFI category 8: read-only query, GA_PARENT does not conflate owner.
    let value = unsafe { GetAncestor(hwnd(id), GA_PARENT) };
    let parent_id = window_id(value)?;
    // SAFETY: FFI category 8: read-only desktop token lookup.
    let desktop = unsafe { GetDesktopWindow() };
    if value == desktop {
        Ok(Parent::DesktopRoot(parent_id))
    } else {
        Ok(Parent::Child(identity(parent_id, expected)?))
    }
}
fn owner(id: WindowId, expected: &[u16]) -> Result<Option<WindowIdentity>, QueryError> {
    // SAFETY: FFI category 8: only initializes this thread's LastError.
    unsafe { SetLastError(ERROR_SUCCESS) };
    // SAFETY: FFI category 8: reads the independent owner relation only.
    let value = unsafe { GetWindow(hwnd(id), GW_OWNER) };
    // SAFETY: FFI category 8: capture immediately before other calls overwrite it.
    let error = unsafe { GetLastError() }.0;
    let value = checked_optional_window(value.ok().map(|h| WindowId(h.0.addr())), error)?;
    value.map(|id| identity(id, expected)).transpose()
}
pub(super) const fn screen(r: RECT) -> ScreenRect {
    ScreenRect(r.left, r.top, r.right, r.bottom)
}
impl NativeQueries {
    fn read_window(&self, id: WindowId) -> Result<ObservedWindow, QueryError> {
        let before = identity(id, &self.expected)?;
        // SAFETY: FFI category 8: reads the current process ID, no external state mutation.
        if before.process.pid != unsafe { GetCurrentProcessId() } {
            return Err(QueryError::InvalidValue("foreign main window"));
        }
        let handle = hwnd(id);
        let style = style(handle, GWL_STYLE)?;
        let extended_style = style_value(handle)?;
        let parent = parent(id, &self.expected)?;
        let owner = owner(id, &self.expected)?;
        let mut placement = WINDOWPLACEMENT {
            length: u32::try_from(size_of::<WINDOWPLACEMENT>())
                .map_err(|_| QueryError::InvalidValue("placement size"))?,
            ..Default::default()
        };
        // SAFETY: FFI category 4/8: initialized output with correct structure size.
        api(
            unsafe { GetWindowPlacement(handle, &mut placement) },
            "GetWindowPlacement",
        )?;
        let (mut bounds, mut client) = (RECT::default(), RECT::default());
        // SAFETY: FFI category 4/8: initialized writable RECT; screen/caller-DPI space retained.
        api(
            unsafe { GetWindowRect(handle, &mut bounds) },
            "GetWindowRect",
        )?;
        // SAFETY: FFI category 4/8: separate initialized RECT; client-local space retained.
        api(
            unsafe { GetClientRect(handle, &mut client) },
            "GetClientRect",
        )?;
        // SAFETY: FFI category 8: read-only monitor lookup without choosing an arbitrary nearest monitor.
        let monitor = unsafe { MonitorFromWindow(handle, MONITOR_DEFAULTTONULL) };
        if monitor.is_invalid() {
            return Err(QueryError::InvalidValue("monitor"));
        }
        let mut info = MONITORINFO {
            cbSize: u32::try_from(size_of::<MONITORINFO>())
                .map_err(|_| QueryError::InvalidValue("monitor size"))?,
            ..Default::default()
        };
        // SAFETY: FFI category 4/8: initialized output and correct MONITORINFO size.
        api(
            unsafe { GetMonitorInfoW(monitor, &mut info) }.ok(),
            "GetMonitorInfoW",
        )?;
        // SAFETY: FFI category 8: boolean window-state query; identity rechecked below.
        let visible = unsafe { IsWindowVisible(handle) }.as_bool();
        // SAFETY: FFI category 8: boolean state query only.
        let minimized = unsafe { IsIconic(handle) }.as_bool();
        // SAFETY: FFI category 8: boolean state query only.
        let maximized = unsafe { IsZoomed(handle) }.as_bool();
        // SAFETY: FFI category 8: retrieves target context without changing caller awareness.
        let context = unsafe { GetWindowDpiAwarenessContext(handle) };
        // SAFETY: FFI category 8: retrieves calling thread context only.
        let caller_context = unsafe { GetThreadDpiAwarenessContext() };
        // SAFETY: FFI category 8: read-only DPI lookup; zero rejected below.
        let dpi = unsafe { GetDpiForWindow(handle) };
        if dpi == 0 || context.0.is_null() || caller_context.0.is_null() {
            return Err(QueryError::DpiMismatch);
        }
        if identity(id, &self.expected)? != before {
            return Err(QueryError::IdentityChanged);
        }
        Ok(ObservedWindow {
            identity: before,
            parent,
            owner,
            style,
            extended_style,
            placement: Placement {
                flags: placement.flags.0,
                show: placement.showCmd,
                normal: PlacementRect(
                    placement.rcNormalPosition.left,
                    placement.rcNormalPosition.top,
                    placement.rcNormalPosition.right,
                    placement.rcNormalPosition.bottom,
                ),
                minimized: (placement.ptMinPosition.x, placement.ptMinPosition.y),
                maximized: (placement.ptMaxPosition.x, placement.ptMaxPosition.y),
                space: if style & WS_CHILD.0 != 0 || extended_style & WS_EX_TOOLWINDOW.0 != 0 {
                    PlacementSpace::Screen
                } else {
                    PlacementSpace::Workspace
                },
            },
            screen: screen(bounds),
            client: ClientRect(client.left, client.top, client.right, client.bottom),
            visible,
            minimized,
            maximized,
            monitor: Monitor {
                id: monitor.0.addr(),
                bounds: screen(info.rcMonitor),
                work: screen(info.rcWork),
            },
            dpi,
            context: DpiContext(context.0.addr() as isize),
            caller_context: DpiContext(caller_context.0.addr() as isize),
        })
    }
}
fn style_value(handle: HWND) -> Result<u32, QueryError> {
    style(handle, GWL_EXSTYLE)
}
impl ReadQueries for NativeQueries {
    fn window(&mut self, id: WindowId) -> Result<ObservedWindow, QueryError> {
        self.read_window(id)
    }
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError> {
        identity(id, &self.expected)
    }
    fn topology(&mut self) -> Result<Topology, QueryError> {
        super::read_only_topology::topology(&self.expected)
    }
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool {
        let a = DPI_AWARENESS_CONTEXT(std::ptr::without_provenance_mut(a.0 as usize));
        let b = DPI_AWARENESS_CONTEXT(std::ptr::without_provenance_mut(b.0 as usize));
        // SAFETY: FFI category 8: contexts are opaque OS tokens, never dereferenced by Rust.
        unsafe { AreDpiAwarenessContextsEqual(a, b) }.as_bool()
    }
    fn expected_explorer(&self) -> &[u16] {
        &self.expected
    }
}
