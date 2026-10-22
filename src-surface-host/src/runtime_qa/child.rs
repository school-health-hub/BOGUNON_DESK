use super::{failure, write_json, RuntimeCase};
use crate::runtime_evidence::{CaseCleanup, CaseIdentity, CaseOutcome, CaseReport, FailureCase};
use std::{env, fs, path::Path};
/// All ordinary runtime authorization checks have already run in this process.
pub fn run(
    base: &RuntimeCase<'_>,
    controller: &str,
    run_id: &str,
    args: &[String],
) -> Result<(), String> {
    if args.len() != 2 || args[0] != "--failure-case" {
        return Err("invalid case invocation".into());
    }
    let case_id = FailureCase::ALL
        .into_iter()
        .find(|case| case.id() == args[1])
        .ok_or("unknown case")?;
    let required = |key| env::var(key).map_err(|_| "case binding absent");
    let receipt = required("C2D2_PHASE1_RECEIPT")?;
    if !failure::phase_one_receipt_matches(Path::new(&receipt), run_id, controller) {
        return Err("phase one is not verified".into());
    }
    let generation: u64 = required("C2D2_CASE_GENERATION")?
        .parse()
        .map_err(|_| "invalid generation")?;
    let operation: u64 = required("C2D2_CASE_OPERATION")?
        .parse()
        .map_err(|_| "invalid operation")?;
    let (expected_generation, slot) =
        crate::runtime_evidence::case_generation(base.generation, case_id)
            .ok_or("generation overflow")?;
    let launch = required("C2D2_CASE_LAUNCH")?;
    if generation != expected_generation
        || operation != slot
        || launch != format!("{run_id}-1-{generation}-{}", case_id.id())
    {
        return Err("case binding mismatch".into());
    }
    fs::create_dir(base.udf).map_err(|_| "case UDF must be fresh")?;
    let udf = crate::runtime_identity::directory_identity(base.udf)
        .map_err(|_| "cannot observe case UDF")?;
    let identity = CaseIdentity {
        source_sha: crate::runtime_guard::SOURCE_SHA.into(),
        controller_sha: controller.into(),
        run_id: run_id.into(),
        run_attempt: 1,
        host_process_id: std::process::id(),
        parent_process_id: required("C2D2_CASE_PARENT")?
            .parse()
            .map_err(|_| "invalid parent")?,
        launch_identity: launch,
        generation,
        operation_attempt: operation,
        udf_volume: Some(udf.volume),
        udf_file: Some(format!("{:032x}", udf.file)),
    };
    let case = RuntimeCase {
        udf: base.udf,
        diagnostics: base.diagnostics,
        generation,
        run_nonce: operation,
        runtime_version: base.runtime_version,
        control: base.control,
    };
    super::support::timeline_event(&case, &serde_json::json!({"caseId":case_id,"identity":identity,"stage":"starting","outcome":"NOT_RUN","containsSensitiveData":false})).map_err(|_| "case start evidence failed")?;
    let result = failure::run(&case, case_id);
    let (outcome, cleanup, observed) =
        match &result {
            Ok(cleanup) => (CaseOutcome::ExpectedRejection, *cleanup, Some(case_id)),
            Err(super::RuntimeQaError::Cleanup(
                crate::cleanup::CleanupUnknown::BrowserExitMissing,
            )) if case_id == FailureCase::MissingBrowserExit => (
                CaseOutcome::ExpectedRejection,
                CaseCleanup::Unknown,
                Some(case_id),
            ),
            Err(_) => (CaseOutcome::UnexpectedFailure, CaseCleanup::Unknown, None),
        };

    let report = CaseReport {
        schema: 1,
        case_id,
        identity,
        expected_failure: case_id,
        observed_failure: observed,
        outcome,
        cleanup,
        native_creation_attempted: if matches!(
            case_id,
            FailureCase::EnvironmentRejected | FailureCase::ControllerRejected
        ) {
            Some(false)
        } else if cleanup == CaseCleanup::Verified
            || observed == Some(FailureCase::MissingBrowserExit)
        {
            Some(true)
        } else {
            None
        },
        contains_sensitive_data: false,
        terminal_reason: case.control.reason().or_else(|| {
            if result.is_err() && observed.is_none() {
                Some(crate::runtime_budget::TerminalReason::HarnessFailure)
            } else {
                None
            }
        }),
        evidence_complete: result.is_ok() || observed == Some(FailureCase::MissingBrowserExit),
    };
    super::support::timeline_event(
        &case,
        &serde_json::json!({"report":report,"terminalReason":case.control.reason()}),
    )
    .map_err(|_| "case completion evidence failed")?;
    write_json(&base.diagnostics.join("case-report.json"), &report)
        .map_err(|_| "case report write failed")?;
    if cleanup == CaseCleanup::Unknown {
        write_json(&base.diagnostics.join("cleanup-unknown.json"), &report)
            .map_err(|_| "unknown receipt write failed")?;
        return Err("case cleanup is unknown".into());
    }
    Ok(())
}
