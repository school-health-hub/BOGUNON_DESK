use bogunon_desktop_surface_host::runtime_budget::{
    now_ms, observe, Deadline, RuntimeControl, TerminalReason, CASE_MS, FINAL_RESERVE_MS,
    PHASE_ONE_MS, PHASE_TWO_MS, RUN_MS,
};
use std::{cell::Cell, time::Duration};

#[test]
fn subordinate_budgets_and_evidence_fit_upper_budget() {
    for (allocated, upper) in [
        (PHASE_ONE_MS + PHASE_TWO_MS + FINAL_RESERVE_MS, RUN_MS),
        (8 * CASE_MS, PHASE_TWO_MS),
    ] {
        assert!(allocated <= upper);
    }
}
#[test]
fn observer_never_polls_after_deadline_or_waits_unbounded() {
    let calls = Cell::new(0);
    let result = observe::<()>(
        || {
            calls.set(calls.get() + 1);
            Ok(None)
        },
        || Duration::ZERO,
        |_| {},
    );
    assert_eq!(result, Err(TerminalReason::Timeout));
    assert_eq!(calls.get(), 0);
}
#[test]
fn child_exit_observation_consumes_only_remaining_budget() {
    let left = Cell::new(40_u64);
    let calls = Cell::new(0);
    let result = observe::<()>(
        || {
            calls.set(calls.get() + 1);
            Ok(None)
        },
        || Duration::from_millis(left.get()),
        |delay| left.set(left.get() - delay.as_millis() as u64),
    );
    assert_eq!(result, Err(TerminalReason::Timeout));
    assert_eq!(calls.get(), 2);
}
#[test]
fn polling_error_is_terminal_and_never_retried() {
    let calls = Cell::new(0);
    let result = observe::<()>(
        || {
            calls.set(calls.get() + 1);
            Err(())
        },
        || Duration::from_secs(1),
        |_| {},
    );
    assert_eq!(result, Err(TerminalReason::HarnessFailure));
    assert_eq!(calls.get(), 1);
}
#[test]
fn cancellation_is_sticky_and_does_not_reopen_admission() -> Result<(), Box<dyn std::error::Error>>
{
    let now = now_ms()?;
    let dir = std::env::temp_dir();
    // An existing directory is deliberately an invalid cancellation transport: fail closed.
    let control = RuntimeControl::new(now + RUN_MS, now + PHASE_ONE_MS, 12_000, 3_000, &dir)?;
    assert_eq!(control.admission(), Err(TerminalReason::Cancelled));
    control.stop(TerminalReason::Timeout);
    assert_eq!(control.reason(), Some(TerminalReason::Cancelled));
    Ok(())
}
#[test]
fn invalid_or_overlong_deadlines_fail_closed() -> Result<(), Box<dyn std::error::Error>> {
    assert!(Deadline::at(0, RUN_MS).is_err());
    assert!(Deadline::at(now_ms()? + RUN_MS + 10_000, RUN_MS).is_err());
    Ok(())
}

#[test]
fn cleanup_reserve_is_not_consumed_as_work_admission() -> Result<(), Box<dyn std::error::Error>> {
    let now = now_ms()?;
    let missing = std::env::temp_dir().join(format!("c2d2-no-cancel-{}", std::process::id()));
    let control = RuntimeControl::new(now + RUN_MS, now + PHASE_ONE_MS, 12_000, 3_000, &missing)?;
    control.observe_cancellation();
    assert_eq!(control.reason(), None);
    assert!(control.work.epoch() < control.cleanup.epoch());
    assert!(control.cleanup.epoch() < control.evidence.epoch());
    assert!(control.evidence.epoch() <= control.run.epoch());
    Ok(())
}

#[test]
fn intentional_unknown_is_separate_from_normal_pass_and_incomplete_evidence() {
    use bogunon_desktop_surface_host::runtime_evidence::{
        phase_two_result, CaseCleanup, CaseIdentity, CaseOutcome, CaseReport, FailureCase,
        PhaseTwoResult,
    };
    let mut reports: Vec<_> = FailureCase::ALL
        .into_iter()
        .map(|case_id| CaseReport {
            schema: 1,
            case_id,
            expected_failure: case_id,
            observed_failure: Some(case_id),
            identity: CaseIdentity {
                source_sha: "source".into(),
                controller_sha: "controller".into(),
                run_id: "1".into(),
                run_attempt: 1,
                host_process_id: 1,
                parent_process_id: 2,
                launch_identity: case_id.id().into(),
                generation: 1,
                operation_attempt: 1,
                udf_volume: None,
                udf_file: None,
            },
            outcome: CaseOutcome::ExpectedRejection,
            cleanup: if case_id == FailureCase::MissingBrowserExit {
                CaseCleanup::Unknown
            } else {
                CaseCleanup::Verified
            },
            native_creation_attempted: Some(true),
            contains_sensitive_data: false,
            terminal_reason: None,
            evidence_complete: true,
        })
        .collect();
    assert_eq!(
        phase_two_result(&reports),
        PhaseTwoResult::IntentionalCleanupUnknownObserved
    );
    assert!(bogunon_desktop_surface_host::runtime_outcome::expected_rejections_pass(&reports));
    reports[0].cleanup = CaseCleanup::Unknown;
    assert_eq!(
        phase_two_result(&reports),
        PhaseTwoResult::UnexpectedCleanupUnknown
    );
    assert!(!bogunon_desktop_surface_host::runtime_outcome::expected_rejections_pass(&reports));
    reports[0].evidence_complete = false;
    assert_eq!(
        phase_two_result(&reports),
        PhaseTwoResult::EvidenceIncomplete
    );
}

#[test]
fn continuously_nonempty_message_queue_cannot_starve_deadline_checks(
) -> Result<(), Box<dyn std::error::Error>> {
    use bogunon_desktop_surface_host::runtime_budget::pump_messages;
    let remaining = Cell::new(5);
    let count = pump_messages(
        64,
        || remaining.get() > 0,
        || {
            remaining.set(remaining.get() - 1);
            Ok::<_, std::io::Error>(true)
        },
    )?;
    assert_eq!(count, 5);
    let capped = pump_messages(64, || true, || Ok::<_, std::io::Error>(true))?;
    assert_eq!(capped, 64);
    Ok(())
}

#[test]
fn incomplete_summary_preserves_suite_timeout_and_cancellation_reason() {
    use bogunon_desktop_surface_host::runtime_budget::preserve_terminal_reason;
    for reason in [TerminalReason::Timeout, TerminalReason::Cancelled] {
        assert_eq!(preserve_terminal_reason(Some(reason), None), reason);
        assert_eq!(
            preserve_terminal_reason(Some(reason), Some(TerminalReason::HarnessFailure)),
            reason
        );
    }
    assert_eq!(
        preserve_terminal_reason(None, None),
        TerminalReason::HarnessFailure
    );
}
