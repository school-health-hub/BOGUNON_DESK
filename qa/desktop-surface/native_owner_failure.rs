//! Independent resource finalization; never issues a lifecycle CleanupProof.
use super::{context, observation, Failure, Native, Owner, OwnerReceipt};
use crate::native_contract::{
    failure_cleanup as cleanup, ownership_finalization::Confirmation as C,
};
use std::rc::Rc;
use windows::Win32::{
    Foundation::{HWND, LPARAM},
    UI::WindowsAndMessaging::*,
};
pub struct FailureCapability {
    lease: Rc<()>,
    token: u32,
    binding: Option<crate::surface_event_types::Binding>,
    receipt: Option<OwnerReceipt<Native>>,
}
impl Owner {
    pub(super) fn normal_admission(&self) -> Result<(), Failure> {
        self.same_thread()?;
        context::healthy()?;
        if self.cleanup_issued {
            return Err(Failure::Protocol);
        }
        Ok(())
    }
    pub(in crate::native_contract) fn cleanup_capability(
        &mut self,
    ) -> Result<FailureCapability, cleanup::Error> {
        self.same_thread().map_err(|_| cleanup::Error::Thread)?;
        if self.cleanup_issued {
            return Err(cleanup::Error::Duplicate);
        }
        if !context::GATE.with(|gate| gate.idle()) {
            return Err(cleanup::Error::Reentry);
        }
        self.cleanup_issued = true;
        self.finalization_attempted = true;
        Ok(FailureCapability {
            lease: self.lease.clone(),
            token: self.token,
            binding: self.origin.clone(),
            receipt: self.receipt.clone(),
        })
    }
    // Same identity checks as normal operations, without the normal-operation health latch.
    pub(super) fn cleanup_identity(&self, handle: HWND) -> Result<(u32, u32, u32), Failure> {
        self.same_thread()?;
        if !context::ACTIVE.get()
            || context::TOKEN.get() != self.token
            || !context::ledger(|ledger| {
                Ok(ledger.matches(handle.0.addr(), self.token)
                    && ledger
                        .live
                        .as_ref()
                        .is_some_and(|entry| Some(&entry.binding) == self.origin.as_ref()))
            })?
            || !observation::own_identity(handle)?
        {
            return Err(Failure::IdentityMismatch);
        }
        // SAFETY: FFI 8: read-only creator-thread Ledger-owned class observation.
        let atom = unsafe { GetClassLongW(handle, GCW_ATOM) };
        // SAFETY: FFI 8: read-only creator-thread Ledger-owned module observation.
        let module = unsafe { GetWindowLongPtrW(handle, GWLP_HINSTANCE) };
        let mut pid = 0;
        // SAFETY: FFI 8/10: Ledger-owned handle and initialized PID output.
        let tid = unsafe { GetWindowThreadProcessId(handle, Some(&mut pid)) };
        if atom != u32::from(self.atom)
            || module != self.module.0.addr().cast_signed()
            || pid != self.pid
            || tid != self.thread
        {
            return Err(Failure::IdentityMismatch);
        }
        Ok((atom, pid, tid))
    }
    pub(in crate::native_contract) fn cleanup_failure(
        &mut self,
        cap: FailureCapability,
    ) -> cleanup::Observation<Native> {
        let resources = if self.receipt.is_some() {
            cleanup::Resources::Owned
        } else if self.window.is_some() || self.registered {
            cleanup::Resources::Partial
        } else {
            cleanup::Resources::Unknown
        };
        let mut facts = cleanup::Facts {
            creator_thread: C::Unknown,
            owner_identity: C::Unknown,
            ledger_token: C::Unknown,
            destroy: C::Unknown,
            ledger: C::Unknown,
            residual: None,
            class_release: C::Unknown,
            callback_clear: C::Unknown,
            owner_release: C::Unknown,
        };
        if self.same_thread().is_err() {
            facts.creator_thread = C::Failed;
            return cleanup::Observation::new(resources, facts);
        }
        facts.creator_thread = C::Confirmed;
        if !Rc::ptr_eq(&cap.lease, &self.lease)
            || cap.receipt != self.receipt
            || cap.binding != self.origin
        {
            facts.owner_identity = C::Failed;
            return cleanup::Observation::new(resources, facts);
        }
        facts.owner_identity = C::Confirmed;
        if cap.token != self.token || context::TOKEN.get() != self.token || !context::ACTIVE.get() {
            facts.ledger_token = C::Failed;
            return cleanup::Observation::new(resources, facts);
        }
        facts.ledger_token = C::Confirmed;
        if !context::GATE.with(|gate| gate.idle())
            || context::CREATING.get()
            || context::EXPECTED.get() != 0
        {
            return cleanup::Observation::new(resources, facts);
        }
        let live = context::ledger(|ledger| {
            Ok(ledger
                .live
                .as_ref()
                .map(|entry| (entry.handle, entry.token)))
        });
        match live {
            Ok(Some((handle, token))) => {
                let retained = self.window.or_else(|| context::HANDLE.get());
                let Some(window) =
                    retained.filter(|window| window.0.addr() == handle && token == self.token)
                else {
                    facts.owner_identity = C::Failed;
                    return cleanup::Observation::new(resources, facts);
                };
                if self.cleanup_identity(window).is_err() {
                    facts.owner_identity = C::Failed;
                    return cleanup::Observation::new(resources, facts);
                }
                // SAFETY: FFI 8/12: exact creator-thread live Ledger token/class/module/PID/TID verified above; no mutable Ledger borrow survives.
                facts.destroy = match unsafe { DestroyWindow(window) } {
                    Ok(()) => C::Confirmed,
                    Err(_) => C::Failed,
                };
            }
            Ok(None) => {
                // No handle is adopted from stale callback metadata when its Ledger entry retired.
                facts.destroy =
                    cleanup::destroy_or_absence(self.creation_attempted, self.destroyed.is_some());
            }
            Err(_) => return cleanup::Observation::new(resources, facts),
        }
        facts.ledger = match context::ledger(|ledger| {
            ledger.cancel_pending();
            Ok(ledger.live.is_none())
        }) {
            Ok(true) => C::Confirmed,
            Ok(false) => C::Failed,
            Err(_) => C::Unknown,
        };
        if facts.ledger != C::Confirmed {
            return cleanup::Observation::new(resources, facts);
        }
        context::COUNT.set(0);
        // SAFETY: FFI 8/14: creator-thread enumeration counts only fixed own QA class/PID/TID; callback never adopts handles.
        if unsafe { EnumThreadWindows(self.thread, Some(context::count_window), LPARAM(0)) }
            .ok()
            .is_err()
        {
            return cleanup::Observation::new(resources, facts);
        }
        facts.residual = Some(context::COUNT.get());
        if facts.residual != Some(0) {
            return cleanup::Observation::new(resources, facts);
        }
        facts.class_release = if self.registered {
            // SAFETY: FFI 8/12: own registered class/module and confirmed empty Ledger plus zero residual own windows.
            match unsafe { UnregisterClassW(observation::CLASS, Some(self.module)) } {
                Ok(()) => {
                    self.registered = false;
                    C::Confirmed
                }
                Err(_) => C::Failed,
            }
        } else {
            C::Confirmed
        };
        if facts.class_release != C::Confirmed {
            return cleanup::Observation::new(resources, facts);
        }
        // Only after Ledger retirement, zero residuals and class release may stale metadata be discarded.
        // A prior failed/unknown destruction observation remains failed/unknown in the report.
        context::HANDLE.set(None);
        self.window = None;
        facts.callback_clear = match context::discard_failure_notices() {
            Ok(()) => C::Confirmed,
            Err(_) => C::Unknown,
        };
        if facts.callback_clear != C::Confirmed {
            return cleanup::Observation::new(resources, facts);
        }
        context::TOKEN.set(0);
        facts.owner_release = if context::ACTIVE.replace(false) {
            self.released = true;
            C::Confirmed
        } else {
            C::Failed
        };
        cleanup::Observation::new(resources, facts)
    }
}
