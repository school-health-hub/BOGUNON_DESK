use crate::own_result::Error;
use windows::{
    core::w,
    Win32::{
        Foundation::{GetLastError, SetLastError, FILETIME, HWND, RECT, WIN32_ERROR},
        System::Threading::{GetCurrentProcess, GetProcessTimes},
        UI::{HiDpi::*, WindowsAndMessaging::*},
    },
};

pub const CLASS: windows::core::PCWSTR = w!("BOGUNON_9B2P_OWN_SURFACE_QA");
pub const STYLE: WINDOW_STYLE = WS_OVERLAPPEDWINDOW;
pub const EXTENDED: WINDOW_EX_STYLE = WINDOW_EX_STYLE(WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0);

pub fn identity(handle: HWND, pid: u32, thread: u32) -> bool {
    count_owned(handle, pid, thread).unwrap_or(false)
}
pub fn count_owned(handle: HWND, pid: u32, thread: u32) -> Result<bool, Error> {
    let mut actual_pid = 0;
    let mut class = [0_u16; 64];
    // SAFETY: FFI 8/10: caller supplies only its callback or ledger HWND; output buffers are initialized and bounded.
    let (actual_thread, length) = unsafe {
        (
            GetWindowThreadProcessId(handle, Some(&mut actual_pid)),
            GetClassNameW(handle, &mut class),
        )
    };
    let expected = "BOGUNON_9B2P_OWN_SURFACE_QA";
    if length == 0 || actual_thread == 0 {
        return Err(Error::Cleanup);
    }
    let own_class = usize::try_from(length).ok() == Some(expected.len())
        && class[..expected.len()]
            .iter()
            .copied()
            .eq(expected.bytes().map(u16::from));
    if !own_class {
        return Ok(false);
    }
    if actual_thread != thread || actual_pid != pid {
        return Err(Error::Cleanup);
    }
    Ok(true)
}

struct Snapshot {
    rect: RECT,
    client: RECT,
    placement: WINDOWPLACEMENT,
    dpi: u32,
    context: DPI_AWARENESS_CONTEXT,
    caller: DPI_AWARENESS_CONTEXT,
    styles: (isize, isize),
    process_created: FILETIME,
}
fn snapshot(handle: HWND) -> Result<Snapshot, Error> {
    let mut rect = RECT::default();
    let mut client = RECT::default();
    let mut placement = WINDOWPLACEMENT {
        length: u32::try_from(size_of::<WINDOWPLACEMENT>()).map_err(|_| Error::Native)?,
        ..Default::default()
    };
    // SAFETY: FFI 8/10: all reads target the owner's verified HWND; mutable output structs are live and initialized.
    unsafe {
        GetWindowRect(handle, &mut rect).map_err(|_| Error::Native)?;
        GetClientRect(handle, &mut client).map_err(|_| Error::Native)?;
        GetWindowPlacement(handle, &mut placement).map_err(|_| Error::Native)?;
        SetLastError(WIN32_ERROR(0));
        let parent = GetParent(handle);
        if parent.is_ok() || GetLastError().0 != 0 {
            return Err(Error::Native);
        }
        SetLastError(WIN32_ERROR(0));
        let owner = GetWindow(handle, GW_OWNER);
        if owner.is_ok() || GetLastError().0 != 0 {
            return Err(Error::Native);
        }
        SetLastError(WIN32_ERROR(0));
        let style = GetWindowLongPtrW(handle, GWL_STYLE);
        if style == 0 && GetLastError().0 != 0 {
            return Err(Error::Native);
        }
        SetLastError(WIN32_ERROR(0));
        let extended = GetWindowLongPtrW(handle, GWL_EXSTYLE);
        if extended == 0 && GetLastError().0 != 0 {
            return Err(Error::Native);
        }
        let forbidden = isize::try_from(WS_CHILD.0 | WS_VISIBLE.0).map_err(|_| Error::Native)?;
        let required = isize::try_from(EXTENDED.0).map_err(|_| Error::Native)?;
        if IsWindowVisible(handle).as_bool()
            || IsIconic(handle).as_bool()
            || IsZoomed(handle).as_bool()
            || style & forbidden != 0
            || extended & required != required
        {
            return Err(Error::Native);
        }
        let dpi = GetDpiForWindow(handle);
        let context = GetWindowDpiAwarenessContext(handle);
        let caller = GetThreadDpiAwarenessContext();
        if dpi == 0
            || context.0.is_null()
            || caller.0.is_null()
            || rect.right <= rect.left
            || rect.bottom <= rect.top
            || placement.rcNormalPosition.right <= placement.rcNormalPosition.left
            || placement.rcNormalPosition.bottom <= placement.rcNormalPosition.top
            || client.left != 0
            || client.top != 0
            || client.right <= 0
            || client.bottom <= 0
        {
            return Err(Error::Native);
        }
        let (mut created, mut exited, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        GetProcessTimes(
            GetCurrentProcess(),
            &mut created,
            &mut exited,
            &mut kernel,
            &mut user,
        )
        .map_err(|_| Error::Native)?;
        Ok(Snapshot {
            rect,
            client,
            placement,
            dpi,
            context,
            caller,
            styles: (style, extended),
            process_created: created,
        })
    }
}
pub fn unchanged(handle: HWND) -> Result<(), Error> {
    let before = snapshot(handle)?;
    let after = snapshot(handle)?;
    let placement = |value: &WINDOWPLACEMENT| {
        (
            value.flags,
            value.showCmd,
            value.ptMinPosition,
            value.ptMaxPosition,
            value.rcNormalPosition,
        )
    };
    // SAFETY: FFI 8: contexts come exclusively from the DPI getters above and are compared semantically.
    let contexts_equal = unsafe {
        AreDpiAwarenessContextsEqual(before.context, after.context).as_bool()
            && AreDpiAwarenessContextsEqual(before.caller, after.caller).as_bool()
            && AreDpiAwarenessContextsEqual(before.context, before.caller).as_bool()
            && AreDpiAwarenessContextsEqual(after.context, after.caller).as_bool()
    };
    if before.rect == after.rect
        && before.client == after.client
        && placement(&before.placement) == placement(&after.placement)
        && before.dpi == after.dpi
        && before.styles == after.styles
        && before.process_created == after.process_created
        && contexts_equal
    {
        Ok(())
    } else {
        Err(Error::Native)
    }
}
