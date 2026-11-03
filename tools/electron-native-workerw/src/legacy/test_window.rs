//! One hidden, unparented, creator-thread test window. Never a product or Shell HWND.
use super::{
    observation::{QueryError, WindowId},
    owned::OwnedSurface,
    read_only_windows::hwnd,
};
use std::sync::atomic::{AtomicBool, Ordering};
use windows::{
    core::w,
    Win32::{
        Foundation::HWND,
        UI::{HiDpi::*, WindowsAndMessaging::*},
    },
};
static CREATED: AtomicBool = AtomicBool::new(false);
pub(super) struct DpiGuard(DPI_AWARENESS_CONTEXT);
impl DpiGuard {
    pub fn enter() -> Result<Self, QueryError> {
        // SAFETY: affects only this dedicated Host thread, never Explorer/other processes.
        let old =
            unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
        if old.0.is_null() {
            Err(QueryError::DpiMismatch)
        } else {
            Ok(Self(old))
        }
    }
}
impl Drop for DpiGuard {
    fn drop(&mut self) {
        // SAFETY: restore the exact thread context returned by the successful setter.
        let _ = unsafe { SetThreadDpiAwarenessContext(self.0) };
    }
}
pub(crate) struct DestroyedTestWindow {
    window: u64,
    generation: u64,
    pid: u32,
    created: u64,
    thread: u32,
    session: u32,
}
impl DestroyedTestWindow {
    pub(crate) fn matches(&self, b: &crate::live_contract::LiveBinding) -> bool {
        self.window == b.surface
            && self.generation == b.surface_generation
            && self.pid == b.host_pid
            && self.created == b.host_creation
            && self.thread == b.host_thread
            && self.session == b.host_session
    }
}
pub(super) struct TestWindow {
    handle: HWND,
    pub owned: Option<OwnedSurface>,
}
impl TestWindow {
    pub fn create(expected: &[u16]) -> Result<Self, QueryError> {
        if CREATED.swap(true, Ordering::SeqCst) {
            return Err(QueryError::IdentityChanged);
        }
        // SAFETY: built-in STATIC class; no Rust callback, parent, owner, menu or user input.
        // No WS_VISIBLE: no activation, foreground, taskbar or Explorer hierarchy change.
        let handle = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!("BOGUNON Native05B isolated target"),
                WS_OVERLAPPEDWINDOW,
                40,
                40,
                640,
                480,
                None,
                None,
                None,
                None,
            )
        }
        .map_err(|_| QueryError::InvalidValue("test creation"))?;
        let mut result = Self {
            handle,
            owned: None,
        };
        result.owned = Some(OwnedSurface::capture(result.id(), expected)?);
        Ok(result)
    }
    pub fn id(&self) -> WindowId {
        WindowId(self.handle.0.addr())
    }
    pub fn validate(&self) -> Result<(), QueryError> {
        self.owned
            .as_ref()
            .ok_or(QueryError::IdentityChanged)?
            .validate()
    }
    pub fn close(&mut self) -> Result<DestroyedTestWindow, QueryError> {
        self.validate()?;
        let owned = self.owned.as_ref().ok_or(QueryError::IdentityChanged)?;
        let proof = DestroyedTestWindow {
            window: self.id().0 as u64,
            generation: owned.cookie as u64,
            pid: owned.identity.process.pid,
            created: owned.identity.process.created,
            thread: owned.identity.thread,
            session: owned.identity.process.session,
        };
        // SAFETY: exact successfully created HWND, same owning thread and generation just validated.
        unsafe { DestroyWindow(self.handle) }.map_err(|_| QueryError::IdentityChanged)?;
        // SAFETY: read-only disappearance observation; a reused handle is conservatively unknown.
        if unsafe { IsWindow(Some(self.handle)) }.as_bool() {
            return Err(QueryError::IdentityChanged);
        }
        self.owned.take();
        self.handle = HWND::default();
        Ok(proof)
    }
}
impl Drop for TestWindow {
    fn drop(&mut self) {
        if self.handle.is_invalid() {
            return;
        }
        // Only our own successfully created handle is retained; no caller-supplied HWND is accepted.
        // A captured generation must still validate before attempting best-effort fallback destruction.
        if self.owned.is_some() && self.validate().is_err() {
            return;
        }
        self.owned.take();
        // SAFETY: untransferred handle created on this thread; Drop is not a cleanup receipt.
        let _ = unsafe { DestroyWindow(hwnd(self.id())) };
    }
}
