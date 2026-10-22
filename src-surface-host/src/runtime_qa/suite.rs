pub use super::child::run as child;
use super::{failure, write_json, RuntimeCase};
use crate::runtime_evidence::{
    CaseCleanup, CaseIdentity, CaseOutcome, CaseReport, FailureCase, PhaseTwoGate,
};
use std::{
    env, fs,
    path::Path,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const MAX_REPORT: u64 = 1024 * 1024;

/// Called only after the parent's actual Phase 1 returned success.
pub fn run(base: &RuntimeCase<'_>, controller: &str, run_id: &str) -> Result<(), String> {
    let receipt = base.diagnostics.join("phase-one-receipt.json");
    fs::copy(base.diagnostics.join("runtime-summary.json"), &receipt)
        .map_err(|_| "phase one receipt unavailable")?;
    let mut gate = PhaseTwoGate::new(failure::phase_one_receipt_matches(
        &receipt, run_id, controller,
    ));
    if !gate.may_run() {
        return Err("phase one receipt is not valid".into());
    }
    let mut reports = Vec::new();
    for case_id in FailureCase::ALL {
        let (generation, slot) = crate::runtime_evidence::case_generation(base.generation, case_id)
            .ok_or("generation overflow")?;
        let launch = format!("{run_id}-1-{generation}-{}", case_id.id());
        let mut report = CaseReport {
            schema: 1,
            case_id,
            expected_failure: case_id,
            observed_failure: None,
            identity: CaseIdentity {
                source_sha: crate::runtime_guard::SOURCE_SHA.into(),
                controller_sha: controller.into(),
                run_id: run_id.into(),
                run_attempt: 1,
                host_process_id: 0,
                parent_process_id: std::process::id(),
                launch_identity: launch.clone(),
                generation,
                operation_attempt: slot,
                udf_volume: None,
                udf_file: None,
            },
            outcome: CaseOutcome::NotRun,
            cleanup: CaseCleanup::NotRun,
            native_creation_attempted: Some(false),
            contains_sensitive_data: false,
        };
        if let Some(result) = gate.try_run(|| launch_case(base, &receipt, &mut report)) {
            match result {
                Ok(actual) => report = actual,
                Err(_) => {
                    report.outcome = CaseOutcome::UnexpectedFailure;
                    report.cleanup = CaseCleanup::Unknown;
                }
            }
            gate.record(report.outcome, report.cleanup);
        }
        reports.push(report);
        write_json(
            &base.diagnostics.join("phase-two-summary.json"),
            &serde_json::json!({
                "schema":1,"sourceSha":crate::runtime_guard::SOURCE_SHA,"controllerSha":controller,
                "runId":run_id,"attempt":1,"phaseOneComplete":true,"phaseTwoStarted":true,
                "cases":reports,"containsSensitiveData":false,
            }),
        )
        .map_err(|_| "cannot record phase two summary")?;
    }
    write_json(
        &base.diagnostics.join("runtime-summary.json"),
        &serde_json::json!({
            "schema":1,"sourceSha":crate::runtime_guard::SOURCE_SHA,"controllerSha":controller,
            "workflowSha":env::var("C2D2_WORKFLOW_SHA").map_err(|_| "workflow identity absent")?,
            "runId":run_id,"attempt":1,"phaseOneComplete":true,"phaseTwoStarted":true,
            "result":if gate.may_run(){"COMPLETE"}else{"CLEANUP_UNKNOWN_OR_FAILURE"},
            "containsSensitiveData":false,
        }),
    )
    .map_err(|_| "final summary write failed")?;
    if !gate.may_run() {
        return Err("phase two stopped; see case cleanup results".into());
    }
    Ok(())
}

fn launch_case(
    base: &RuntimeCase<'_>,
    receipt: &Path,
    expected: &mut CaseReport,
) -> Result<CaseReport, String> {
    let case_id = expected.case_id;
    let diagnostics = base.diagnostics.join(case_id.id());
    let udf = base.udf.with_file_name(format!(
        "c2d2-{}-{}",
        expected.identity.launch_identity,
        case_id.id()
    ));
    // Never reuse/overwrite a previous case directory or UDF.
    fs::create_dir(&diagnostics).map_err(|_| "case diagnostics already exist or unavailable")?;
    if udf.exists() {
        return Err("case UDF already exists".into());
    }
    let mut child = Command::new(env::current_exe().map_err(|_| "cannot identify harness")?)
        .arg("--failure-case")
        .arg(case_id.id())
        .env("C2D2_UDF", &udf)
        .env("C2D2_DIAGNOSTICS", &diagnostics)
        .env("C2D2_PHASE1_RECEIPT", receipt)
        .env(
            "C2D2_CASE_GENERATION",
            expected.identity.generation.to_string(),
        )
        .env(
            "C2D2_CASE_OPERATION",
            expected.identity.operation_attempt.to_string(),
        )
        .env(
            "C2D2_CASE_PARENT",
            expected.identity.parent_process_id.to_string(),
        )
        .env("C2D2_CASE_LAUNCH", &expected.identity.launch_identity)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "cannot start isolated case")?;
    let pid = child.id();
    expected.identity.host_process_id = pid;
    expected.native_creation_attempted = None;
    let deadline = Instant::now() + Duration::from_secs(240);
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|_| "case status unknown")? {
            break status;
        }
        if Instant::now() >= deadline {
            expected.outcome = CaseOutcome::UnexpectedFailure;
            expected.cleanup = CaseCleanup::Unknown;
            let evidence = write_json(&diagnostics.join("cleanup-unknown.json"), expected)
                .and_then(|()| {
                    write_json(
                        &base.diagnostics.join("runtime-summary.json"),
                        &serde_json::json!({
                            "schema":1,"phaseOneComplete":true,"phaseTwoStarted":true,
                            "result":"CLEANUP_UNKNOWN","case":expected,"containsSensitiveData":false
                        }),
                    )
                });
            // Always retain/drain the SAME child, even if diagnostic writing failed.
            let drained = child.wait();
            evidence.map_err(|_| "deadline evidence failed")?;
            drained.map_err(|_| "case process observation failed")?;
            return Err("case observer deadline expired; late exit is not cleanup proof".into());
        }
        thread::sleep(Duration::from_millis(20));
    };
    let path = diagnostics.join("case-report.json");
    if fs::metadata(&path).map_err(|_| "case report absent")?.len() > MAX_REPORT {
        return Err("case report exceeds bound".into());
    }
    let report: CaseReport =
        serde_json::from_slice(&fs::read(path).map_err(|_| "case report unreadable")?)
            .map_err(|_| "case report invalid")?;
    let mut identity = expected.identity.clone();
    identity.host_process_id = pid;
    let observed = crate::runtime_identity::directory_identity(&udf)
        .map_err(|_| "case UDF identity unavailable")?;
    identity.udf_volume = Some(observed.volume);
    identity.udf_file = Some(format!("{:032x}", observed.file));
    if !report.matches_result(&identity, case_id, status.success()) {
        return Err("case identity, status or cleanup mismatch".into());
    }
    Ok(report)
}
