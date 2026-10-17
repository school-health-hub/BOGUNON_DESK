use super::super::{
    ownership_finalization::{Confirmation, FinalizationReceipt, Observations},
    CleanupProof, Request,
};
use super::{context, observation, Failure, Native, Owner};
use windows::Win32::{
    Foundation::LPARAM,
    UI::WindowsAndMessaging::{EnumThreadWindows, UnregisterClassW},
};
/// Only the real finalizer can construct these post-release observations.
pub struct Finalized {
    observed: Observations<Native>,
}
impl Finalized {
    pub(in crate::native_contract) fn observations(self) -> Observations<Native> {
        self.observed
    }
}
impl Owner {
    pub fn finalize(&mut self, request: &Request) -> Result<CleanupProof<Native>, Failure> {
        if self.finalization_attempted {
            return Err(Failure::Protocol);
        }
        self.finalization_attempted = true;
        self.same_thread()?;
        context::healthy()?;
        self.policy.finalize(request)?;
        let owner = self.receipt.clone().ok_or(Failure::NativeOutcomeUnknown)?;
        let identity = self
            .destroyed
            .clone()
            .ok_or(Failure::NativeOutcomeUnknown)?;
        if self.window.is_some()
            || context::HANDLE.get().is_some()
            || context::ledger(|state| Ok(state.live.is_some()))?
        {
            return Err(Failure::NativeOutcomeUnknown);
        }
        context::COUNT.set(0);
        // SAFETY: FFI 8/14: creator-thread enumeration, bounded callback observes own QA class and never adopts handles.
        unsafe { EnumThreadWindows(self.thread, Some(context::count_window), LPARAM(0)) }
            .ok()
            .map_err(|_| Failure::ResidualUnknown)?;
        context::healthy()?;
        let residual = Some(context::COUNT.get());
        if residual != Some(0) {
            return Err(Failure::ResidualWindows);
        }
        if !self.registered {
            return Err(Failure::ClassRelease);
        }
        // SAFETY: FFI 8/12: own registered module/class; live ledger and creator-thread own-class count empty.
        unsafe { UnregisterClassW(observation::CLASS, Some(self.module)) }
            .map_err(|_| Failure::ClassRelease)?;
        self.registered = false;
        let notices = context::drain()?;
        if !notices.is_empty() || !context::capture(|capture| Ok(capture.empty()))? {
            return Err(Failure::CallbackContext);
        }
        if context::CREATING.get()
            || context::EXPECTED.get() != 0
            || !context::GATE.with(|gate| gate.idle())
            || context::HANDLE.get().is_some()
        {
            return Err(Failure::CallbackContext);
        }
        context::TOKEN.set(0);
        if !context::ACTIVE.replace(false) {
            return Err(Failure::OwnerRelease);
        }
        self.released = true;
        let observed = Finalized {
            observed: Observations {
                identity,
                owner: owner.clone(),
                current_thread: self.thread,
                destroy: Confirmation::Confirmed,
                ledger: Confirmation::Confirmed,
                residual,
                class_release: Confirmation::Confirmed,
                callback_clear: Confirmation::Confirmed,
                owner_release: Confirmation::Confirmed,
            },
        };
        FinalizationReceipt::<Native>::observed(request, observed, &owner).map_err(|_| {
            context::FAULT.set(Some(Failure::NativeOutcomeUnknown));
            Failure::NativeOutcomeUnknown
        })
    }
}
