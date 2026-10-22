use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceIdentity<'a> {
    pub source_sha: &'a str,
    pub controller_sha: &'a str,
    pub workflow_sha: &'a str,
    pub run_id: &'a str,
    pub attempt: u32,
    pub generation: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RuntimeOutcome {
    Pass,
    Blocked,
    CleanupUnknown,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSummary<'a> {
    pub schema: u8,
    pub identity: EvidenceIdentity<'a>,
    pub outcome: RuntimeOutcome,
    pub phase_one_complete: bool,
    pub phase_two_started: bool,
    pub contains_sensitive_data: bool,
}

impl<'a> RuntimeSummary<'a> {
    pub const fn blocked(identity: EvidenceIdentity<'a>) -> Self {
        Self {
            schema: 1,
            identity,
            outcome: RuntimeOutcome::Blocked,
            phase_one_complete: false,
            phase_two_started: false,
            contains_sensitive_data: false,
        }
    }

    pub const fn may_start_phase_two(&self) -> bool {
        matches!(self.outcome, RuntimeOutcome::Pass) && self.phase_one_complete
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked_evidence_cannot_start_failure_injection() {
        let value = RuntimeSummary::blocked(EvidenceIdentity {
            source_sha: "source",
            controller_sha: "controller",
            workflow_sha: "workflow",
            run_id: "1",
            attempt: 1,
            generation: 7,
        });
        assert!(!value.may_start_phase_two());
        let json = serde_json::to_string(&value).unwrap();
        assert!(!json.contains("C:\\Users"));
        assert!(json.contains("containsSensitiveData\":false"));
    }
}

/// Fixed, non-user-extensible fault plan. Deadlines expire the observation budget,
/// never abandon a callback or kill a browser process.
#[derive(Debug, Clone, Copy, Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FailureCase {
    EnvironmentRejected,
    ControllerRejected,
    EnvironmentDeadline,
    ControllerDeadline,
    CancelBeforeController,
    HeldEventToken,
    HeldComReference,
    MissingBrowserExit,
}

impl FailureCase {
    pub const ALL: [Self; 8] = [
        Self::EnvironmentRejected,
        Self::ControllerRejected,
        Self::EnvironmentDeadline,
        Self::ControllerDeadline,
        Self::CancelBeforeController,
        Self::HeldEventToken,
        Self::HeldComReference,
        Self::MissingBrowserExit,
    ];

    pub const fn id(self) -> &'static str {
        match self {
            Self::EnvironmentRejected => "environment-rejected",
            Self::ControllerRejected => "controller-rejected",
            Self::EnvironmentDeadline => "environment-deadline",
            Self::ControllerDeadline => "controller-deadline",
            Self::CancelBeforeController => "cancel-before-controller",
            Self::HeldEventToken => "held-event-token",
            Self::HeldComReference => "held-com-reference",
            Self::MissingBrowserExit => "missing-browser-exit",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CaseOutcome {
    ExpectedRejection,
    UnexpectedFailure,
    NotRun,
}

#[derive(Debug, Clone, Copy, Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CaseCleanup {
    NoResourcesCreated,
    #[serde(rename = "CLEANUP_VERIFIED")]
    Verified,
    #[serde(rename = "CLEANUP_UNKNOWN")]
    Unknown,
    NotRun,
}

/// Pure scheduler. A result can only close this gate, never reopen it.
pub struct PhaseTwoGate {
    open: bool,
}
impl PhaseTwoGate {
    pub const fn new(phase_one_runtime_pass: bool) -> Self {
        Self {
            open: phase_one_runtime_pass,
        }
    }
    pub const fn may_run(&self) -> bool {
        self.open
    }
    pub fn try_run<T>(&self, run: impl FnOnce() -> T) -> Option<T> {
        if self.open {
            Some(run())
        } else {
            None
        }
    }
    pub fn record(&mut self, outcome: CaseOutcome, cleanup: CaseCleanup) {
        self.open &= outcome == CaseOutcome::ExpectedRejection
            && matches!(
                cleanup,
                CaseCleanup::Verified | CaseCleanup::NoResourcesCreated
            );
    }
}

#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseIdentity {
    pub source_sha: String,
    pub controller_sha: String,
    pub run_id: String,
    pub run_attempt: u32,
    pub host_process_id: u32,
    pub parent_process_id: u32,
    pub launch_identity: String,
    pub generation: u64,
    pub operation_attempt: u64,
    pub udf_volume: Option<u64>,
    pub udf_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseReport {
    pub schema: u8,
    pub case_id: FailureCase,
    pub identity: CaseIdentity,
    pub expected_failure: FailureCase,
    pub observed_failure: Option<FailureCase>,
    pub outcome: CaseOutcome,
    pub cleanup: CaseCleanup,
    pub native_creation_attempted: Option<bool>,
    pub contains_sensitive_data: bool,
}

pub fn case_generation(base: u64, case: FailureCase) -> Option<(u64, u64)> {
    if base == 0 {
        return None;
    }
    let index = FailureCase::ALL.iter().position(|entry| *entry == case)?;
    let operation = u64::try_from(index).ok()?.checked_add(1)?;
    Some((base.checked_mul(16)?.checked_add(operation)?, operation))
}

impl CaseReport {
    pub fn matches_result(
        &self,
        identity: &CaseIdentity,
        case: FailureCase,
        success: bool,
    ) -> bool {
        self.schema == 1
            && self.identity == *identity
            && self.case_id == case
            && self.expected_failure == case
            && !self.contains_sensitive_data
            && match self.outcome {
                CaseOutcome::ExpectedRejection => {
                    self.observed_failure == Some(case)
                        && match self.cleanup {
                            CaseCleanup::NoResourcesCreated => {
                                success
                                    && self.native_creation_attempted == Some(false)
                                    && matches!(
                                        case,
                                        FailureCase::EnvironmentRejected
                                            | FailureCase::ControllerRejected
                                    )
                            }
                            CaseCleanup::Verified => {
                                success && self.native_creation_attempted == Some(true)
                            }
                            CaseCleanup::Unknown => {
                                !success && self.native_creation_attempted == Some(true)
                            }
                            CaseCleanup::NotRun => false,
                        }
                }
                CaseOutcome::UnexpectedFailure => !success && self.cleanup == CaseCleanup::Unknown,
                CaseOutcome::NotRun => false,
            }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreationStage {
    Environment,
    Controller,
}
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
#[error("factory request rejected before native dispatch")]
pub struct CreationRejected;

pub fn admit_factory(
    fault: Option<FailureCase>,
    stage: CreationStage,
) -> Result<(), CreationRejected> {
    match (fault, stage) {
        (Some(FailureCase::EnvironmentRejected), CreationStage::Environment)
        | (Some(FailureCase::ControllerRejected), CreationStage::Controller) => {
            Err(CreationRejected)
        }
        _ => Ok(()),
    }
}
