use super::observation::*;
use std::time::Instant;

pub(super) struct Reader<Q>(pub Q);

fn eligible<'a>(
    topology: &'a Topology,
    expected: &[u16],
    session: u32,
) -> Result<&'a Worker, QueryError> {
    let explorer = &topology.shell.process;
    if explorer.image != expected
        || explorer.pid == 0
        || explorer.created == 0
        || explorer.session != session
        || topology.progman.class != "Progman"
        || topology.def_view.class != "SHELLDLL_DefView"
        || topology.def_view_parent != topology.host.id
        || !matches!(topology.host.class.as_str(), "Progman" | "WorkerW")
        || [&topology.progman, &topology.host, &topology.def_view]
            .iter()
            .any(|w| w.process != *explorer)
    {
        return Err(QueryError::ShellIdentity);
    }
    let mut candidates = topology.workers.iter().filter(|w| {
        w.identity.class == "WorkerW"
            && w.identity.process == *explorer
            && matches!(w.parent, Parent::DesktopRoot(_))
            && w.visible
            && w.usable
            && !w.has_def_view
            && w.follows_host
            && w.identity.id != topology.host.id
    });
    let candidate = candidates.next().ok_or(QueryError::AmbiguousWorker)?;
    if candidates.next().is_some() {
        return Err(QueryError::AmbiguousWorker);
    }
    Ok(candidate)
}

impl<Q: ReadQueries> SnapshotReader for Reader<Q> {
    fn collect(&mut self, main: WindowId) -> Result<ObservedSnapshot, QueryError> {
        let started = Instant::now();
        let before = self.0.identity(main)?;
        let topology = self.0.topology()?;
        let window = self.0.window(main)?;
        if window.identity != before {
            return Err(QueryError::IdentityChanged);
        }
        let worker = eligible(
            &topology,
            self.0.expected_explorer(),
            before.process.session,
        )?
        .identity
        .clone();
        if window.dpi == 0 || !self.0.dpi_equal(window.context, window.caller_context) {
            return Err(QueryError::DpiMismatch);
        }
        let after = self.0.identity(main)?;
        if before != after {
            return Err(QueryError::IdentityChanged);
        }
        if topology != self.0.topology()? {
            return Err(QueryError::TopologyChanged);
        }
        Ok(ObservedSnapshot {
            started,
            finished: Instant::now(),
            main: window,
            explorer: topology.shell.process.clone(),
            topology,
            worker,
        })
    }
    fn requery_identity(&mut self, window: WindowId) -> Result<WindowIdentity, QueryError> {
        self.0.identity(window)
    }
    fn topology_consistent(&mut self, snapshot: &ObservedSnapshot) -> Result<(), QueryError> {
        if self.0.identity(snapshot.main.identity.id)? != snapshot.main.identity {
            return Err(QueryError::IdentityChanged);
        }
        let current = self.0.topology()?;
        eligible(
            &current,
            self.0.expected_explorer(),
            snapshot.main.identity.process.session,
        )?;
        if current != snapshot.topology {
            return Err(QueryError::TopologyChanged);
        }
        Ok(())
    }
}

pub(super) struct Lease<T, F: FnMut(T)> {
    value: Option<T>,
    close: F,
}
impl<T, F: FnMut(T)> Lease<T, F> {
    pub const fn new(value: T, close: F) -> Self {
        Self {
            value: Some(value),
            close,
        }
    }
    pub const fn get(&self) -> Option<&T> {
        self.value.as_ref()
    }
}
impl<T, F: FnMut(T)> Drop for Lease<T, F> {
    fn drop(&mut self) {
        if let Some(value) = self.value.take() {
            (self.close)(value);
        }
    }
}
