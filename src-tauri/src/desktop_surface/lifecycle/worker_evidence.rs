use super::super::observation::{Parent, QueryError, Topology, Worker};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Reason {
    Unknown,
    NoWorkersEnumerated,
    NoEligibleWorker,
    EligibleWorkerFound,
    AmbiguousWorker,
    ShellIdentityFailed,
    TopologyChanged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Failure {
    Api,
    Hresult,
    InvalidValue,
    IdentityChanged,
    ShellIdentity,
    TopologyChanged,
    NoEligibleWorker,
    AmbiguousWorker,
    DpiMismatch,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Exclusions {
    pub class: usize,
    pub process: usize,
    pub parent: usize,
    pub hidden: usize,
    pub bounds: usize,
    pub def_view: usize,
    pub order: usize,
    pub host: usize,
}

pub(super) fn checks(worker: &Worker, topology: &Topology) -> [bool; 8] {
    [
        worker.identity.class == "WorkerW",
        worker.identity.process == topology.shell.process,
        matches!(worker.parent, Parent::DesktopRoot(_)),
        worker.visible,
        worker.usable,
        !worker.has_def_view,
        worker.follows_host,
        worker.identity.id != topology.host.id,
    ]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Evidence {
    pub reason: Reason,
    pub workers_enumerated: Option<usize>,
    pub eligible_workers: Option<usize>,
    pub exclusions: Option<Exclusions>,
    pub shell_identity_passed: bool,
    pub dpi_passed: bool,
    pub main_identity_recheck_passed: bool,
    pub topology_recheck_passed: bool,
    pub error: Option<Failure>,
}

impl Default for Evidence {
    fn default() -> Self {
        Self {
            reason: Reason::Unknown,
            workers_enumerated: None,
            eligible_workers: None,
            exclusions: None,
            shell_identity_passed: false,
            dpi_passed: false,
            main_identity_recheck_passed: false,
            topology_recheck_passed: false,
            error: None,
        }
    }
}

impl Evidence {
    pub(super) fn count_candidates(&mut self, topology: &Topology) {
        let mut excluded = Exclusions::default();
        let mut eligible = 0;
        for worker in &topology.workers {
            let passed = checks(worker, topology);
            eligible += usize::from(passed.iter().all(|value| *value));
            excluded.class += usize::from(!passed[0]);
            excluded.process += usize::from(!passed[1]);
            excluded.parent += usize::from(!passed[2]);
            excluded.hidden += usize::from(!passed[3]);
            excluded.bounds += usize::from(!passed[4]);
            excluded.def_view += usize::from(!passed[5]);
            excluded.order += usize::from(!passed[6]);
            excluded.host += usize::from(!passed[7]);
        }
        self.eligible_workers = Some(eligible);
        self.exclusions = Some(excluded);
    }

    pub(super) fn finish(&mut self, error: Option<&QueryError>) {
        self.reason = match error {
            None => Reason::EligibleWorkerFound,
            Some(QueryError::NoEligibleWorker) => match self.workers_enumerated {
                Some(0) => Reason::NoWorkersEnumerated,
                Some(_) => Reason::NoEligibleWorker,
                None => Reason::Unknown,
            },
            Some(QueryError::AmbiguousWorker) => Reason::AmbiguousWorker,
            Some(QueryError::ShellIdentity) => Reason::ShellIdentityFailed,
            Some(QueryError::TopologyChanged) => Reason::TopologyChanged,
            Some(
                QueryError::Api(..)
                | QueryError::Hresult(..)
                | QueryError::InvalidValue(..)
                | QueryError::IdentityChanged
                | QueryError::DpiMismatch,
            ) => Reason::Unknown,
        };
        self.error = error.map(|error| match error {
            QueryError::Api(..) => Failure::Api,
            QueryError::Hresult(..) => Failure::Hresult,
            QueryError::InvalidValue(..) => Failure::InvalidValue,
            QueryError::IdentityChanged => Failure::IdentityChanged,
            QueryError::ShellIdentity => Failure::ShellIdentity,
            QueryError::TopologyChanged => Failure::TopologyChanged,
            QueryError::NoEligibleWorker => Failure::NoEligibleWorker,
            QueryError::AmbiguousWorker => Failure::AmbiguousWorker,
            QueryError::DpiMismatch => Failure::DpiMismatch,
        });
    }

    pub fn write_json(&self, writer: &mut impl std::io::Write) -> serde_json::Result<()> {
        serde_json::to_writer(writer, self)
    }
}
