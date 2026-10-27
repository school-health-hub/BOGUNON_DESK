use serde::Serialize;
use std::{
    fs, io,
    path::PathBuf,
    sync::{Arc, Mutex},
};

const FILE_NAME: &str = "bogunon-desktop-surface-qa-main-diagnostic.json";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MainStartupStage {
    MainEntry,
    SecurityInstall,
    HostPath,
    HostSpawn,
    PipeServer,
    GrantReceive,
    GrantWrite,
    ChildRegistration,
    ServerActivation,
    TauriRuntime,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MainStartupFailure {
    SecurityInstallFailed,
    HostUnavailable,
    HostSpawnFailed,
    PipeServerFailed,
    GrantReceiveFailed,
    HostExitedBeforeGrant,
    GrantWriteFailed,
    ChildRegistrationFailed,
    ServerActivationFailed,
    TauriRuntimeFailed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ChildStatus {
    NotStarted,
    Running,
    ExitedBeforeGrant,
    Unknown,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    schema: &'static str,
    current_stage: MainStartupStage,
    completed_stages: Vec<MainStartupStage>,
    outcome: &'static str,
    failure_code: Option<MainStartupFailure>,
    child_status: ChildStatus,
    contains_sensitive_data: bool,
}

#[derive(Clone)]
pub(crate) struct QaMainStartupDiagnostic {
    path: Arc<PathBuf>,
    record: Arc<Mutex<Record>>,
}

impl QaMainStartupDiagnostic {
    pub(crate) fn start() -> io::Result<Self> {
        Self::start_at(std::env::temp_dir().join(FILE_NAME))
    }

    pub(crate) fn start_at(path: PathBuf) -> io::Result<Self> {
        let diagnostic = Self {
            path: Arc::new(path),
            record: Arc::new(Mutex::new(Record {
                schema: "bogunon.desktop-surface.qa-main-startup.v1",
                current_stage: MainStartupStage::MainEntry,
                completed_stages: Vec::new(),
                outcome: "running",
                failure_code: None,
                child_status: ChildStatus::NotStarted,
                contains_sensitive_data: false,
            })),
        };
        diagnostic.persist()?;
        Ok(diagnostic)
    }

    pub(crate) fn begin(&self, stage: MainStartupStage) -> io::Result<()> {
        self.update(|record| {
            if record.failure_code.is_none() {
                record.current_stage = stage;
            }
        })
    }

    pub(crate) fn complete(&self, stage: MainStartupStage) -> io::Result<()> {
        self.update(|record| {
            record.current_stage = stage;
            if !record.completed_stages.contains(&stage) {
                record.completed_stages.push(stage);
            }
        })
    }

    pub(crate) fn fail(
        &self,
        failure: MainStartupFailure,
        child_status: ChildStatus,
    ) -> io::Result<()> {
        self.update(|record| {
            if record.failure_code.is_none() {
                record.failure_code = Some(failure);
                record.child_status = child_status;
                record.outcome = "failed";
            }
        })
    }

    pub(crate) fn succeed(&self) -> io::Result<()> {
        self.update(|record| {
            if record.failure_code.is_none() {
                record.outcome = "success";
            }
        })
    }

    fn update(&self, mutate: impl FnOnce(&mut Record)) -> io::Result<()> {
        {
            let mut record = self
                .record
                .lock()
                .map_err(|_| io::Error::other("QA Main diagnostic state is unavailable"))?;
            mutate(&mut record);
        }
        self.persist()
    }

    fn persist(&self) -> io::Result<()> {
        let record = self
            .record
            .lock()
            .map_err(|_| io::Error::other("QA Main diagnostic state is unavailable"))?;
        let bytes = serde_json::to_vec_pretty(&*record).map_err(io::Error::other)?;
        fs::write(&*self.path, bytes)
    }
}
