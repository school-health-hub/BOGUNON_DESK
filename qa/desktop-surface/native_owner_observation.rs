use super::super::owner_policy::Failure;
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::HWND,
        System::Threading::{GetCurrentProcessId, GetCurrentThreadId},
        UI::WindowsAndMessaging::*,
    },
};
pub(super) const CLASS: PCWSTR = w!("BOGUNON_9B3FB_INTEGRATION_OWN_QA");
pub(super) fn own_identity(handle: HWND) -> Result<bool, Failure> {
    let mut pid = 0;
    let mut class = [0u16; 96];
    // SAFETY: FFI 8/10: borrowed system handle, initialized bounded output buffers; no ownership adoption.
    let tid = unsafe { GetWindowThreadProcessId(handle, Some(&mut pid)) };
    // SAFETY: FFI 8/10: initialized bounded class buffer for borrowed system handle.
    let count = unsafe { GetClassNameW(handle, &mut class) };
    // SAFETY: FFI 8: calling process identity only.
    let current_pid = unsafe { GetCurrentProcessId() };
    // SAFETY: FFI 8: calling thread identity only.
    let current_tid = unsafe { GetCurrentThreadId() };
    let count = usize::try_from(count).map_err(|_| Failure::IdentityMismatch)?;
    if tid == 0 || count == 0 {
        return Err(Failure::IdentityMismatch);
    }
    // SAFETY: FFI 8/10: CLASS is the static nul-terminated UTF-16 allocation emitted by w!.
    let expected = unsafe { CLASS.as_wide() };
    Ok(tid == current_tid && pid == current_pid && class.get(..count) == Some(expected))
}
