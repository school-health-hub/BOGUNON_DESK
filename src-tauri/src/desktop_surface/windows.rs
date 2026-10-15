use windows::{
    core::w,
    Win32::{
        Foundation::{HWND, RECT},
        UI::WindowsAndMessaging::{
            FindWindowExW, FindWindowW, GetWindowRect, GetWindowThreadProcessId, IsWindow,
            IsWindowVisible,
        },
    },
};

use super::probe::{ShellTopology, WorkerCandidate};

fn process_id(window: HWND) -> u32 {
    let mut process_id = 0;
    // SAFETY: `process_id` is a valid writable u32 for the duration of the call and `window`
    // comes from a successful User32 window lookup.
    unsafe { GetWindowThreadProcessId(window, Some(&mut process_id)) };
    process_id
}

fn hosts_desktop_view(window: HWND) -> bool {
    // SAFETY: This is a read-only lookup scoped to the valid top-level HWND supplied by User32.
    unsafe { FindWindowExW(Some(window), None, w!("SHELLDLL_DefView"), None) }.is_ok()
}

fn usable_bounds(window: HWND) -> bool {
    let mut bounds = RECT::default();
    // SAFETY: `bounds` is a valid writable RECT and `window` comes from User32 enumeration.
    unsafe { GetWindowRect(window, &mut bounds) }.is_ok()
        && bounds.right > bounds.left
        && bounds.bottom > bounds.top
}

fn worker_windows() -> Vec<HWND> {
    let mut workers = Vec::new();
    let mut previous = None;
    loop {
        // SAFETY: The call only reads the current top-level window list; `previous` is either
        // absent or an HWND returned by the preceding successful lookup.
        let next = unsafe { FindWindowExW(None, previous, w!("WorkerW"), None) };
        let Ok(window) = next else {
            break;
        };
        workers.push(window);
        previous = Some(window);
    }
    workers
}

pub(super) fn read_shell_topology() -> ShellTopology {
    // SAFETY: This is a read-only class-name lookup with static, null-terminated strings.
    let Ok(progman) = (unsafe { FindWindowW(w!("Progman"), None) }) else {
        return ShellTopology {
            progman_found: false,
            shell_process_validated: false,
            desktop_view_host_found: false,
            workers: Vec::new(),
        };
    };

    let shell_process_id = process_id(progman);
    let workers = worker_windows();
    let desktop_view_host = if hosts_desktop_view(progman) {
        Some(progman)
    } else {
        workers
            .iter()
            .copied()
            .find(|window| hosts_desktop_view(*window))
    };
    let attachment_sibling = desktop_view_host.and_then(|host| {
        // SAFETY: The call only searches top-level windows after a valid HWND returned by User32.
        unsafe { FindWindowExW(None, Some(host), w!("WorkerW"), None) }.ok()
    });
    let desktop_host_process_id = desktop_view_host.map(process_id);
    let shell_process_validated = shell_process_id != 0
        && desktop_host_process_id.is_some_and(|process_id| process_id == shell_process_id);

    let observations = workers
        .into_iter()
        .map(|window| {
            // SAFETY: `window` was returned by User32 immediately before this validity check.
            let is_valid = unsafe { IsWindow(Some(window)) }.as_bool();
            // SAFETY: `window` was returned by User32 and this call only reads visibility state.
            let is_visible = unsafe { IsWindowVisible(window) }.as_bool();
            WorkerCandidate {
                is_valid,
                is_visible,
                belongs_to_shell_process: process_id(window) == shell_process_id,
                hosts_desktop_view: hosts_desktop_view(window),
                is_attachment_sibling: attachment_sibling == Some(window),
                has_usable_bounds: usable_bounds(window),
            }
        })
        .collect();

    ShellTopology {
        progman_found: true,
        shell_process_validated,
        desktop_view_host_found: desktop_view_host.is_some(),
        workers: observations,
    }
}
