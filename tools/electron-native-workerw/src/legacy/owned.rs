use super::{
    observation::{QueryError, WindowId, WindowIdentity},
    read_only_windows::{hwnd, identity},
};
use std::{
    marker::PhantomData,
    rc::Rc,
    sync::atomic::{AtomicUsize, Ordering},
};
use windows::{
    core::w,
    Win32::{
        Foundation::HANDLE,
        System::Threading::{GetCurrentProcessId, GetCurrentThreadId},
        UI::WindowsAndMessaging::{GetPropW, RemovePropW, SetPropW},
    },
};
static NEXT: AtomicUsize = AtomicUsize::new(1);
/// Creator-thread proof plus a per-window tag; a recycled numeric HWND loses this tag.
pub(super) struct OwnedSurface {
    pub identity: WindowIdentity,
    pub cookie: usize,
    expected: Vec<u16>,
    _local: PhantomData<Rc<()>>,
}
impl OwnedSurface {
    pub fn capture(id: WindowId, expected: &[u16]) -> Result<Self, QueryError> {
        let before = identity(id, expected)?;
        // SAFETY: process/thread identity queries only, no external mutation.
        let (pid, thread) = unsafe { (GetCurrentProcessId(), GetCurrentThreadId()) };
        if before.process.pid != pid || before.thread != thread {
            return Err(QueryError::IdentityChanged);
        }
        let handle = hwnd(id);
        // SAFETY: opaque own-process HWND queried without dereferencing it; key is static UTF-16.
        if !unsafe { GetPropW(handle, w!("BOGUNON.Native04.Ownership")) }.is_invalid() {
            return Err(QueryError::IdentityChanged);
        }
        let cookie = NEXT
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| v.checked_add(1))
            .map_err(|_| QueryError::IdentityChanged)?;
        // SAFETY: only creator-thread own-process window receives the non-dereferenced unique tag.
        unsafe {
            SetPropW(
                handle,
                w!("BOGUNON.Native04.Ownership"),
                Some(HANDLE(std::ptr::without_provenance_mut(cookie))),
            )
        }
        .map_err(|_| QueryError::IdentityChanged)?;
        let owned = Self {
            identity: before,
            cookie,
            expected: expected.to_vec(),
            _local: PhantomData,
        };
        owned.validate()?;
        Ok(owned)
    }
    pub fn validate(&self) -> Result<(), QueryError> {
        // SAFETY: read-only current thread ID; Rc marker prevents transfer to other threads.
        if unsafe { GetCurrentThreadId() } != self.identity.thread {
            return Err(QueryError::IdentityChanged);
        }
        if identity(self.identity.id, &self.expected)? != self.identity {
            return Err(QueryError::IdentityChanged);
        }
        // SAFETY: checked identity and static property name; value compared as opaque token only.
        if unsafe { GetPropW(hwnd(self.identity.id), w!("BOGUNON.Native04.Ownership")) }
            .0
            .addr()
            != self.cookie
        {
            return Err(QueryError::IdentityChanged);
        }
        Ok(())
    }
}
impl Drop for OwnedSurface {
    fn drop(&mut self) {
        if self.validate().is_ok() {
            // SAFETY: validation proves same creator-thread window and exact own tag; no Shell property is changed.
            let _ =
                unsafe { RemovePropW(hwnd(self.identity.id), w!("BOGUNON.Native04.Ownership")) };
        }
        // Drop is best effort, never a cleanup receipt or verified release observation.
    }
}
