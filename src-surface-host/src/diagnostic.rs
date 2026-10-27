use std::{fs::File, io::Write, path::PathBuf};

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic<'a> {
    pub schema: u8,
    pub stage: &'a str,
    pub result: &'a str,
    pub runtime_verification: &'a str,
    pub contains_sensitive_data: bool,
}

impl<'a> Diagnostic<'a> {
    pub const fn not_verified(stage: &'a str, result: &'a str) -> Self {
        Self {
            schema: 1,
            stage,
            result,
            runtime_verification: "NOT_VERIFIED",
            contains_sensitive_data: false,
        }
    }
}

const QA_DIAGNOSTIC_FILE: &str = "bogunon-desktop-surface-qa-diagnostic.json";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeStage {
    HostStarted,
    GrantRead,
    GrantValidation,
    RuntimeAdmission,
    BundleValidation,
    UdfCreation,
    WindowCreation,
    EnvironmentCreation,
    BrowserExitSubscription,
    ControllerCreation,
    UdfVerification,
    MainRestoreReady,
    VirtualHostMapping,
    RendererSessionRegistration,
    HtmlNavigation,
    WindowDisplay,
    MainRestoreRequest,
    RendererSessionCleanup,
    ControllerClose,
    WindowDestroy,
    BrowserExitObservation,
    BrowserExitUnsubscribe,
    CleanupEvaluation,
    UdfRemoval,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FailureCode {
    GrantReadFailed,
    InvalidGrant,
    RuntimeAdmissionRejected,
    InvalidPath,
    NativeHostFailed,
    Timeout,
    OwnershipFailed,
    MainRestoreFailed,
    CleanupUnverified,
    TemporaryCleanupFailed,
    DiagnosticWriteFailed,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CleanupStatus {
    NotEvaluated,
    Receipt,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum RuntimeOutcome {
    Running,
    Failed,
    Success,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QaRuntimeRecord {
    schema: u8,
    current_stage: RuntimeStage,
    completed_stages: Vec<RuntimeStage>,
    outcome: RuntimeOutcome,
    failure_code: Option<FailureCode>,
    cleanup_status: CleanupStatus,
    runtime_verification: &'static str,
    contains_sensitive_data: bool,
}

#[derive(Debug, Error)]
pub enum DiagnosticWriteError {
    #[error("QA runtime diagnostic could not be persisted")]
    Io,
}

pub struct QaRuntimeDiagnostic {
    destination: PathBuf,
    record: QaRuntimeRecord,
}

impl QaRuntimeDiagnostic {
    pub fn start() -> Result<Self, DiagnosticWriteError> {
        Self::start_at(std::env::temp_dir().join(QA_DIAGNOSTIC_FILE))
    }

    fn start_at(destination: PathBuf) -> Result<Self, DiagnosticWriteError> {
        let mut diagnostic = Self {
            destination,
            record: QaRuntimeRecord {
                schema: 1,
                current_stage: RuntimeStage::HostStarted,
                completed_stages: Vec::new(),
                outcome: RuntimeOutcome::Running,
                failure_code: None,
                cleanup_status: CleanupStatus::NotEvaluated,
                runtime_verification: "NOT_VERIFIED",
                contains_sensitive_data: false,
            },
        };
        diagnostic.persist()?;
        Ok(diagnostic)
    }

    pub fn begin(&mut self, stage: RuntimeStage) -> Result<(), DiagnosticWriteError> {
        self.record.current_stage = stage;
        self.persist()
    }

    pub fn complete(&mut self, stage: RuntimeStage) -> Result<(), DiagnosticWriteError> {
        self.record.current_stage = stage;
        if !self.record.completed_stages.contains(&stage) {
            self.record.completed_stages.push(stage);
        }
        self.persist()
    }

    pub fn fail(
        &mut self,
        code: FailureCode,
        cleanup_status: CleanupStatus,
    ) -> Result<(), DiagnosticWriteError> {
        self.record.outcome = RuntimeOutcome::Failed;
        self.record.failure_code = Some(code);
        self.record.cleanup_status = cleanup_status;
        self.persist()
    }

    pub fn succeed(&mut self) -> Result<(), DiagnosticWriteError> {
        self.record.outcome = RuntimeOutcome::Success;
        self.record.failure_code = None;
        self.record.cleanup_status = CleanupStatus::Receipt;
        self.persist()
    }

    fn persist(&mut self) -> Result<(), DiagnosticWriteError> {
        let mut file = File::create(&self.destination).map_err(|_| DiagnosticWriteError::Io)?;
        serde_json::to_writer(&mut file, &self.record).map_err(|_| DiagnosticWriteError::Io)?;
        file.flush().map_err(|_| DiagnosticWriteError::Io)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn diagnostic_never_claims_runtime_verification() {
        let value = serde_json::to_value(Diagnostic::not_verified("compile", "PASS")).unwrap();
        assert_eq!(value["runtimeVerification"], "NOT_VERIFIED");
        assert_eq!(value["containsSensitiveData"], false);
    }

    #[test]
    fn qa_runtime_diagnostic_records_only_fixed_non_sensitive_values() {
        let path = std::env::temp_dir().join("bogunon-s2h3-diagnostic-contract.json");
        let _ = fs::remove_file(&path);
        let mut diagnostic = QaRuntimeDiagnostic::start_at(path.clone()).unwrap();
        diagnostic.complete(RuntimeStage::HostStarted).unwrap();
        diagnostic.begin(RuntimeStage::GrantValidation).unwrap();
        diagnostic
            .fail(FailureCode::InvalidGrant, CleanupStatus::NotEvaluated)
            .unwrap();

        let raw = fs::read_to_string(&path).unwrap();
        let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["schema"], 1);
        assert_eq!(value["currentStage"], "grant_validation");
        assert_eq!(
            value["completedStages"],
            serde_json::json!(["host_started"])
        );
        assert_eq!(value["outcome"], "failed");
        assert_eq!(value["failureCode"], "invalid_grant");
        assert_eq!(value["cleanupStatus"], "not_evaluated");
        for forbidden_value in [
            "S-1-5-21-private",
            "secret-capability",
            "private-token",
            "C:\\\\Users\\\\person",
            "<html>",
        ] {
            assert!(!raw.contains(forbidden_value));
        }
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn qa_runtime_diagnostic_never_turns_cleanup_unknown_into_success() {
        let path = std::env::temp_dir().join("bogunon-s2h3-cleanup-contract.json");
        let _ = fs::remove_file(&path);
        let mut diagnostic = QaRuntimeDiagnostic::start_at(path.clone()).unwrap();
        diagnostic.begin(RuntimeStage::CleanupEvaluation).unwrap();
        diagnostic
            .fail(FailureCode::CleanupUnverified, CleanupStatus::Unknown)
            .unwrap();

        let value: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(value["outcome"], "failed");
        assert_eq!(value["cleanupStatus"], "unknown");
        assert_ne!(value["outcome"], "success");
        fs::remove_file(path).unwrap();
    }
}
