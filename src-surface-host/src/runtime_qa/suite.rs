pub use super::child::run as child;
use super::{failure, write_json, RuntimeCase};
use crate::{
    runtime_budget::{self, Deadline, TerminalReason, CASE_MS, FINAL_RESERVE_MS, PHASE_TWO_MS},
    runtime_evidence::{
        CaseCleanup, CaseIdentity, CaseOutcome, CaseReport, FailureCase, PhaseTwoGate,
    },
};
use std::{
    env, fs,
    path::Path,
    process::{Command, Stdio},
    thread,
    time::Duration,
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
    let phase_end = base
        .control
        .run
        .epoch()
        .saturating_sub(FINAL_RESERVE_MS)
        .min(
            runtime_budget::now_ms()
                .map_err(|_| "clock unavailable")?
                .saturating_add(PHASE_TWO_MS),
        );
    let phase =
        Deadline::at(phase_end, PHASE_TWO_MS).map_err(|_| "phase two budget unavailable")?;
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
                launch_identity: launch,
                generation,
                operation_attempt: slot,
                udf_volume: None,
                udf_file: None,
            },
            outcome: CaseOutcome::NotRun,
            cleanup: CaseCleanup::NotRun,
            native_creation_attempted: Some(false),
            contains_sensitive_data: false,
            terminal_reason: None,
            evidence_complete: false,
        };
        if stop_requested(base) || phase.expired() || base.control.run.expired() {
            report.terminal_reason = Some(if stop_requested(base) {
                TerminalReason::Cancelled
            } else {
                TerminalReason::Timeout
            });
            gate.record(CaseOutcome::UnexpectedFailure, CaseCleanup::Unknown);
        }
        if let Some(result) = gate.try_run(|| launch_case(base, &receipt, &mut report, &phase)) {
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
                "schema":2,"sourceSha":crate::runtime_guard::SOURCE_SHA,"controllerSha":controller,
                "runId":run_id,"attempt":1,"phaseOneResult":"PASS","phaseTwoStarted":true,
                "phaseTwoResult":crate::runtime_evidence::phase_two_result(&reports),
            "expectedRejectionsPass":crate::runtime_outcome::expected_rejections_pass(&reports),
                "cases":reports,"containsSensitiveData":false
            }),
        )
        .map_err(|_| "cannot record phase two summary")?;
    }
    let result = crate::runtime_evidence::phase_two_result(&reports);
    write_json(&base.diagnostics.join("runtime-summary.json"), &serde_json::json!({
        "schema":2,"sourceSha":crate::runtime_guard::SOURCE_SHA,"controllerSha":controller,
        "runId":run_id,"attempt":1,"phaseOneComplete":true,"phaseTwoStarted":true,
        "phaseOneResult":"PASS","phaseTwoResult":result,"runtimeCleanupPass":false,
        "expectedRejectionsPass":crate::runtime_outcome::expected_rejections_pass(&reports),
        "intentionalCleanupUnknownObserved":result == crate::runtime_evidence::PhaseTwoResult::IntentionalCleanupUnknownObserved,
        "terminalReason":reports.iter().find_map(|r| r.terminal_reason),
        "evidenceState":if reports.iter().all(|r|r.evidence_complete){"COMPLETE"}else{"INCOMPLETE"},
        "containsSensitiveData":false
    })).map_err(|_| "final summary write failed")?;
    // The terminal injected Unknown is observed, never promoted to runtime cleanup PASS.
    Err("phase two ended; inspect separate rejection and cleanup outcomes".into())
}

fn stop_requested(base: &RuntimeCase<'_>) -> bool {
    base.control.cancellation.try_exists().unwrap_or(true)
}

fn launch_case(
    base: &RuntimeCase<'_>,
    receipt: &Path,
    expected: &mut CaseReport,
    phase: &Deadline,
) -> Result<CaseReport, String> {
    let case_id = expected.case_id;
    let diagnostics = base.diagnostics.join(case_id.id());
    let udf = base.udf.with_file_name(format!(
        "c2d2-{}-{}",
        expected.identity.launch_identity,
        case_id.id()
    ));
    fs::create_dir(&diagnostics).map_err(|_| "case diagnostics already exist or unavailable")?;
    if udf.exists() {
        return Err("case UDF already exists".into());
    }
    let case_end = runtime_budget::now_ms()
        .map_err(|_| "clock unavailable")?
        .saturating_add(CASE_MS)
        .min(phase.epoch());
    let work = Deadline::at(case_end.saturating_sub(8_000), CASE_MS)
        .map_err(|_| "case work budget unavailable")?;
    let drain = Deadline::at(
        case_end.saturating_sub(runtime_budget::PARENT_EVIDENCE_MS),
        CASE_MS,
    )
    .map_err(|_| "case drain budget unavailable")?;
    let mut child = Command::new(env::current_exe().map_err(|_| "cannot identify harness")?)
        .arg("--failure-case")
        .arg(case_id.id())
        .env("C2D2_UDF", &udf)
        .env("C2D2_DIAGNOSTICS", &diagnostics)
        .env("C2D2_PHASE1_RECEIPT", receipt)
        .env("C2D2_RUN_END_MS", base.control.run.epoch().to_string())
        .env("C2D2_CASE_END_MS", drain.epoch().to_string())
        .env("C2D2_CANCEL_PATH", base.control.cancellation)
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
    expected.identity.host_process_id = child.id();
    expected.native_creation_attempted = None;
    let status = runtime_budget::observe(
        || child.try_wait().map_err(|_| ()),
        || {
            if stop_requested(base) {
                Duration::ZERO
            } else {
                work.remaining().min(base.control.run.remaining())
            }
        },
        thread::sleep,
    );
    let status = match status {
        Ok(status) => status,
        Err(reason) => {
            expected.terminal_reason = Some(if stop_requested(base) {
                TerminalReason::Cancelled
            } else {
                reason
            });
            expected.outcome = CaseOutcome::UnexpectedFailure;
            expected.cleanup = CaseCleanup::Unknown;
            // Cooperative cancellation is durable and closes every later case. Do not kill.
            if !stop_requested(base) {
                let _ = write_json(
                    base.control.cancellation,
                    &serde_json::json!({"reason":reason}),
                );
            }
            let _ = write_json(&diagnostics.join("cleanup-unknown.json"), expected);
            // Only bounded observation of the SAME child; never child.wait()/kill()/retry().

            let _ = runtime_budget::observe(
                || child.try_wait().map_err(|_| ()),
                || drain.remaining().min(base.control.run.remaining()),
                thread::sleep,
            );
            return Err("case cancelled or expired; cleanup remains unknown".into());
        }
    };
    if drain.expired() {
        return Err("case evidence deadline expired".into());
    }
    let path = diagnostics.join("case-report.json");
    if fs::metadata(&path).map_err(|_| "case report absent")?.len() > MAX_REPORT {
        return Err("case report exceeds bound".into());
    }
    let report: CaseReport =
        serde_json::from_slice(&fs::read(path).map_err(|_| "case report unreadable")?)
            .map_err(|_| "case report invalid")?;
    let mut identity = expected.identity.clone();
    let observed = crate::runtime_identity::directory_identity(&udf)
        .map_err(|_| "case UDF identity unavailable")?;
    identity.udf_volume = Some(observed.volume);
    identity.udf_file = Some(format!("{:032x}", observed.file));
    if !report.matches_result(&identity, case_id, status.success()) {
        return Err("case result mismatch".into());
    }
    Ok(report)
}
