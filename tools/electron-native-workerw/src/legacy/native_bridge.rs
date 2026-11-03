use super::{model as m, observation as o};
pub(super) fn process(p: &o::ProcessIdentity) -> m::ProcessIdentity {
    // Display/legacy comparison fingerprint only. Native checks retain and compare the full UTF-16 identity.
    let image = p.image.iter().fold(14695981039346656037u64, |h, c| {
        (h ^ u64::from(*c)).wrapping_mul(1099511628211)
    });
    m::ProcessIdentity {
        pid: p.pid,
        creation_time: p.created,
        verified_image: image,
    }
}
pub(super) fn window(w: &o::WindowIdentity, generation: u64) -> m::WindowIdentity {
    m::WindowIdentity {
        handle: w.id.0 as u64,
        process: process(&w.process),
        thread: w.thread,
        generation,
    }
}
pub(super) fn snapshot(
    s: &o::ObservedSnapshot,
    cookie: usize,
    anchor: Option<&o::WindowIdentity>,
) -> m::Snapshot {
    let w = &s.main;
    let parent = match &w.parent {
        o::Parent::DesktopRoot(_) => None,
        o::Parent::Child(p) => Some(window(p, p.process.created)),
    };
    let o::ScreenRect(l, t, r, b) = w.screen;
    let o::PlacementRect(pl, pt, pr, pb) = w.placement.normal;
    m::Snapshot {
        window: m::WindowSnapshot {
            main: window(&w.identity, cookie as u64),
            parent,
            owner: w.owner.as_ref().map(|p| window(p, p.process.created)),
            style: w.style,
            extended_style: w.extended_style,
            placement: m::Placement {
                flags: w.placement.flags,
                show_command: w.placement.show,
                normal: m::Rect(pl, pt, pr, pb),
                minimized_position: w.placement.minimized,
                maximized_position: w.placement.maximized,
            },
            bounds: m::Rect(l, t, r, b),
            visible: w.visible,
            minimized: w.minimized,
            maximized: w.maximized,
            monitor: w.monitor.id as u64,
            dpi: w.dpi,
            dpi_context: w.context.0 as u64,
            z_order_anchor: anchor.map(|a| window(a, a.process.created)),
        },
        explorer: process(&s.explorer),
        progman: window(&s.topology.progman, s.explorer.created),
        def_view_host: window(&s.topology.host, s.explorer.created),
        worker: window(&s.worker, s.explorer.created),
    }
}
