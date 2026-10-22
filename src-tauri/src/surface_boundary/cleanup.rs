use super::{AttemptBinding, IdentityToken, Ledger, LedgerState, VerifiedIsolation};

#[derive(Clone)]
pub(crate) struct BrowserExitEvidence {
    binding: AttemptBinding,
    environment: IdentityToken,
    browser_process: IdentityToken,
}

impl BrowserExitEvidence {
    pub(crate) const fn new(
        binding: AttemptBinding,
        environment: IdentityToken,
        browser_process: IdentityToken,
    ) -> Self {
        Self {
            binding,
            environment,
            browser_process,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CleanupUnknownReason {
    AlreadyFinalized,
    AttemptMismatch,
    IsolationMismatch,
    AdmissionOpen,
    InvalidLedgerState,
    ResourceReleaseIncomplete,
    BrowserProcessExitMissing,
    EnvironmentMismatch,
    BrowserProcessMismatch,
}

#[derive(Debug)]
pub(crate) struct CleanupReceipt(());

#[derive(Debug)]
pub(crate) enum CleanupDecision {
    Passed(CleanupReceipt),
    Unknown(CleanupUnknownReason),
}

pub(crate) fn evaluate_cleanup(
    ledger: &mut Ledger,
    isolation: &VerifiedIsolation,
    browser_exit: Option<BrowserExitEvidence>,
) -> CleanupDecision {
    if ledger.state() == LedgerState::Retired {
        return CleanupDecision::Unknown(CleanupUnknownReason::AlreadyFinalized);
    }
    let Some(exit) = browser_exit else {
        return CleanupDecision::Unknown(CleanupUnknownReason::BrowserProcessExitMissing);
    };
    if !ledger.binding_matches(&exit.binding) {
        return CleanupDecision::Unknown(CleanupUnknownReason::AttemptMismatch);
    }
    if !isolation.binding_matches(&exit.binding) {
        return CleanupDecision::Unknown(CleanupUnknownReason::IsolationMismatch);
    }
    if ledger.admission_open() {
        return CleanupDecision::Unknown(CleanupUnknownReason::AdmissionOpen);
    }
    if ledger.state() != LedgerState::Retiring {
        return CleanupDecision::Unknown(CleanupUnknownReason::InvalidLedgerState);
    }
    if !ledger.all_resources_released() {
        return CleanupDecision::Unknown(CleanupUnknownReason::ResourceReleaseIncomplete);
    }
    if !isolation.environment_matches(&exit.environment) {
        return CleanupDecision::Unknown(CleanupUnknownReason::EnvironmentMismatch);
    }
    if !isolation.browser_process_matches(&exit.browser_process) {
        return CleanupDecision::Unknown(CleanupUnknownReason::BrowserProcessMismatch);
    }
    ledger.mark_retired();
    CleanupDecision::Passed(CleanupReceipt(()))
}
