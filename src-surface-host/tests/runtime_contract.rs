use bogunon_desktop_surface_host::runtime_evidence::{
    CaseCleanup, CaseOutcome, FailureCase, PhaseTwoGate,
};

#[test]
fn phase_two_requires_real_phase_one_success_and_stops_on_unknown() {
    // Given: no successful Phase 1 receipt.
    let mut gate = PhaseTwoGate::new(false);
    // When: scheduling a runtime case.
    assert!(!gate.may_run());
    // Then: only a fresh successful gate can continue, and Unknown closes it permanently.
    gate = PhaseTwoGate::new(true);
    assert!(gate.may_run());
    gate.record(CaseOutcome::ExpectedRejection, CaseCleanup::Unknown);
    assert!(!gate.may_run());
    gate.record(CaseOutcome::ExpectedRejection, CaseCleanup::Verified);
    assert!(!gate.may_run());
}

#[test]
fn expected_rejection_is_not_a_cleanup_proof() {
    // Given: the expected failure was observed.
    let mut gate = PhaseTwoGate::new(true);
    // When: resources were created but their cleanup is not established.
    gate.record(CaseOutcome::ExpectedRejection, CaseCleanup::Unknown);
    // Then: the next process is never admitted.
    assert!(!gate.may_run());
}

#[test]
fn every_case_has_unique_safe_identity_and_missing_exit_is_last() {
    // Given: the fixed case plan.
    let cases = FailureCase::ALL;
    // When: deriving identifiers for the independent processes.
    let mut ids: Vec<_> = cases.iter().map(|case| case.id()).collect();
    ids.sort_unstable();
    ids.dedup();
    // Then: no replay, path input or unsafe failure mechanism exists.
    assert_eq!(ids.len(), cases.len());
    assert_eq!(cases.last(), Some(&FailureCase::MissingBrowserExit));
    assert!(ids
        .iter()
        .all(|id| id.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')));
}

#[test]
fn case_generations_are_distinct_and_overflow_never_wraps() -> Result<(), Box<dyn std::error::Error>>
{
    use bogunon_desktop_surface_host::runtime_evidence::case_generation;
    let generations = FailureCase::ALL
        .into_iter()
        .map(|case| case_generation(42, case))
        .collect::<Option<Vec<_>>>()
        .ok_or("valid generations rejected")?;
    assert!(generations
        .windows(2)
        .all(|pair| pair[0].0 < pair[1].0 && pair[0].1 < pair[1].1));
    assert!(case_generation(u64::MAX, FailureCase::EnvironmentDeadline).is_none());
    assert!(case_generation(0, FailureCase::EnvironmentDeadline).is_none());
    Ok(())
}

#[test]
fn identity_and_exit_status_cannot_turn_unknown_into_verified() {
    use bogunon_desktop_surface_host::runtime_evidence::{CaseIdentity, CaseReport};
    let identity = CaseIdentity {
        source_sha: "source".into(),
        controller_sha: "controller".into(),
        run_id: "42".into(),
        run_attempt: 1,
        host_process_id: 11,
        parent_process_id: 10,
        launch_identity: "launch".into(),
        generation: 1,
        operation_attempt: 1,
        udf_volume: Some(1),
        udf_file: Some("2".into()),
    };
    let mut report = CaseReport {
        schema: 1,
        case_id: FailureCase::EnvironmentDeadline,
        identity: identity.clone(),
        expected_failure: FailureCase::EnvironmentDeadline,
        observed_failure: Some(FailureCase::EnvironmentDeadline),
        outcome: CaseOutcome::ExpectedRejection,
        cleanup: CaseCleanup::Verified,
        native_creation_attempted: Some(true),
        contains_sensitive_data: false,
    };
    assert!(report.matches_result(&identity, report.case_id, true));
    report.cleanup = CaseCleanup::Unknown;
    assert!(!report.matches_result(&identity, report.case_id, true));
    assert!(report.matches_result(&identity, report.case_id, false));
    for field in 0..11 {
        let mut wrong = identity.clone();
        match field {
            0 => wrong.run_attempt = 2,
            1 => wrong.generation = 2,
            2 => wrong.host_process_id = 12,
            3 => wrong.controller_sha = "other".into(),
            4 => wrong.udf_file = None,
            5 => wrong.source_sha = "other".into(),
            6 => wrong.launch_identity = "other".into(),
            7 => wrong.parent_process_id = 99,
            8 => wrong.run_id = "other".into(),
            9 => wrong.operation_attempt = 99,
            _ => wrong.udf_volume = None,
        }
        assert!(!report.matches_result(&wrong, report.case_id, false));
    }
    report.observed_failure = None;
    assert!(!report.matches_result(&identity, report.case_id, false));
}

#[test]
fn real_cleanup_contract_rejects_each_identity_mismatch_without_native_execution() {
    use bogunon_desktop_surface_host::{
        cleanup::{evaluate, BrowserExitEvidence, RuntimeIdentity},
        lifecycle::Attempt,
        ownership::Ledger,
        udf::DirectoryIdentity,
    };
    let attempt = Attempt {
        generation: 1,
        nonce: 2,
    };
    let ledger = Ledger::new(attempt);
    let runtime = RuntimeIdentity {
        attempt,
        environment: 7,
        browser_process_id: 42,
        effective_udf: DirectoryIdentity { volume: 1, file: 2 },
    };
    let valid = BrowserExitEvidence {
        attempt,
        environment: 7,
        browser_process_id: 42,
        normal_exit: true,
    };
    assert!(evaluate(false, &ledger, &runtime, Some(&valid)).is_ok());
    for field in 0..4 {
        let mut wrong = valid.clone();
        match field {
            0 => wrong.environment = 8,
            1 => wrong.browser_process_id = 43,
            2 => wrong.normal_exit = false,
            _ => {
                wrong.attempt = Attempt {
                    generation: 2,
                    nonce: 3,
                }
            }
        };
        assert!(evaluate(false, &ledger, &runtime, Some(&wrong)).is_err());
    }
}

#[test]
fn scheduler_does_not_invoke_a_second_runner_after_unknown() {
    let mut gate = PhaseTwoGate::new(false);
    let mut calls = 0;
    assert_eq!(
        gate.try_run(|| {
            calls += 1;
            1
        }),
        None
    );
    gate = PhaseTwoGate::new(true);
    assert_eq!(
        gate.try_run(|| {
            calls += 1;
            1
        }),
        Some(1)
    );
    gate.record(CaseOutcome::ExpectedRejection, CaseCleanup::Unknown);
    assert_eq!(
        gate.try_run(|| {
            calls += 1;
            1
        }),
        None
    );
    assert_eq!(calls, 1);
}

#[test]
fn factory_faults_reject_before_any_native_dispatch() {
    use bogunon_desktop_surface_host::runtime_evidence::{admit_factory, CreationStage};
    assert!(admit_factory(None, CreationStage::Environment).is_ok());
    assert!(admit_factory(None, CreationStage::Controller).is_ok());
    assert!(admit_factory(
        Some(FailureCase::EnvironmentRejected),
        CreationStage::Environment
    )
    .is_err());
    assert!(admit_factory(
        Some(FailureCase::ControllerRejected),
        CreationStage::Controller
    )
    .is_err());
}

#[cfg(windows)]
#[test]
fn receipt_requires_matching_real_phase_one_run_source_attempt_and_controller(
) -> Result<(), Box<dyn std::error::Error>> {
    use bogunon_desktop_surface_host::{
        runtime_guard::SOURCE_SHA, runtime_qa::failure::phase_one_receipt_matches,
    };
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_nanos();
    let path =
        std::env::temp_dir().join(format!("c2d2-receipt-{}-{unique}.json", std::process::id()));
    let valid = serde_json::json!({"sourceSha":SOURCE_SHA,"controllerSha":"controller","runId":"42","attempt":1,"phaseOneComplete":true,"result":"PASS"});
    std::fs::write(&path, serde_json::to_vec(&valid)?)?;
    assert!(phase_one_receipt_matches(&path, "42", "controller"));
    for (key, value) in [
        ("attempt", serde_json::json!(2)),
        ("phaseOneComplete", serde_json::json!(false)),
        ("runId", serde_json::json!("41")),
        ("controllerSha", serde_json::json!("other")),
        ("sourceSha", serde_json::json!("other")),
        ("result", serde_json::json!("FAIL")),
    ] {
        let mut wrong = valid.clone();
        wrong[key] = value;
        std::fs::write(&path, serde_json::to_vec(&wrong)?)?;
        assert!(!phase_one_receipt_matches(&path, "42", "controller"));
    }
    std::fs::remove_file(path)?;
    Ok(())
}

#[test]
fn malformed_payload_is_rejected_without_native_creation() {
    use bogunon_desktop_surface_host::ipc::{parse_request, IpcError, SURFACE_ORIGIN};
    assert_eq!(
        parse_request(b"{", SURFACE_ORIGIN, true),
        Err(IpcError::InvalidSchema)
    );
}
