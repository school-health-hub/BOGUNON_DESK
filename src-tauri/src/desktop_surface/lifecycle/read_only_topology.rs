use super::{
    observation::*,
    read_only_windows::{hwnd, identity, parent, window_id},
};
use windows::{
    core::w,
    Win32::{
        Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, HWND, RECT},
        UI::WindowsAndMessaging::*,
    },
};

pub(super) fn following_workers(
    order: &[WindowId],
    first: Option<WindowId>,
) -> Result<&[WindowId], QueryError> {
    let Some(first) = first else {
        return Ok(&order[..0]);
    };
    let start = order
        .iter()
        .position(|id| *id == first)
        .ok_or(QueryError::TopologyChanged)?;
    Ok(&order[start..])
}

fn find(
    parent: Option<HWND>,
    after: Option<HWND>,
    class: windows::core::PCWSTR,
) -> Result<Option<HWND>, QueryError> {
    // SAFETY: FFI category 8: resets only this thread's LastError.
    unsafe { SetLastError(ERROR_SUCCESS) };
    // SAFETY: FFI category 8: read-only class search using static nul-terminated class names.
    let found = unsafe { FindWindowExW(parent, after, class, None) };
    // SAFETY: FFI category 8: immediately captures the search error.
    let error = unsafe { GetLastError() }.0;
    match found {
        Ok(handle) => Ok(Some(handle)),
        Err(_) if error == 0 => Ok(None),
        Err(_) => Err(QueryError::Api("FindWindowExW", error)),
    }
}
pub(super) fn topology(expected: &[u16]) -> Result<Topology, QueryError> {
    // SAFETY: FFI category 8: read-only shell HWND query.
    let shell = window_id(unsafe { GetShellWindow() })?;
    let progman = find(None, None, w!("Progman"))?.ok_or(QueryError::ShellIdentity)?;
    let mut workers = Vec::new();
    let mut after = None;
    while let Some(worker) = find(None, after, w!("WorkerW"))? {
        if workers.len() >= 512 || workers.contains(&worker) {
            return Err(QueryError::TopologyChanged);
        }
        workers.push(worker);
        after = Some(worker);
    }
    let mut hosts = Vec::new();
    for host in std::iter::once(progman).chain(workers.iter().copied()) {
        if let Some(view) = find(Some(host), None, w!("SHELLDLL_DefView"))? {
            hosts.push((host, view));
        }
    }
    let [(host, def_view)] = hosts.as_slice() else {
        return Err(QueryError::ShellIdentity);
    };
    let following = find(None, Some(*host), w!("WorkerW"))?;
    let order = workers
        .iter()
        .map(|h| window_id(*h))
        .collect::<Result<Vec<_>, _>>()?;
    let following = following_workers(&order, following.map(window_id).transpose()?)?;
    let mut observations = Vec::new();
    for worker in workers {
        let id = window_id(worker)?;
        let mut rect = RECT::default();
        // SAFETY: FFI category 4/8: initialized writable RECT, read-only window query.
        super::read_only_process::api(
            unsafe { GetWindowRect(worker, &mut rect) },
            "worker GetWindowRect",
        )?;
        // SAFETY: FFI category 8: only reads visibility; identity captured below.
        let visible = unsafe { IsWindowVisible(worker) }.as_bool();
        observations.push(Worker {
            identity: identity(id, expected)?,
            parent: parent(id, expected)?,
            visible,
            usable: rect.right > rect.left && rect.bottom > rect.top,
            has_def_view: find(Some(worker), None, w!("SHELLDLL_DefView"))?.is_some(),
            follows_host: following.contains(&id),
        });
    }
    let def_view = identity(window_id(*def_view)?, expected)?;
    // SAFETY: FFI category 8: independently verifies actual DefView parent, not owner.
    let def_view_parent = window_id(unsafe { GetAncestor(hwnd(def_view.id), GA_PARENT) })?;
    Ok(Topology {
        shell: identity(shell, expected)?,
        progman: identity(window_id(progman)?, expected)?,
        host: identity(window_id(*host)?, expected)?,
        def_view,
        def_view_parent,
        workers: observations,
    })
}
