use crate::{lifecycle::Attempt, ownership::Ledger, udf::DirectoryIdentity};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeIdentity {
    pub attempt: Attempt,
    pub environment: u64,
    pub browser_process_id: u32,
    pub effective_udf: DirectoryIdentity,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrowserExitEvidence {
    pub attempt: Attempt,
    pub environment: u64,
    pub browser_process_id: u32,
    pub normal_exit: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupUnknown {
    AdmissionOpen,
    ResourceReleaseIncomplete,
    BrowserExitMissing,
    AttemptMismatch,
    EnvironmentMismatch,
    BrowserProcessMismatch,
    AbnormalBrowserExit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CleanupReceipt(());

pub fn evaluate(
    admission_open: bool,
    ledger: &Ledger,
    runtime: &RuntimeIdentity,
    exit: Option<&BrowserExitEvidence>,
) -> Result<CleanupReceipt, CleanupUnknown> {
    if admission_open {
        return Err(CleanupUnknown::AdmissionOpen);
    }
    if !ledger.is_resolved() {
        return Err(CleanupUnknown::ResourceReleaseIncomplete);
    }
    let exit = exit.ok_or(CleanupUnknown::BrowserExitMissing)?;
    if exit.attempt != runtime.attempt {
        return Err(CleanupUnknown::AttemptMismatch);
    }
    if exit.environment != runtime.environment {
        return Err(CleanupUnknown::EnvironmentMismatch);
    }
    if exit.browser_process_id != runtime.browser_process_id {
        return Err(CleanupUnknown::BrowserProcessMismatch);
    }
    if !exit.normal_exit {
        return Err(CleanupUnknown::AbnormalBrowserExit);
    }
    Ok(CleanupReceipt(()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ownership::{Ledger, Resource};

    fn fixture() -> (Attempt, Ledger, RuntimeIdentity, BrowserExitEvidence) {
        let attempt = Attempt::new(1, 2).unwrap();
        let ledger = Ledger::new(attempt);
        let runtime = RuntimeIdentity {
            attempt,
            environment: 8,
            browser_process_id: 42,
            effective_udf: DirectoryIdentity { volume: 1, file: 3 },
        };
        let exit = BrowserExitEvidence {
            attempt,
            environment: 8,
            browser_process_id: 42,
            normal_exit: true,
        };
        (attempt, ledger, runtime, exit)
    }

    #[test]
    fn issues_receipt_only_for_correlated_normal_exit_and_resolved_resources() {
        let (_, ledger, runtime, exit) = fixture();
        assert!(evaluate(false, &ledger, &runtime, Some(&exit)).is_ok());
        assert_eq!(
            evaluate(true, &ledger, &runtime, Some(&exit)),
            Err(CleanupUnknown::AdmissionOpen)
        );
    }

    #[test]
    fn unresolved_partial_creation_and_missing_exit_remain_unknown() {
        let (attempt, mut ledger, runtime, exit) = fixture();
        ledger.unresolved(attempt, Resource::Controller).unwrap();
        assert_eq!(
            evaluate(false, &ledger, &runtime, Some(&exit)),
            Err(CleanupUnknown::ResourceReleaseIncomplete)
        );
        let (_, clean, runtime, _) = fixture();
        assert_eq!(
            evaluate(false, &clean, &runtime, None),
            Err(CleanupUnknown::BrowserExitMissing)
        );
    }

    #[test]
    fn partial_native_cleanup_cannot_issue_a_receipt() {
        let (attempt, mut ledger, runtime, exit) = fixture();
        assert_eq!(ledger.acquire(attempt, Resource::Window, 2), Ok(()));
        assert_eq!(ledger.acquire(attempt, Resource::EventToken, 4), Ok(()));
        assert_eq!(ledger.release(attempt, Resource::Window, 2), Ok(()));
        assert_eq!(
            ledger.quarantine_release(attempt, Resource::EventToken, 4),
            Ok(())
        );

        assert_eq!(
            evaluate(false, &ledger, &runtime, Some(&exit)),
            Err(CleanupUnknown::ResourceReleaseIncomplete)
        );
    }
}
