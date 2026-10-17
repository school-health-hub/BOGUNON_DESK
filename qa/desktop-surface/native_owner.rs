//! Source-only Native owner. No Runner, Gate, pump, or execution target invokes it.
use super::{
    owner_policy::{Failure, Policy},
    ownership_receipt::{Creation, LedgerToken, Native, OwnerReceipt, ResourceOwnership},
    Request,
};
use crate::own_coordinator::Notice;
use std::{marker::PhantomData, rc::Rc};
use windows::{
    core::w,
    Win32::{
        Foundation::{HINSTANCE, HWND},
        System::{
            LibraryLoader::GetModuleHandleW,
            Threading::{GetCurrentProcessId, GetCurrentThreadId},
        },
        UI::WindowsAndMessaging::*,
    },
};
#[path = "native_owner_capture.rs"]
pub mod capture;
#[path = "native_owner_context.rs"]
mod context;
#[path = "native_owner_delivery.rs"]
mod delivery;
#[path = "native_owner_drain.rs"]
mod final_drain;
pub use final_drain::Drained;
#[path = "native_owner_failure.rs"]
mod failure;
pub use failure::FailureCapability;
#[path = "native_owner_finalizer.rs"]
mod finalizer;
#[path = "native_owner_observation.rs"]
mod observation;
pub use finalizer::Finalized;
pub struct Created {
    facts: Creation,
}
impl Created {
    pub(super) fn facts(self) -> Creation {
        self.facts
    }
}
pub struct Owner {
    module: HINSTANCE,
    pid: u32,
    thread: u32,
    atom: u16,
    window: Option<HWND>,
    token: u32,
    registered: bool,
    receipt: Option<OwnerReceipt<Native>>,
    destroyed: Option<Creation>,
    policy: Policy,
    finalization_attempted: bool,
    finalization_stamp: Option<Rc<()>>,
    drain_attempted: bool,
    cleanup_issued: bool,
    creation_attempted: bool,
    lease: Rc<()>,
    origin: Option<crate::surface_event_types::Binding>,
    released: bool,
    _thread_bound: PhantomData<Rc<()>>,
}
impl Owner {
    pub(super) fn new() -> Result<Self, Failure> {
        context::healthy()?;
        if context::ACTIVE.replace(true) {
            return Err(Failure::OwnerRelease);
        }
        // SAFETY: FFI 8: only current module/process/thread are read; no windows created.
        let module = unsafe { GetModuleHandleW(None) };
        // SAFETY: FFI 8: calling process identity only.
        let pid = unsafe { GetCurrentProcessId() };
        // SAFETY: FFI 8: calling thread identity only.
        let thread = unsafe { GetCurrentThreadId() };
        let module = match module {
            Ok(module) => HINSTANCE(module.0),
            Err(_) => {
                context::ACTIVE.set(false);
                return Err(Failure::NativeOutcomeUnknown);
            }
        };
        Ok(Self {
            module,
            pid,
            thread,
            atom: 0,
            window: None,
            token: 0,
            registered: false,
            receipt: None,
            destroyed: None,
            policy: Policy::new(),
            finalization_attempted: false,
            finalization_stamp: None,
            drain_attempted: false,
            cleanup_issued: false,
            creation_attempted: false,
            lease: Rc::new(()),
            origin: None,
            released: false,
            _thread_bound: PhantomData,
        })
    }
    fn identity(&self, handle: HWND) -> Result<(u32, u32, u32), Failure> {
        self.normal_admission()?;
        self.cleanup_identity(handle)
    }
    pub fn create(&mut self, request: &Request) -> Result<OwnerReceipt<Native>, Failure> {
        self.normal_admission()?;
        self.policy.create(request)?;
        self.origin = Some(request.binding().clone());
        self.token = context::ledger(|state| {
            state
                .reserve(request.binding())
                .map_err(|_| Failure::LedgerOverflow)
        })?;
        context::TOKEN.set(self.token);
        context::capture(|capture| capture.begin(self.token))?;
        let class = WNDCLASSW {
            lpfnWndProc: Some(context::procedure),
            hInstance: self.module,
            lpszClassName: observation::CLASS,
            ..Default::default()
        };
        // SAFETY: FFI 8/14: static name and callback survive until class unregistration.
        self.atom = unsafe { RegisterClassW(&class) };
        if self.atom == 0 {
            return Err(self.policy.fault(Failure::ClassRegistration));
        }
        self.registered = true;
        context::CREATING.set(true);
        let token = self.token;
        context::EXPECTED.set(std::ptr::from_ref(&token).addr());
        self.creation_attempted = true;
        // SAFETY: FFI 8/10/14: own class/module, fixed hidden top-level; token lives through synchronous creation callbacks.
        let created = unsafe {
            CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                observation::CLASS,
                w!("Disposable Integration QA"),
                WS_OVERLAPPEDWINDOW,
                100,
                100,
                480,
                320,
                None,
                None,
                Some(self.module),
                Some(std::ptr::from_ref(&token).cast()),
            )
        };
        context::CREATING.set(false);
        context::EXPECTED.set(0);
        context::ledger(|state| {
            state.cancel_pending();
            Ok(())
        })?;
        self.window = context::HANDLE.get();
        let handle = match created {
            Ok(handle) => {
                if self.window != Some(handle) {
                    return Err(self.policy.fault(Failure::NativeOutcomeUnknown));
                }
                handle
            }
            Err(_) => {
                let error = if self.window.is_some() {
                    Failure::PartialCreate
                } else {
                    Failure::CreateWindow
                };
                return Err(self.policy.fault(error));
            }
        };
        let observed = self
            .identity(handle)
            .map_err(|error| self.policy.fault(error))?;
        let created = Created {
            facts: Creation {
                binding: request.binding().clone(),
                token: LedgerToken::native(self.token),
                creator_thread: self.thread,
                class: observed.0,
                pid: observed.1,
                tid: observed.2,
                ownership: ResourceOwnership::Owned,
            },
        };
        let receipt = OwnerReceipt::<Native>::observed(created);
        self.receipt = Some(receipt.clone());
        Ok(receipt)
    }
    pub fn begin_close(&mut self, request: &Request) -> Result<(), Failure> {
        self.normal_admission()?;
        self.policy.close(request)?;
        let handle = self.window.ok_or(Failure::NativeOutcomeUnknown)?;
        self.identity(handle)?;
        context::ledger(|state| {
            state
                .bind_disposal(request.binding())
                .map_err(|_| Failure::CallbackIdentity)
        })?;
        self.origin = Some(request.binding().clone());
        self.destroy()
    }
    fn destroy(&mut self) -> Result<(), Failure> {
        let handle = match self.window.or_else(|| context::HANDLE.get()) {
            Some(handle) => handle,
            None => return Err(Failure::NativeOutcomeUnknown),
        };
        let observed = self.identity(handle)?;
        // SAFETY: FFI 8/12: creator-thread, exact live Ledger token/class/module/PID/TID checked immediately above.
        unsafe { DestroyWindow(handle) }.map_err(|_| self.policy.fault(Failure::DestroyWindow))?;
        context::healthy()?;
        if context::HANDLE.get().is_some() || context::ledger(|state| Ok(state.live.is_some()))? {
            return Err(self.policy.fault(Failure::NativeOutcomeUnknown));
        }
        self.destroyed = self.receipt.as_ref().map(|owner| {
            let mut facts = owner.creation().clone();
            facts.class = observed.0;
            facts.pid = observed.1;
            facts.tid = observed.2;
            facts
        });
        self.window = None;
        Ok(())
    }
    pub fn drain(&mut self) -> Result<Vec<Notice>, Failure> {
        self.same_thread()?;
        if self.cleanup_issued
            || self.released
            || !self.policy.operating()
            || !context::ACTIVE.get()
            || context::TOKEN.get() != self.token
        {
            return Err(Failure::OwnerRelease);
        }
        context::drain()
    }
}
impl Drop for Owner {
    fn drop(&mut self) {
        if self.released || self.finalization_attempted {
            return;
        }
        // Best effort only: no proof, retry, owner release, or recreation on abandonment.
        if self.window.is_some() {
            let _cleanup = self.destroy();
        }
        // TLS context/class deliberately quarantined when finalization was not confirmed.
    }
}
