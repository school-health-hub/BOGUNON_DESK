use super::super::callback_gate::CallbackGate;
use super::super::owner_policy::Failure;
use crate::{
    own_callbacks::Ledger,
    own_coordinator::{Notice, NoticeKind},
};
use std::cell::{Cell, RefCell};
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::WindowsAndMessaging::*,
    },
};
thread_local! {
    // Never reset: retired handles and the two-reservation budget last until thread exit.
    static CAPTURE: RefCell<super::capture::Capture> = RefCell::new(super::capture::Capture::new());
    static LEDGER: RefCell<Ledger> = RefCell::new(Ledger::new());
    pub(super) static ACTIVE: Cell<bool> = const { Cell::new(false) };
    pub(super) static CREATING: Cell<bool> = const { Cell::new(false) };
    pub(super) static EXPECTED: Cell<usize> = const { Cell::new(0) };
    pub(super) static TOKEN: Cell<u32> = const { Cell::new(0) };
    pub(super) static HANDLE: Cell<Option<HWND>> = const { Cell::new(None) };
    pub(super) static FAULT: Cell<Option<Failure>> = const { Cell::new(None) };
    pub(super) static COUNT: Cell<u32> = const { Cell::new(0) };
    pub(super) static GATE: CallbackGate = const { CallbackGate::new() };
}
pub(super) fn ledger<T>(f: impl FnOnce(&mut Ledger) -> Result<T, Failure>) -> Result<T, Failure> {
    LEDGER.with(|state| {
        let mut guard = state.try_borrow_mut().map_err(|_| Failure::Reentry)?;
        f(&mut guard)
    })
}
pub(super) fn healthy() -> Result<(), Failure> {
    FAULT.get().map_or(Ok(()), Err)
}
pub(super) fn capture<T>(
    f: impl FnOnce(&mut super::capture::Capture) -> Result<T, Failure>,
) -> Result<T, Failure> {
    CAPTURE.with(|state| {
        let mut value = state.try_borrow_mut().map_err(|_| Failure::Reentry)?;
        f(&mut value)
    })
}
fn notice(handle: HWND, kind: NoticeKind) -> Result<(), Failure> {
    ledger(|state| {
        if !state.matches(handle.0.addr(), TOKEN.get()) {
            return Err(Failure::CallbackIdentity);
        }
        let binding = state
            .live
            .as_ref()
            .ok_or(Failure::CallbackIdentity)?
            .binding
            .clone();
        state
            .notice(handle.0.addr(), kind)
            .map_err(|_| Failure::CallbackOverflow)?;
        capture(|capture| capture.record(TOKEN.get(), Notice { binding, kind }))
    })
}
pub(super) fn drain() -> Result<Vec<Notice>, Failure> {
    healthy()?;
    let mut result = Vec::new();
    result
        .try_reserve_exact(16)
        .map_err(|_| Failure::CallbackOverflow)?;
    ledger(|state| {
        state
            .drain(&mut result)
            .map_err(|_| Failure::CallbackOverflow)
    })?;
    Ok(result)
}
pub(super) unsafe extern "system" fn procedure(
    handle: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    let outcome = std::panic::catch_unwind(|| {
        GATE.with(|gate| -> Result<Option<LRESULT>, Failure> {
            let _entry = gate.enter()?;
            if !ACTIVE.get() {
                return Err(Failure::CallbackContext);
            }
            match message {
                WM_NCCREATE => {
                    if !CREATING.get() || EXPECTED.get() == 0 {
                        return Err(Failure::CallbackIdentity);
                    }
                    // SAFETY: FFI 8/10: Win32 supplies CREATESTRUCTW for synchronous WM_NCCREATE; reference does not escape.
                    let creation = unsafe {
                        std::ptr::with_exposed_provenance::<CREATESTRUCTW>(lparam.0.cast_unsigned())
                            .as_ref()
                    }
                    .ok_or(Failure::CallbackIdentity)?;
                    if !CREATING.get()
                        || EXPECTED.get() == 0
                        || creation.lpCreateParams.addr() != EXPECTED.get()
                        || HANDLE.get().is_some()
                        || !super::observation::own_identity(handle)?
                    {
                        return Err(Failure::CallbackIdentity);
                    }
                    ledger(|state| {
                        state
                            .register(handle.0.addr(), TOKEN.get())
                            .map_err(|_| Failure::CallbackIdentity)
                    })?;
                    HANDLE.set(Some(handle));
                    Ok(Some(LRESULT(1)))
                }
                WM_CREATE | WM_CLOSE | WM_NCDESTROY => {
                    if HANDLE.get() != Some(handle) || !super::observation::own_identity(handle)? {
                        return Err(Failure::CallbackIdentity);
                    }
                    let kind = match message {
                        WM_CREATE => NoticeKind::Created,
                        WM_CLOSE => NoticeKind::CloseRequested,
                        _ => NoticeKind::Destroyed,
                    };
                    notice(handle, kind)?;
                    if message == WM_NCDESTROY {
                        HANDLE.set(None);
                    }
                    Ok(if message == WM_NCDESTROY {
                        None
                    } else {
                        Some(LRESULT(0))
                    })
                }
                _ => Ok(None),
            }
        })
    });
    match outcome {
        Ok(Ok(Some(result))) => result,
        Ok(Ok(None)) => {
            // SAFETY: FFI 8/14: unchanged system callback arguments; no Ledger borrow/reentry guard survives.
            unsafe { DefWindowProcW(handle, message, wparam, lparam) }
        }
        Ok(Err(error)) => {
            {
                let _fault = FAULT.try_with(|fault| fault.set(Some(error)));
            };
            reject(message)
        }
        Err(payload) => {
            std::mem::forget(payload);
            {
                let _fault = FAULT.try_with(|fault| fault.set(Some(Failure::NativeOutcomeUnknown)));
            };
            reject(message)
        }
    }
}
fn reject(message: u32) -> LRESULT {
    if message == WM_CREATE {
        LRESULT(-1)
    } else {
        LRESULT(0)
    }
}
pub(super) unsafe extern "system" fn count_window(handle: HWND, _: LPARAM) -> BOOL {
    let result = std::panic::catch_unwind(|| match super::observation::own_identity(handle) {
        Ok(true) => {
            COUNT.set(COUNT.get().saturating_add(1));
            Ok(())
        }
        Ok(false) => Ok(()),
        Err(error) => Err(error),
    });
    match result {
        Ok(Ok(())) => BOOL(1),
        Ok(Err(error)) => {
            {
                let _fault = FAULT.try_with(|fault| fault.set(Some(error)));
            };
            BOOL(0)
        }
        Err(payload) => {
            std::mem::forget(payload);
            {
                let _fault = FAULT.try_with(|fault| fault.set(Some(Failure::NativeOutcomeUnknown)));
            };
            BOOL(0)
        }
    }
}
/// Failure cleanup only: caller confirms class/window retirement before metadata disposal.
pub(super) fn discard_failure_notices() -> Result<(), Failure> {
    if CREATING.get() || EXPECTED.get() != 0 || !GATE.with(|gate| gate.idle()) {
        return Err(Failure::CallbackContext);
    }
    let mut discarded = Vec::new();
    discarded
        .try_reserve_exact(16)
        .map_err(|_| Failure::CallbackOverflow)?;
    ledger(|ledger| {
        if ledger.live.is_some() {
            return Err(Failure::CallbackContext);
        }
        ledger
            .drain(&mut discarded)
            .map_err(|_| Failure::CallbackContext)
    })?;
    capture(|capture| {
        capture.discard_pending();
        Ok(())
    })
}
