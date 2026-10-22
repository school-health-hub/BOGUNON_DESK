use crate::runtime_evidence::{CaseCleanup, CaseOutcome, CaseReport, FailureCase};
use serde::Serialize;
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PhaseTwoResult {
    ExpectedRejectionsPass,
    IntentionalCleanupUnknownObserved,
    UnexpectedCleanupUnknown,
    EvidenceIncomplete,
    HarnessFailure,
}
pub fn phase_two_result(reports: &[CaseReport]) -> PhaseTwoResult {
    if reports.len() != FailureCase::ALL.len() || reports.iter().any(|r| !r.evidence_complete) {
        return PhaseTwoResult::EvidenceIncomplete;
    }
    if reports.iter().any(|r| {
        r.cleanup == CaseCleanup::Unknown
            && (r.case_id != FailureCase::MissingBrowserExit
                || r.observed_failure != Some(FailureCase::MissingBrowserExit))
    }) {
        return PhaseTwoResult::UnexpectedCleanupUnknown;
    }
    if reports
        .iter()
        .any(|r| r.outcome != CaseOutcome::ExpectedRejection || r.terminal_reason.is_some())
    {
        return PhaseTwoResult::HarnessFailure;
    }
    if reports.last().is_some_and(|r| {
        r.case_id == FailureCase::MissingBrowserExit
            && r.observed_failure == Some(FailureCase::MissingBrowserExit)
            && r.cleanup == CaseCleanup::Unknown
    }) {
        return PhaseTwoResult::IntentionalCleanupUnknownObserved;
    }
    PhaseTwoResult::ExpectedRejectionsPass
}

pub fn expected_rejections_pass(reports: &[CaseReport]) -> bool {
    let expected = &FailureCase::ALL[..FailureCase::ALL.len() - 1];
    reports.len() >= expected.len()
        && expected.iter().zip(reports).all(|(case, report)| {
            report.case_id == *case
                && report.observed_failure == Some(*case)
                && report.outcome == CaseOutcome::ExpectedRejection
                && report.evidence_complete
                && report.terminal_reason.is_none()
                && matches!(
                    report.cleanup,
                    CaseCleanup::Verified | CaseCleanup::NoResourcesCreated
                )
        })
}
