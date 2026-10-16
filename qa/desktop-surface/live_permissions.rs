use crate::{gate::GateError, observation_reader::Lease};
use windows::Win32::{
    Foundation::{CloseHandle, HANDLE},
    Security::{
        GetTokenInformation, TokenElevation, TokenIntegrityLevel, TOKEN_ELEVATION,
        TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
    },
    System::{
        StationsAndDesktops::{
            GetProcessWindowStation, GetUserObjectInformationW, UOI_FLAGS, USEROBJECTFLAGS,
        },
        Threading::{GetCurrentProcess, OpenProcessToken},
    },
};

fn close(handle: HANDLE) {
    // SAFETY: FFI 8/12: the lease exclusively owns this OpenProcessToken handle.
    let _ = unsafe { CloseHandle(handle) };
}
pub fn verify_permissions() -> Result<(), GateError> {
    let mut token = HANDLE::default();
    // SAFETY: FFI 8: obtains this process's borrowed pseudo-handle only.
    let process = unsafe { GetCurrentProcess() };
    // SAFETY: FFI 4/8: query-only access, initialized writable HANDLE.
    unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut token) }
        .map_err(|_| GateError::Environment)?;
    let lease = Lease::new(token, close as fn(HANDLE));
    let token = *lease.get().ok_or(GateError::Environment)?;
    let mut elevation = TOKEN_ELEVATION::default();
    let mut length = 0;
    // SAFETY: FFI 4/8: correctly sized, initialized TOKEN_ELEVATION output.
    unsafe {
        GetTokenInformation(
            token,
            TokenElevation,
            Some(std::ptr::from_mut(&mut elevation).cast()),
            u32::try_from(size_of::<TOKEN_ELEVATION>()).map_err(|_| GateError::Environment)?,
            &mut length,
        )
    }
    .map_err(|_| GateError::Environment)?;
    if elevation.TokenIsElevated != 0 {
        return Err(GateError::Environment);
    }
    let mut label = [0usize; 64];
    let capacity = size_of_val(&label);
    // SAFETY: FFI 4/8/10: initialized aligned storage; capacity is exactly its byte size.
    unsafe {
        GetTokenInformation(
            token,
            TokenIntegrityLevel,
            Some(label.as_mut_ptr().cast()),
            u32::try_from(capacity).map_err(|_| GateError::Environment)?,
            &mut length,
        )
    }
    .map_err(|_| GateError::Environment)?;
    let length = usize::try_from(length).map_err(|_| GateError::Environment)?;
    if length < size_of::<TOKEN_MANDATORY_LABEL>() || length > capacity {
        return Err(GateError::Environment);
    }
    // SAFETY: FFI 4/8: successful output contains TOKEN_MANDATORY_LABEL; unaligned read avoids alignment assumptions.
    let mandatory = unsafe {
        label
            .as_ptr()
            .cast::<TOKEN_MANDATORY_LABEL>()
            .read_unaligned()
    };
    let start = label.as_ptr().addr();
    let offset = mandatory
        .Label
        .Sid
        .0
        .addr()
        .checked_sub(start)
        .ok_or(GateError::Environment)?;
    // SAFETY: FFI 4/10: all bytes initialized by zeroed usize storage, length bounded above.
    let bytes = unsafe { std::slice::from_raw_parts(label.as_ptr().cast::<u8>(), length) };
    let sid = bytes.get(offset..).ok_or(GateError::Environment)?;
    let count = usize::from(*sid.get(1).ok_or(GateError::Environment)?);
    if sid.first() != Some(&1) || !(1..=15).contains(&count) {
        return Err(GateError::Environment);
    }
    let end = 8 + count * 4;
    let rid: [u8; 4] = sid
        .get(end - 4..end)
        .ok_or(GateError::Environment)?
        .try_into()
        .map_err(|_| GateError::Environment)?;
    if !(0x2000..0x3000).contains(&u32::from_le_bytes(rid)) {
        return Err(GateError::Environment);
    }
    // SAFETY: FFI 8: borrowed window station query, never closed or changed here.
    let station = unsafe { GetProcessWindowStation() }.map_err(|_| GateError::Environment)?;
    let mut flags = USEROBJECTFLAGS::default();
    // SAFETY: FFI 4/8: initialized correctly sized output; station handle is borrowed.
    unsafe {
        GetUserObjectInformationW(
            HANDLE(station.0),
            UOI_FLAGS,
            Some(std::ptr::from_mut(&mut flags).cast()),
            u32::try_from(size_of::<USEROBJECTFLAGS>()).map_err(|_| GateError::Environment)?,
            None,
        )
    }
    .map_err(|_| GateError::Environment)?;
    if flags.dwFlags & 1 == 0 {
        return Err(GateError::Environment);
    }
    Ok(())
}
