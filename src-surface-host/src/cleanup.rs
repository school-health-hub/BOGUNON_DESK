use crate::{
    lifecycle::Attempt,
    ownership::{Ledger, LedgerIdentity, OwnershipError},
    udf::DirectoryIdentity,
};

/// Runtime identity and single-issued receipt authority bound to its ownership ledger.
///
/// ```compile_fail
/// # use bogunon_desktop_surface_host::cleanup::RuntimeIdentity;
/// fn duplicate(runtime: RuntimeIdentity) {
///     let _ = runtime.clone();
/// }
/// ```
///
/// ```compile_fail
/// # use bogunon_desktop_surface_host::cleanup::RuntimeIdentity;
/// let _ = RuntimeIdentity::default();
/// ```
#[derive(Debug, PartialEq, Eq)]
pub struct RuntimeIdentity {
    _launch: std::rc::Rc<()>,
    ledger: LedgerIdentity,
    pub(crate) attempt: Attempt,
    pub(crate) environment: u64,
    pub(crate) browser_process_id: u32,
    pub(crate) effective_udf: DirectoryIdentity,
}

impl RuntimeIdentity {
    pub(crate) fn bind(
        ledger: &mut Ledger,
        launch: &crate::runtime_qa::RuntimeLaunchAuthority,
        attempt: Attempt,
        environment: u64,
        browser_process_id: u32,
        effective_udf: DirectoryIdentity,
    ) -> Result<Self, OwnershipError> {
        let launch = launch.claim()?;
        let identity = ledger.claim_cleanup_authority(attempt)?;
        Ok(Self {
            _launch: launch,
            ledger: identity,
            attempt,
            environment,
            browser_process_id,
            effective_udf,
        })
    }
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
    LedgerMismatch,
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
    if ledger.identity() != runtime.ledger {
        return Err(CleanupUnknown::LedgerMismatch);
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
        let launch = crate::runtime_qa::RuntimeLaunchAuthority::for_test();
        let mut ledger = Ledger::new(attempt);
        let runtime = RuntimeIdentity::bind(
            &mut ledger,
            &launch,
            attempt,
            8,
            42,
            DirectoryIdentity { volume: 1, file: 3 },
        )
        .unwrap_or_else(|error| panic!("runtime authority must bind: {error}"));
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
    fn rejects_each_browser_exit_identity_mismatch() {
        let (_, ledger, runtime, valid) = fixture();
        for field in 0..4 {
            let mut wrong = valid.clone();
            match field {
                0 => wrong.environment = 9,
                1 => wrong.browser_process_id = 43,
                2 => wrong.normal_exit = false,
                _ => {
                    wrong.attempt = Attempt::new(2, 3)
                        .unwrap_or_else(|| panic!("nonzero attempt must be valid"))
                }
            }
            assert!(evaluate(false, &ledger, &runtime, Some(&wrong)).is_err());
        }
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

    #[test]
    fn substitute_resolved_ledger_cannot_hide_unresolved_runtime_ownership() {
        let attempt = Attempt::new(1, 2).unwrap_or_else(|| panic!("attempt must be valid"));
        let launch = crate::runtime_qa::RuntimeLaunchAuthority::for_test();
        let mut actual = Ledger::new(attempt);
        let mut lease = actual
            .acquire_backend_registration(attempt, 23)
            .unwrap_or_else(|error| panic!("lease must be acquired: {error}"));
        lease
            .quarantine(attempt)
            .unwrap_or_else(|error| panic!("lease must quarantine: {error}"));

        let substitute = Ledger::new(attempt);
        let runtime = RuntimeIdentity::bind(
            &mut actual,
            &launch,
            attempt,
            8,
            42,
            DirectoryIdentity { volume: 1, file: 3 },
        )
        .unwrap_or_else(|error| panic!("runtime authority must bind: {error}"));
        let exit = BrowserExitEvidence {
            attempt,
            environment: 8,
            browser_process_id: 42,
            normal_exit: true,
        };

        assert_eq!(
            evaluate(false, &substitute, &runtime, Some(&exit)),
            Err(CleanupUnknown::LedgerMismatch)
        );
        assert!(!actual.is_resolved());

        assert!(matches!(
            RuntimeIdentity::bind(
                &mut Ledger::new(attempt),
                &launch,
                attempt,
                8,
                42,
                DirectoryIdentity { volume: 1, file: 3 },
            ),
            Err(OwnershipError::AlreadyRecorded)
        ));
        assert!(matches!(
            RuntimeIdentity::bind(
                &mut actual,
                &crate::runtime_qa::RuntimeLaunchAuthority::for_test(),
                attempt,
                8,
                42,
                DirectoryIdentity { volume: 1, file: 3 },
            ),
            Err(OwnershipError::AlreadyRecorded)
        ));
    }
}
