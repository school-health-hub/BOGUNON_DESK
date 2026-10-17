use super::observation::*;
use std::time::Instant;

#[path = "worker_evidence.rs"]
pub(super) mod evidence;

pub(super) struct Reader<Q>(pub Q);

fn validate_shell(topology: &Topology, expected: &[u16], session: u32) -> Result<(), QueryError> {
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
    Ok(())
}

fn select_worker(topology: &Topology) -> Result<&Worker, QueryError> {
    let mut candidates = topology.workers.iter().filter(|worker| {
        evidence::checks(worker, topology)
            .iter()
            .all(|value| *value)
    });
    let candidate = candidates.next().ok_or(QueryError::NoEligibleWorker)?;
    if candidates.next().is_some() {
        return Err(QueryError::AmbiguousWorker);
    }
    Ok(candidate)
}

impl<Q: ReadQueries> Reader<Q> {
    pub fn collect_with_evidence(
        &mut self,
        main: WindowId,
    ) -> (Result<ObservedSnapshot, QueryError>, evidence::Evidence) {
        let mut evidence = evidence::Evidence::default();
        let result = self.collect_observed(main, &mut evidence);
        evidence.finish(result.as_ref().err());
        (result, evidence)
    }

    fn collect_observed(
        &mut self,
        main: WindowId,
        evidence: &mut evidence::Evidence,
    ) -> Result<ObservedSnapshot, QueryError> {
        let started = Instant::now();
        let before = self.0.identity(main)?;
        let topology = self.0.topology()?;
        evidence.workers_enumerated = Some(topology.workers.len());
        let window = self.0.window(main)?;
        if window.identity != before {
            return Err(QueryError::IdentityChanged);
        }
        validate_shell(
            &topology,
            self.0.expected_explorer(),
            before.process.session,
        )?;
        evidence.shell_identity_passed = true;
        evidence.count_candidates(&topology);
        let worker = match select_worker(&topology) {
            Ok(worker) => Some(worker.identity.clone()),
            Err(QueryError::NoEligibleWorker) => None,
            Err(error) => return Err(error),
        };
        if window.dpi == 0 || !self.0.dpi_equal(window.context, window.caller_context) {
            return Err(QueryError::DpiMismatch);
        }
        evidence.dpi_passed = true;
        let after = self.0.identity(main)?;
        if before != after {
            return Err(QueryError::IdentityChanged);
        }
        evidence.main_identity_recheck_passed = true;
        if topology != self.0.topology()? {
            return Err(QueryError::TopologyChanged);
        }
        evidence.topology_recheck_passed = true;
        let worker = worker.ok_or(QueryError::NoEligibleWorker)?;
        Ok(ObservedSnapshot {
            started,
            finished: Instant::now(),
            main: window,
            explorer: topology.shell.process.clone(),
            topology,
            worker,
        })
    }
}

impl<Q: ReadQueries> SnapshotReader for Reader<Q> {
    fn collect(&mut self, main: WindowId) -> Result<ObservedSnapshot, QueryError> {
        self.collect_with_evidence(main).0
    }
    fn requery_identity(&mut self, window: WindowId) -> Result<WindowIdentity, QueryError> {
        self.0.identity(window)
    }
    fn topology_consistent(&mut self, snapshot: &ObservedSnapshot) -> Result<(), QueryError> {
        if self.0.identity(snapshot.main.identity.id)? != snapshot.main.identity {
            return Err(QueryError::IdentityChanged);
        }
        let current = self.0.topology()?;
        if current != snapshot.topology {
            return Err(QueryError::TopologyChanged);
        }
        validate_shell(
            &current,
            self.0.expected_explorer(),
            snapshot.main.identity.process.session,
        )?;
        select_worker(&current)?;
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
