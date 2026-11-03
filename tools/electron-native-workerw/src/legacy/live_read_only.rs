//! Query-only Host adapter. No owned-window tag writes, Shell messages or NativeAdapter linkage.
use super::{
    observation::{self as o, ReadQueries},
    read_only_process, read_only_windows,
};
use crate::{
    live_contract::LiveBinding,
    preflight::{Blocker, Observation, PreflightSession, Provenance, WindowState},
};
use serde::Serialize;

use windows::{
    core::w,
    Win32::{
        Foundation::{GetLastError, SetLastError, ERROR_SUCCESS},
        System::Threading::GetCurrentThreadId,
        UI::WindowsAndMessaging::{GetPropW, GetWindow, GW_HWNDPREV},
    },
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellReport {
    provenance: Provenance,
    pub shell_verified: bool,
    pub topology_stable: bool,
    pub progman_observed: bool,
    pub workers_enumerated: Option<usize>,
    pub eligible_workers: Option<usize>,
    pub reference_window_state_observed: bool,
    pub reference_dpi_compatible: bool,
    pub target_verified: bool,
    pub execution_allowed: bool,
    pub native_cleanup: &'static str,
    pub blocker: &'static str,
}
fn denied() -> ShellReport {
    ShellReport {
        provenance: Provenance::OsReadOnly,
        shell_verified: false,
        topology_stable: false,
        progman_observed: false,
        workers_enumerated: None,
        eligible_workers: None,
        reference_window_state_observed: false,
        reference_dpi_compatible: false,
        target_verified: false,
        execution_allowed: false,
        native_cleanup: "NotVerified",
        blocker: "ObservationUnavailable",
    }
}
/// Observes only Shell reference windows, not a user application or an attachment target.
pub fn observe_shell() -> ShellReport {
    let mut r = denied();
    let Ok(mut reader) = read_only_windows::reader() else {
        return r;
    };
    let Ok(topology) = reader.0.topology() else {
        return r;
    };
    r.progman_observed = topology.progman.class == "Progman";
    let Ok(host) = read_only_process::process(std::process::id(), &reader.0.expected) else {
        return r;
    };
    r.shell_verified = topology.shell.process.image == reader.0.expected
        && topology.shell.process.session == host.session
        && topology.progman.process == topology.shell.process
        && topology.def_view.process == topology.shell.process;
    // Existing 9B candidate policy and independent topology recheck, without exposing HWND/path/PID.
    let (_, evidence) = reader.collect_with_evidence(topology.shell.id);
    r.workers_enumerated = evidence.workers_enumerated;
    r.eligible_workers = evidence.eligible_workers;
    if let Ok(reference) = reader.0.window(topology.shell.id) {
        r.reference_window_state_observed = true;
        r.reference_dpi_compatible = reader
            .0
            .dpi_equal(reference.context, reference.caller_context);
    }
    r.topology_stable = reader.0.topology().is_ok_and(|after| after == topology);
    r.blocker = if !r.shell_verified || !r.topology_stable {
        "ShellIdentityOrTopologyUnverified"
    } else if r.eligible_workers != Some(1) {
        "NoUniqueEligibleWorker"
    } else {
        "HostOwnedTargetMissing"
    };
    r
}
fn predecessor(id: o::WindowId, expected: &[u16]) -> Result<Option<(u64, u32, u64)>, Blocker> {
    // SAFETY: only the calling thread's error slot changes; query is bounded to one predecessor.
    unsafe { SetLastError(ERROR_SUCCESS) };
    // SAFETY: HWND is an opaque queried token, never dereferenced by Rust.
    let value = unsafe { GetWindow(read_only_windows::hwnd(id), GW_HWNDPREV) };
    // SAFETY: immediately captures this thread's query error.
    let error = unsafe { GetLastError() }.0;
    match value {
        Ok(handle) => {
            let identity = read_only_windows::identity(o::WindowId(handle.0.addr()), expected)
                .map_err(|_| Blocker::RecoveryUnproven)?;
            Ok(Some((
                identity.id.0 as u64,
                identity.process.pid,
                identity.process.created,
            )))
        }
        Err(_) if error == 0 => Ok(None),
        Err(_) => Err(Blocker::RecoveryUnproven),
    }
}
/// No public caller can construct an OS observation. Capture requires the reserved exact creator
/// window and its pre-existing ownership generation tag; this function never installs a tag.
pub(crate) fn capture(session: &PreflightSession, b: LiveBinding) -> Result<Observation, Blocker> {
    let captured = session.elapsed();
    if b.host_pid != std::process::id() {
        return Err(Blocker::OwnershipChanged);
    }
    let mut reader = read_only_windows::reader().map_err(|_| Blocker::RecoveryUnproven)?;
    let id = o::WindowId(usize::try_from(b.surface).map_err(|_| Blocker::InvalidBinding)?);
    let identity = reader
        .0
        .identity(id)
        .map_err(|_| Blocker::IdentityChanged)?;
    // SAFETY: read-only current creator thread identity.
    let thread = unsafe { GetCurrentThreadId() };
    if identity.process.pid != b.host_pid
        || identity.process.created != b.host_creation
        || identity.process.session != b.host_session
        || identity.thread != thread
        || thread != b.host_thread
    {
        return Err(Blocker::OwnershipChanged);
    }
    // SAFETY: query-only property lookup on a creator-thread-owned HWND; no pointer dereference.
    let tag = unsafe {
        GetPropW(
            read_only_windows::hwnd(id),
            w!("BOGUNON.Native04.Ownership"),
        )
    };
    if tag.0.addr() as u64 != b.surface_generation {
        return Err(Blocker::OwnershipChanged);
    }
    let snapshot = reader
        .collect_with_evidence(id)
        .0
        .map_err(|_| Blocker::TopologyChanged)?;
    if snapshot.explorer.created != b.explorer_creation
        || snapshot.explorer.pid != b.explorer_pid
        || snapshot.explorer.session != b.host_session
        || b.explorer_generation != snapshot.explorer.created
    {
        return Err(Blocker::IdentityChanged);
    }
    let anchor = predecessor(id, &reader.0.expected)?;
    let win = &snapshot.main;
    if !matches!(win.parent, o::Parent::DesktopRoot(_))
        || win.owner.is_some()
        || win.minimized
        || win.maximized
    {
        return Err(Blocker::RecoveryUnproven);
    }
    let o::ScreenRect(l, t, r, bottom) = win.screen;
    let o::ScreenRect(wl, wt, wr, wb) = win.monitor.work;
    if l < wl || t < wt || r > wr || bottom > wb {
        return Err(Blocker::RecoveryUnproven);
    }
    let o::PlacementRect(pl, pt, pr, pb) = win.placement.normal;
    let state = WindowState {
        parent: 0,
        placement_flags: win.placement.flags,
        placement_show: win.placement.show,
        placement_screen: win.placement.space == o::PlacementSpace::Screen,
        position: [l, t, r, bottom],
        placement: [
            pl,
            pt,
            pr,
            pb,
            win.placement.minimized.0,
            win.placement.minimized.1,
            win.placement.maximized.0,
            win.placement.maximized.1,
        ],
        visible: win.visible,
        style: win.style,
        extended_style: win.extended_style,
        predecessor: anchor,
        monitor: win.monitor.id as u64,
        monitor_bounds: {
            let o::ScreenRect(l, t, r, b) = win.monitor.bounds;
            [l, t, r, b]
        },
        work: [wl, wt, wr, wb],
        dpi: win.dpi,
    };
    let latest = reader.0.window(id).map_err(|_| Blocker::IdentityChanged)?;
    if latest.monitor != win.monitor
        || latest.dpi != win.dpi
        || !reader.0.dpi_equal(latest.context, win.context)
        || latest.screen != win.screen
        || latest.parent != win.parent
        || latest.style != win.style
        || latest.extended_style != win.extended_style
        || latest.placement != win.placement
        || latest.visible != win.visible
    {
        return Err(Blocker::MonitorDpiChanged);
    }
    // SAFETY: second query-only generation tag detects recycled owned HWNDs.
    let final_tag = unsafe {
        GetPropW(
            read_only_windows::hwnd(id),
            w!("BOGUNON.Native04.Ownership"),
        )
    };
    if final_tag.0.addr() as u64 != b.surface_generation {
        return Err(Blocker::OwnershipChanged);
    }
    if reader
        .0
        .identity(id)
        .map_err(|_| Blocker::IdentityChanged)?
        != identity
        || predecessor(id, &reader.0.expected)? != anchor
        || reader.0.topology().map_err(|_| Blocker::TopologyChanged)? != snapshot.topology
    {
        return Err(Blocker::IdentityChanged);
    }
    Ok(Observation {
        binding: b,
        provenance: Provenance::OsReadOnly,
        ledger: session.ledger_identity(),
        captured,
        state,
        worker: snapshot.worker.id.0 as u64,
        identity_rechecked: true,
        topology_rechecked: true,
        same_dpi_context: reader.0.dpi_equal(win.context, win.caller_context),
    })
}
