use super::{
    observation::{self as o, ReadQueries},
    observation_reader, read_only_windows,
};
use serde::Serialize;
use windows::Win32::{
    Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTONULL},
    UI::HiDpi::GetDpiForWindow,
};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateRow {
    index: usize,
    checks: [bool; 8],
    dpi_matches: bool,
    monitor_matches: bool,
    identity_stable: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateReport {
    pub rows: Vec<CandidateRow>,
    pub selected: bool,
    pub stable: bool,
    pub status: &'static str,
}
pub(super) fn classify(
    reader: &mut observation_reader::Reader<read_only_windows::NativeQueries>,
    t: &o::Topology,
    target: &o::ObservedWindow,
) -> Result<CandidateReport, o::QueryError> {
    let (candidate, facts) =
        observation_reader::classify_shell(t, &reader.0.expected, target.identity.process.session)?;
    let mut rows = Vec::new();
    let mut qualified = false;
    for (index, (worker, checks)) in t.workers.iter().zip(facts).enumerate() {
        let handle = read_only_windows::hwnd(worker.identity.id);
        // SAFETY: query-only APIs on an observed HWND; full identity is independently rechecked.
        let (dpi, monitor) = unsafe {
            (
                GetDpiForWindow(handle),
                MonitorFromWindow(handle, MONITOR_DEFAULTTONULL),
            )
        };
        let identity_stable = reader.0.identity(worker.identity.id)? == worker.identity;
        let dpi_matches = dpi != 0 && dpi == target.dpi;
        let monitor_matches = !monitor.is_invalid() && monitor.0.addr() == target.monitor.id;
        if candidate.as_ref() == Some(&worker.identity)
            && checks.iter().all(|v| *v)
            && dpi_matches
            && monitor_matches
            && identity_stable
        {
            qualified = true;
        }
        rows.push(CandidateRow {
            index,
            checks,
            dpi_matches,
            monitor_matches,
            identity_stable,
        });
    }
    let stable = reader.0.topology()? == *t;
    let selected = qualified && stable;
    Ok(CandidateReport {
        rows,
        selected,
        stable,
        status: if selected {
            "UniqueObservedCandidate"
        } else {
            "UNKNOWN"
        },
    })
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Baseline {
    pub hwnd: String,
    pub pid: u32,
    pub thread_id: u32,
    pub created: String,
    pub generation: String,
    pub parent_hwnd: String,
    pub desktop_root: bool,
    pub style: u32,
    pub extended_style: u32,
    pub visible: bool,
    pub rect: [i32; 4],
    pub placement: [i32; 8],
    pub placement_flags: u32,
    pub show_command: u32,
    pub predecessor: Option<String>,
    pub monitor: String,
    pub monitor_bounds: [i32; 4],
    pub work: [i32; 4],
    pub dpi: u32,
    pub explorer_pid: u32,
    pub explorer_created: String,
    pub progman: String,
    pub def_view: String,
}
pub(super) fn baseline(
    w: &o::ObservedWindow,
    t: &o::Topology,
    generation: u64,
) -> Result<Baseline, o::QueryError> {
    use windows::Win32::{
        Foundation::{GetLastError, SetLastError, ERROR_SUCCESS},
        UI::WindowsAndMessaging::{GetWindow, GW_HWNDPREV},
    };
    // SAFETY: changes only this thread's error slot, then one read-only predecessor query.
    unsafe { SetLastError(ERROR_SUCCESS) };
    let predecessor = unsafe { GetWindow(read_only_windows::hwnd(w.identity.id), GW_HWNDPREV) };
    // SAFETY: immediate thread-local query status.
    let error = unsafe { GetLastError() }.0;
    let predecessor = match predecessor {
        Ok(h) => Some(h.0.addr().to_string()),
        Err(_) if error == 0 => None,
        Err(_) => return Err(o::QueryError::IdentityChanged),
    };
    let (parent_hwnd, desktop_root) = match &w.parent {
        o::Parent::DesktopRoot(id) => (id.0 as u64, true),
        o::Parent::Child(p) => (p.id.0 as u64, false),
    };
    let o::ScreenRect(l, t0, r, b) = w.screen;
    let o::ScreenRect(ml, mt, mr, mb) = w.monitor.bounds;
    let o::ScreenRect(wl, wt, wr, wb) = w.monitor.work;
    let o::PlacementRect(pl, pt, pr, pb) = w.placement.normal;
    Ok(Baseline {
        hwnd: w.identity.id.0.to_string(),
        pid: w.identity.process.pid,
        thread_id: w.identity.thread,
        created: w.identity.process.created.to_string(),
        generation: generation.to_string(),
        parent_hwnd: parent_hwnd.to_string(),
        desktop_root,
        style: w.style,
        extended_style: w.extended_style,
        visible: w.visible,
        rect: [l, t0, r, b],
        placement: [
            pl,
            pt,
            pr,
            pb,
            w.placement.minimized.0,
            w.placement.minimized.1,
            w.placement.maximized.0,
            w.placement.maximized.1,
        ],
        placement_flags: w.placement.flags,
        show_command: w.placement.show,
        predecessor,
        monitor: w.monitor.id.to_string(),
        monitor_bounds: [ml, mt, mr, mb],
        work: [wl, wt, wr, wb],
        dpi: w.dpi,
        explorer_pid: t.shell.process.pid,
        explorer_created: t.shell.process.created.to_string(),
        progman: t.progman.id.0.to_string(),
        def_view: t.def_view.id.0.to_string(),
    })
}
