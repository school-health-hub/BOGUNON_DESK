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
