use crate::{
    gate::LivePermit,
    observation::*,
    read_only_windows::{hwnd, identity, window_id},
    window_lifecycle::{Role, WindowApi, WindowError},
};
use std::{marker::PhantomData, rc::Rc};
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
        System::{
            LibraryLoader::GetModuleHandleW,
            Threading::{GetCurrentProcessId, GetCurrentThreadId},
        },
        UI::WindowsAndMessaging::*,
    },
};

unsafe extern "system" fn procedure(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // SAFETY: FFI 8/14: forwards OS callback arguments unchanged; no Rust panic or user data handling.
    unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
}
pub(super) struct NativeWindows {
    class: Vec<u16>,
    instance: HINSTANCE,
    pid: u32,
    thread: u32,
    expected: Vec<u16>,
    created: Vec<(WindowId, Option<WindowIdentity>)>,
    _thread_bound: PhantomData<Rc<()>>,
}
impl NativeWindows {
    pub fn new(_: LivePermit) -> Result<Self, WindowError> {
        // SAFETY: FFI 8: current process/thread queries do not touch other windows.
        let pid = unsafe { GetCurrentProcessId() };
        // SAFETY: FFI 8: this calling thread is the sole creator/cleanup thread.
        let thread = unsafe { GetCurrentThreadId() };
        // SAFETY: FFI 8: borrowed module handle for this executable, never freed here.
        let module = unsafe { GetModuleHandleW(None) }.map_err(|_| WindowError::Register)?;
        let expected =
            crate::read_only_process::expected_explorer().map_err(|_| WindowError::Register)?;
        Ok(Self {
            class: format!("BOGUNON_READ_ONLY_QA_{pid}_{thread}")
                .encode_utf16()
                .chain(Some(0))
                .collect(),
            instance: HINSTANCE(module.0),
            pid,
            thread,
            expected,
            created: Vec::with_capacity(3),
            _thread_bound: PhantomData,
        })
    }
}
impl WindowApi for NativeWindows {
    type Id = WindowId;
    fn register(&mut self) -> Result<(), WindowError> {
        let class = WNDCLASSEXW {
            cbSize: u32::try_from(size_of::<WNDCLASSEXW>()).map_err(|_| WindowError::Register)?,
            lpfnWndProc: Some(procedure),
            hInstance: self.instance,
            lpszClassName: PCWSTR(self.class.as_ptr()),
            ..Default::default()
        };
        // SAFETY: FFI 8/10: class name stays alive in self, callback has system ABI and never unwinds.
        if unsafe { RegisterClassExW(&class) } == 0 {
            return Err(WindowError::Register);
        }
        Ok(())
    }
    fn create(&mut self, role: Role, root: Option<WindowId>) -> Result<WindowId, WindowError> {
        if !self.same_thread() {
            return Err(WindowError::Create);
        }
        let (style, parent) = match (role, root) {
            (Role::Root, None) => (WS_OVERLAPPEDWINDOW, None),
            (Role::Owned, Some(root)) if self.identity_matches(root) => {
                (WS_OVERLAPPEDWINDOW, Some(hwnd(root)))
            }
            (Role::Child, Some(root)) if self.identity_matches(root) => {
                (WS_CHILD, Some(hwnd(root)))
            }
            _ => return Err(WindowError::Create),
        };
        // SAFETY: FFI 8/10: our registered class, null-terminated static title, no visible bit, parent/owner only our verified root.
        let handle = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                PCWSTR(self.class.as_ptr()),
                w!("Read-only QA"),
                style,
                100,
                100,
                480,
                320,
                parent,
                None,
                Some(self.instance),
                None,
            )
        }
        .map_err(|_| WindowError::Create)?;
        let id = window_id(handle).map_err(|_| WindowError::Create)?;
        let observed = identity(id, &self.expected).ok();
        self.created.push((id, observed));
        Ok(id)
    }
    fn same_thread(&self) -> bool {
        // SAFETY: FFI 8: reads only the current calling thread ID.
        (unsafe { GetCurrentThreadId() }) == self.thread
    }
    fn identity_matches(&self, id: WindowId) -> bool {
        let Some((_, Some(original))) = self.created.iter().find(|(saved, _)| *saved == id) else {
            return false;
        };
        original.process.pid == self.pid
            && original.thread == self.thread
            && identity(id, &self.expected).as_ref() == Ok(original)
    }
    fn destroy(&mut self, id: WindowId) -> Result<(), WindowError> {
        if !self.same_thread() || !self.identity_matches(id) {
            return Err(WindowError::Cleanup);
        }
        // SAFETY: FFI 8/12: only a window in our creation ledger, identity rechecked on its creating thread; children cleaned first.
        unsafe { DestroyWindow(hwnd(id)) }.map_err(|_| WindowError::Cleanup)?;
        self.created.retain(|(saved, _)| *saved != id);
        Ok(())
    }
    fn unregister(&mut self) -> Result<(), WindowError> {
        if !self.same_thread() || !self.created.is_empty() {
            return Err(WindowError::Cleanup);
        }
        // SAFETY: FFI 8/12: own registered class, all tracked windows successfully destroyed.
        unsafe { UnregisterClassW(PCWSTR(self.class.as_ptr()), Some(self.instance)) }
            .map_err(|_| WindowError::Cleanup)
    }
}
