use crate::{
    own_callbacks::Ledger, own_coordinator::NoticeKind, own_native_observation as observation,
    own_result::Error,
};
use std::{
    cell::{Cell, RefCell},
    panic::{catch_unwind, AssertUnwindSafe},
};
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        System::Threading::{GetCurrentProcessId, GetCurrentThreadId},
        UI::WindowsAndMessaging::*,
    },
};

thread_local! {
    static LEDGER: RefCell<Ledger> = RefCell::new(Ledger::new());
    static FAULT: Cell<Option<Error>> = const { Cell::new(None) };
    pub(super) static TOKEN: Cell<u32> = const { Cell::new(0) };
    pub(super) static EXPECTED: Cell<usize> = const { Cell::new(0) };
    pub(super) static COUNT: Cell<u32> = const { Cell::new(0) };
    pub(super) static HANDLE: Cell<Option<HWND>> = const { Cell::new(None) };
}
pub(super) fn ledger<T>(
    operation: impl FnOnce(&mut Ledger) -> Result<T, Error>,
) -> Result<T, Error> {
    LEDGER.with(|state| {
        let mut guard = state.try_borrow_mut().map_err(|_| Error::Callback)?;
        operation(&mut guard)
    })
}
pub(super) fn healthy() -> Result<(), Error> {
    match FAULT.get() {
        Some(error) => Err(error),
        None => Ok(()),
    }
}
fn fault(error: Error) {
    if FAULT.get().is_none() || error == Error::Panic {
        FAULT.set(Some(error));
    }
}

pub(super) unsafe extern "system" fn procedure(
    handle: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    let outcome = catch_unwind(AssertUnwindSafe(|| -> Result<Option<LRESULT>, Error> {
        let address = handle.0.addr();
        match message {
            WM_NCCREATE => {
                if EXPECTED.get() == 0 {
                    return Err(Error::Callback);
                }
                // SAFETY: FFI 8/10: Win32 supplies CREATESTRUCTW for synchronous WM_NCCREATE; no reference escapes this callback.
                let creation = unsafe { (lparam.0 as *const CREATESTRUCTW).as_ref() }
                    .ok_or(Error::Callback)?;
                if creation.lpCreateParams.addr() != EXPECTED.get() {
                    return Err(Error::Callback);
                }
                // SAFETY: FFI 8: queries current identity only; callback handle is verified before ledger registration.
                let own = unsafe {
                    observation::identity(handle, GetCurrentProcessId(), GetCurrentThreadId())
                };
                if !own {
                    return Err(Error::Callback);
                }
                ledger(|state| state.register(address, TOKEN.get()))?;
                HANDLE.set(Some(handle));
                Ok(Some(LRESULT(1)))
            }
            WM_CREATE => {
                ledger(|state| state.notice(address, NoticeKind::Created))?;
                Ok(Some(LRESULT(0)))
            }
            WM_CLOSE => {
                ledger(|state| state.notice(address, NoticeKind::CloseRequested))?;
                Ok(Some(LRESULT(0)))
            }
            WM_NCDESTROY => {
                ledger(|state| state.notice(address, NoticeKind::Destroyed))?;
                HANDLE.set(None);
                Ok(None)
            }
            _ => Ok(None),
        }
    }));
    match outcome {
        Ok(Ok(Some(result))) => result,
        Ok(Ok(None)) => {
            // SAFETY: FFI 8/14: original callback arguments are forwarded after all RefCell guards have been released.
            unsafe { DefWindowProcW(handle, message, wparam, lparam) }
        }
        Err(payload) => {
            std::mem::forget(payload);
            fault(Error::Panic);
            if message == WM_NCCREATE {
                LRESULT(0)
            } else if message == WM_CREATE {
                LRESULT(-1)
            } else {
                LRESULT(0)
            }
        }
        Ok(Err(error)) => {
            fault(error);
            if message == WM_NCCREATE {
                LRESULT(0)
            } else if message == WM_CREATE {
                LRESULT(-1)
            } else {
                LRESULT(0)
            }
        }
    }
}

pub(super) unsafe extern "system" fn count_window(handle: HWND, _: LPARAM) -> BOOL {
    let outcome = catch_unwind(AssertUnwindSafe(|| {
        // SAFETY: FFI 8: enumeration is confined to this creator thread; class/PID/TID query never adopts the window.
        match unsafe {
            observation::count_owned(handle, GetCurrentProcessId(), GetCurrentThreadId())
        } {
            Ok(true) => COUNT.set(COUNT.get().saturating_add(1)),
            Ok(false) => (),
            Err(_) => fault(Error::Callback),
        }
    }));
    if let Err(payload) = outcome {
        std::mem::forget(payload);
        fault(Error::Panic);
        return BOOL(0);
    }
    BOOL(1)
}
