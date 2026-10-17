use crate::own_result::Error;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::{
    Foundation::HANDLE,
    System::StationsAndDesktops::{
        CloseDesktop, GetThreadDesktop, GetUserObjectInformationW, OpenInputDesktop,
        DESKTOP_CONTROL_FLAGS, DESKTOP_READOBJECTS, HDESK, UOI_IO, UOI_NAME,
    },
};

struct Desktop(HDESK);
impl Drop for Desktop {
    fn drop(&mut self) {
        // SAFETY: FFI 8/12: this guard owns the single OpenInputDesktop handle.
        let _ = unsafe { CloseDesktop(self.0) };
    }
}
pub fn input_desktop() -> Result<(), Error> {
    // SAFETY: FFI 8: query-only desktop access, no hook or desktop switch requested.
    let desktop = Desktop(
        unsafe { OpenInputDesktop(DESKTOP_CONTROL_FLAGS(0), false, DESKTOP_READOBJECTS) }
            .map_err(|_| Error::Gate)?,
    );
    let mut receives_input = windows::core::BOOL::default();
    // SAFETY: FFI 4/8: correctly sized initialized BOOL; borrowed valid desktop handle.
    unsafe {
        GetUserObjectInformationW(
            HANDLE(desktop.0 .0),
            UOI_IO,
            Some(std::ptr::from_mut(&mut receives_input).cast()),
            u32::try_from(size_of_val(&receives_input)).map_err(|_| Error::Gate)?,
            None,
        )
    }
    .map_err(|_| Error::Gate)?;
    let mut name = [0u16; 128];
    let mut length = 0;
    // SAFETY: FFI 4/8/10: fixed initialized UTF-16 storage with exact byte capacity.
    unsafe {
        GetUserObjectInformationW(
            HANDLE(desktop.0 .0),
            UOI_NAME,
            Some(name.as_mut_ptr().cast()),
            u32::try_from(size_of_val(&name)).map_err(|_| Error::Gate)?,
            Some(&mut length),
        )
    }
    .map_err(|_| Error::Gate)?;
    let default: Vec<_> = "Default".encode_utf16().chain(Some(0)).collect();
    if !receives_input.as_bool()
        || length != u32::try_from(default.len() * 2).map_err(|_| Error::Gate)?
        || name.get(..default.len()) != Some(default.as_slice())
    {
        return Err(Error::Gate);
    }
    // SAFETY: FFI 8: borrowed desktop for the current creator thread; never closed or switched.
    let current = unsafe { GetThreadDesktop(GetCurrentThreadId()) }.map_err(|_| Error::Gate)?;
    name.fill(0);
    // SAFETY: FFI 4/8/10: initialized bounded name buffer, current thread's borrowed desktop.
    unsafe {
        GetUserObjectInformationW(
            HANDLE(current.0),
            UOI_NAME,
            Some(name.as_mut_ptr().cast()),
            u32::try_from(size_of_val(&name)).map_err(|_| Error::Gate)?,
            Some(&mut length),
        )
    }
    .map_err(|_| Error::Gate)?;
    if length != u32::try_from(default.len() * 2).map_err(|_| Error::Gate)?
        || name.get(..default.len()) != Some(default.as_slice())
    {
        return Err(Error::Gate);
    }
    Ok(())
}
