use crate::own_native_messages::{
    count_window, healthy, ledger, procedure, COUNT, EXPECTED, HANDLE, TOKEN,
};
use crate::{
    own_coordinator::{Driver, Notice},
    own_native_observation::{self as observation, CLASS, EXTENDED, STYLE},
    own_result::Error,
    surface_event_types::Binding,
};
use std::{marker::PhantomData, rc::Rc};
use windows::{
    core::w,
    Win32::{
        Foundation::{FILETIME, HINSTANCE, HWND, LPARAM},
        System::{
            LibraryLoader::GetModuleHandleW,
            Threading::{
                GetCurrentProcess, GetCurrentProcessId, GetCurrentThreadId, GetProcessTimes,
            },
        },
        UI::WindowsAndMessaging::*,
    },
};

pub struct Native {
    instance: HINSTANCE,
    pid: u32,
    thread: u32,
    _process_created: FILETIME,
    window: Option<(HWND, u32)>,
    registered: bool,
    cleanup_attempted: bool,
    cleanup_failed: bool,
    remaining: Option<u32>,
    _thread_bound: PhantomData<Rc<()>>,
}
impl Native {
    pub fn new(_permit: crate::own_gate::Permit) -> Result<Self, Error> {
        // SAFETY: FFI 8: only this process module and current thread/process identities are queried; no class/window is created.
        let (module, pid, thread) = unsafe {
            (
                GetModuleHandleW(None),
                GetCurrentProcessId(),
                GetCurrentThreadId(),
            )
        };
        let (mut created, mut exited, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        // SAFETY: FFI 8/10: own-process pseudo-handle is borrowed; FILETIME outputs are initialized and remain live for the call.
        unsafe {
            GetProcessTimes(
                GetCurrentProcess(),
                &mut created,
                &mut exited,
                &mut kernel,
                &mut user,
            )
        }
        .map_err(|_| Error::Native)?;
        Ok(Self {
            instance: HINSTANCE(module.map_err(|_| Error::Native)?.0),
            pid,
            thread,
            _process_created: created,
            window: None,
            registered: false,
            cleanup_attempted: false,
            cleanup_failed: false,
            remaining: None,
            _thread_bound: PhantomData,
        })
    }
    fn same_thread(&self) -> bool {
        // SAFETY: FFI 8: reads the calling thread identity only.
        unsafe { GetCurrentThreadId() == self.thread }
    }
    fn confirmed(&self) -> Result<Option<HWND>, Error> {
        if !self.same_thread() {
            return Err(Error::Cleanup);
        }
        let Some((handle, token)) = self.window else {
            return Ok(None);
        };
        if !ledger(|state| Ok(state.matches(handle.0.addr(), token)))? {
            return Ok(None);
        }
        if observation::identity(handle, self.pid, self.thread) {
            Ok(Some(handle))
        } else {
            Err(Error::Cleanup)
        }
    }
    fn destroy(&mut self) -> Result<(), Error> {
        if self.window.is_none() {
            self.window = HANDLE.get().map(|handle| (handle, TOKEN.get()));
        }
        if let Some(handle) = self.confirmed()? {
            // SAFETY: FFI 8/12: same-thread live token ledger and class/PID/TID checks establish this owner's window; retired entries never reach here.
            unsafe { DestroyWindow(handle) }.map_err(|_| Error::Cleanup)?;
            if ledger(|state| Ok(state.live.is_some()))? {
                return Err(Error::Cleanup);
            }
        }
        self.window = None;
        Ok(())
    }
}
impl Driver for Native {
    fn create(&mut self, binding: &Binding) -> Result<(), Error> {
        healthy()?;
        if !self.same_thread()
            || self.cleanup_failed
            || self.cleanup_attempted
            || self.window.is_some()
        {
            return Err(Error::Native);
        }
        let token = ledger(|state| state.reserve(binding))?;
        TOKEN.set(token);
        if !self.registered {
            let class = WNDCLASSW {
                lpfnWndProc: Some(procedure),
                hInstance: self.instance,
                lpszClassName: CLASS,
                ..Default::default()
            };
            // SAFETY: FFI 8/14: static class name and system ABI callback remain valid through unregistration.
            if unsafe { RegisterClassW(&class) } == 0 {
                ledger(|state| {
                    state.cancel_pending();
                    Ok(())
                })?;
                return Err(Error::Native);
            }
            self.registered = true;
        }
        EXPECTED.set(std::ptr::from_ref(&token).addr());
        // SAFETY: FFI 8/10: own registered class, static title, fixed hidden styles, no owner/parent; token lives across synchronous creation callbacks.
        let result = unsafe {
            CreateWindowExW(
                EXTENDED,
                CLASS,
                w!("Own Surface QA"),
                STYLE,
                100,
                100,
                480,
                320,
                None,
                None,
                Some(self.instance),
                Some(std::ptr::from_ref(&token).cast()),
            )
        };
        EXPECTED.set(0);
        ledger(|state| {
            state.cancel_pending();
            Ok(())
        })?;
        match result {
            Ok(handle) => {
                self.window = Some((handle, token));
            }
            Err(_) => {
                self.window = HANDLE.get().map(|handle| (handle, token));
                healthy()?;
                return Err(Error::Native);
            }
        }
        healthy()?;
        self.confirmed()?.ok_or(Error::Native)?;
        Ok(())
    }
    fn observe(&mut self) -> Result<(), Error> {
        healthy()?;
        observation::unchanged(self.confirmed()?.ok_or(Error::Native)?)
    }
    fn drain(&mut self) -> Result<Vec<Notice>, Error> {
        healthy()?;
        let mut output = Vec::new();
        output.try_reserve_exact(16).map_err(|_| Error::Callback)?;
        ledger(|state| state.drain(&mut output))?;
        Ok(output)
    }
    fn dispose(&mut self, binding: &Binding) -> Result<(), Error> {
        healthy()?;
        ledger(|state| state.bind_disposal(binding))?;
        match self.destroy() {
            Ok(()) => healthy(),
            Err(error) => {
                self.cleanup_failed = true;
                healthy()?;
                Err(error)
            }
        }
    }
    fn cleanup(&mut self) -> Result<(), Error> {
        if self.cleanup_attempted {
            return if self.cleanup_failed {
                Err(Error::Cleanup)
            } else {
                Ok(())
            };
        }
        self.cleanup_attempted = true;
        let result = (|| {
            if self.cleanup_failed {
                return Err(Error::Cleanup);
            }
            self.destroy()?;
            if !self.same_thread() || ledger(|state| Ok(state.live.is_some()))? {
                return Err(Error::Cleanup);
            }
            COUNT.set(0);
            // SAFETY: FFI 8/14: enumerates creator thread only; callback records counts and never adopts or destroys handles.
            let enumeration =
                unsafe { EnumThreadWindows(self.thread, Some(count_window), LPARAM(0)) }.ok();
            healthy()?;
            enumeration.map_err(|_| Error::Cleanup)?;
            self.remaining = Some(COUNT.get());
            if self.remaining != Some(0) {
                return Err(Error::Cleanup);
            }
            if self.registered {
                // SAFETY: FFI 8/12: own class, live ledger empty and current-thread own-class count zero.
                unsafe { UnregisterClassW(CLASS, Some(self.instance)) }
                    .map_err(|_| Error::Cleanup)?;
                self.registered = false;
            }
            Ok(())
        })();
        self.cleanup_failed = result.is_err();
        result
    }
    fn remaining(&self) -> Option<u32> {
        self.remaining
    }
}
impl Drop for Native {
    fn drop(&mut self) {
        if !self.cleanup_attempted {
            let _result = self.cleanup();
        }
    }
}
