use super::write_plan::{self, Write, ZOrder};
use super::{model::*, observation::WindowId, owned::OwnedSurface, read_only_windows::hwnd};
use windows::Win32::{
    Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, HWND, POINT, RECT},
    Graphics::Gdi::MapWindowPoints,
    UI::WindowsAndMessaging::*,
};
fn target(owned: &OwnedSurface, s: &Snapshot) -> Result<HWND, Failure> {
    owned.validate().map_err(|_| Failure::MainIdentity)?;
    if owned.identity.id.0 as u64 != s.window.main.handle
        || owned.cookie as u64 != s.window.main.generation
    {
        return Err(Failure::MainIdentity);
    }
    Ok(hwnd(owned.identity.id))
}
fn handle(value: u64) -> Result<HWND, Failure> {
    Ok(hwnd(WindowId(
        usize::try_from(value).map_err(|_| Failure::Verification)?,
    )))
}
const _: () = assert!(
    write_plan::CHILD == WS_CHILD.0
        && write_plan::POPUP == WS_POPUP.0
        && write_plan::APP == WS_EX_APPWINDOW.0
);
fn styles(h: HWND, style: u32, extended: u32, owned: &OwnedSurface) -> Result<(), Failure> {
    for (index, value) in [(GWL_STYLE, style), (GWL_EXSTYLE, extended)] {
        owned.validate().map_err(|_| Failure::MainIdentity)?;
        // SAFETY: caller supplies creator-owned HWND; only style indexes, never WNDPROC or Shell handles.
        unsafe { SetLastError(ERROR_SUCCESS) };
        let previous = unsafe {
            SetWindowLongPtrW(
                h,
                index,
                isize::try_from(value).map_err(|_| Failure::Verification)?,
            )
        };
        // SAFETY: immediately inspect this thread's error slot after the possibly-zero prior style.
        if previous == 0 && unsafe { GetLastError() }.0 != 0 {
            return Err(Failure::Verification);
        }
    }
    Ok(())
}
fn parent(h: HWND, new: Option<HWND>) -> Result<(), Failure> {
    // SAFETY: only owned child is changed; new parent was observed/revalidated or desktop NULL.
    unsafe { SetLastError(ERROR_SUCCESS) };
    let result = unsafe { SetParent(h, new) };
    // SAFETY: valid NULL previous parent is distinguished from an actual OS error immediately.
    if result.is_err() && unsafe { GetLastError() }.0 != 0 {
        return Err(Failure::Verification);
    }
    // SAFETY: verify relation read-only; GetParent would conflate top-level owner with parent.
    let actual = unsafe { GetAncestor(h, GA_PARENT) };
    // SAFETY: read-only desktop root token for NULL-parent restoration.
    let expected = new.unwrap_or_else(|| unsafe { GetDesktopWindow() });
    if actual != expected {
        return Err(Failure::Verification);
    }
    Ok(())
}
fn frame(h: HWND) -> Result<(), Failure> {
    // SAFETY: changes cached frame of owned window only, no activation, size, move or Z order.
    unsafe {
        SetWindowPos(
            h,
            None,
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED,
        )
    }
    .map_err(|_| Failure::Verification)
}
fn bounds(
    h: HWND,
    rect: Rect,
    coordinate_parent: Option<HWND>,
    z_order: ZOrder,
) -> Result<(), Failure> {
    let Rect(l, t, r, b) = rect;
    let width = r
        .checked_sub(l)
        .filter(|n| *n > 0)
        .ok_or(Failure::Verification)?;
    let height = b
        .checked_sub(t)
        .filter(|n| *n > 0)
        .ok_or(Failure::Verification)?;
    let mut point = [POINT { x: l, y: t }];
    if let Some(p) = coordinate_parent {
        // SAFETY: one initialized POINT transforms screen to observed WorkerW client coordinates without writes to it.
        unsafe { SetLastError(ERROR_SUCCESS) };
        let delta = unsafe { MapWindowPoints(None, Some(p), &mut point) };
        // SAFETY: zero displacement is legitimate unless LastError is nonzero.
        if delta == 0 && unsafe { GetLastError() }.0 != 0 {
            return Err(Failure::Verification);
        }
    }
    let (anchor, z) = match z_order {
        ZOrder::Preserve => (None, SWP_NOZORDER),
        ZOrder::Top => (Some(HWND_TOP), SET_WINDOW_POS_FLAGS(0)),
        ZOrder::After(id) => (Some(handle(id)?), SET_WINDOW_POS_FLAGS(0)),
    };
    // SAFETY: moves/resizes only the owned child in explicit client/screen coordinates, never foregrounds it.
    unsafe {
        SetWindowPos(
            h,
            anchor,
            point[0].x,
            point[0].y,
            width,
            height,
            SWP_NOACTIVATE | z,
        )
    }
    .map_err(|_| Failure::Verification)
}
fn placement(h: HWND, p: Placement) -> Result<(), Failure> {
    let Rect(l, t, r, b) = p.normal;
    let value = WINDOWPLACEMENT {
        length: u32::try_from(size_of::<WINDOWPLACEMENT>()).map_err(|_| Failure::Verification)?,
        flags: WINDOWPLACEMENT_FLAGS(p.flags),
        showCmd: SW_HIDE.0 as u32,
        ptMinPosition: POINT {
            x: p.minimized_position.0,
            y: p.minimized_position.1,
        },
        ptMaxPosition: POINT {
            x: p.maximized_position.0,
            y: p.maximized_position.1,
        },
        rcNormalPosition: RECT {
            left: l,
            top: t,
            right: r,
            bottom: b,
        },
    };
    // SAFETY: owned window, fully initialized original placement; visibility restored separately without activation.
    unsafe { SetWindowPlacement(h, &value) }.map_err(|_| Failure::Verification)
}
pub(super) fn apply(stage: Stage, s: &Snapshot, owned: &OwnedSurface) -> Result<(), Failure> {
    execute(write_plan::plan(stage, s, false), s, owned)
}
pub(super) fn restore(
    stage: Stage,
    s: &Snapshot,
    owned: &OwnedSurface,
    anchor_valid: bool,
) -> Result<(), Failure> {
    execute(write_plan::restore_plan(stage, s, anchor_valid), s, owned)
}
fn execute(plan: [Option<Write>; 4], s: &Snapshot, owned: &OwnedSurface) -> Result<(), Failure> {
    write_plan::execute(plan, |operation| {
        let h = target(owned, s)?;
        match operation {
            Write::Show(visible) => {
                // SAFETY: only the revalidated owned window, never activate another app.
                let _previous_visibility =
                    unsafe { ShowWindow(h, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE }) };
                Ok(())
            }
            Write::Styles(style, extended) => styles(h, style, extended, owned),
            Write::Parent(value) => parent(h, value.map(handle).transpose()?),
            Write::Frame => frame(h),
            Write::Placement(value) => placement(h, value),
            Write::Bounds(rect, p, anchor) => bounds(h, rect, p.map(handle).transpose()?, anchor),
        }
    })
}
