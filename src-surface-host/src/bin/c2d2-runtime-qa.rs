#[cfg(not(windows))]
compile_error!("C-2D-2 runtime QA is Windows-only");

use std::{env, fs, path::PathBuf};

use bogunon_desktop_surface_host::runtime_budget::{
    now_ms, RuntimeControl, CHILD_CLEANUP_MS, CHILD_EVIDENCE_MS, PHASE_ONE_MS, RUN_MS,
};
use bogunon_desktop_surface_host::{
    runtime_guard::{authorize, Authorization},
    runtime_qa::{run_normal, suite, RuntimeCase},
};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preflight {
    overrides_clear: bool,
    policies_readable: bool,
    policies_clear: bool,
    runtime_installed: bool,
    runtime_version: String,
}

fn required(name: &str) -> Result<String, String> {
    env::var(name).map_err(|_| format!("required runtime identity is absent: {name}"))
}

fn main() {
    if let Err(error) = execute() {
        let _ = error;
        eprintln!("C-2D-2 runtime QA did not complete; inspect validated diagnostics");
        std::process::exit(1);
    }
}

fn execute() -> Result<(), String> {
    let repository = required("GITHUB_REPOSITORY")?;
    let event = required("GITHUB_EVENT_NAME")?;
    let workflow_ref = required("GITHUB_WORKFLOW_REF")?;
    let git_ref = required("GITHUB_REF")?;
    let controller_sha = required("GITHUB_SHA")?;
    let expected_controller_sha = required("EXPECTED_CONTROLLER_SHA")?;
    let run_id = required("GITHUB_RUN_ID")?;
    let workflow_sha = required("C2D2_WORKFLOW_SHA")?;
    let attempt = required("GITHUB_RUN_ATTEMPT")?;
    let runner_os = required("RUNNER_OS")?;
    let approval_nonce = required("C2D2_APPROVAL_NONCE")?;
    let runner_temp = PathBuf::from(required("RUNNER_TEMP")?);
    let requested_udf = PathBuf::from(required("C2D2_UDF")?);
    let diagnostics = PathBuf::from(required("C2D2_DIAGNOSTICS")?);
    let preflight_path = PathBuf::from(required("C2D2_PREFLIGHT_PATH")?);
    let preflight: Preflight =
        serde_json::from_slice(&fs::read(preflight_path).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
    authorize(&Authorization {
        repository: &repository,
        event: &event,
        workflow_ref: &workflow_ref,
        git_ref: &git_ref,
        controller_sha: &controller_sha,
        expected_controller_sha: &expected_controller_sha,
        run_id: &run_id,
        attempt: &attempt,
        runner_os: &runner_os,
        approval_nonce: &approval_nonce,
        requested_udf: &requested_udf,
        runner_temp: &runner_temp,
        overrides_clear: preflight.overrides_clear,
        policies_readable_and_clear: preflight.policies_readable && preflight.policies_clear,
    })
    .map_err(|error| error.to_string())?;
    if !preflight.runtime_installed {
        return Err("WebView2 Runtime was not detected".into());
    }
    let generation = run_id.parse::<u64>().map_err(|_| "invalid run id")?;
    let nonce = approval_nonce.bytes().take(8).fold(0_u64, |value, byte| {
        value.wrapping_mul(257).wrapping_add(byte as u64)
    });
    let args: Vec<String> = env::args().skip(1).collect();
    let now = now_ms().map_err(|_| "clock unavailable")?;
    let (run_end, case_end, cleanup_ms, evidence_ms, cancellation) = if args.is_empty() {
        (
            now.checked_add(RUN_MS).ok_or("deadline overflow")?,
            now.checked_add(PHASE_ONE_MS).ok_or("deadline overflow")?,
            12_000,
            3_000,
            diagnostics.join("cancellation-request.json"),
        )
    } else {
        (
            required("C2D2_RUN_END_MS")?
                .parse()
                .map_err(|_| "invalid run deadline")?,
            required("C2D2_CASE_END_MS")?
                .parse()
                .map_err(|_| "invalid case deadline")?,
            CHILD_CLEANUP_MS,
            CHILD_EVIDENCE_MS,
            PathBuf::from(required("C2D2_CANCEL_PATH")?),
        )
    };
    if !cancellation.starts_with(&runner_temp) {
        return Err("cancellation boundary invalid".into());
    }
    let control = RuntimeControl::new(run_end, case_end, cleanup_ms, evidence_ms, &cancellation)
        .map_err(|_| "invalid runtime budget")?;
    let case = RuntimeCase {
        udf: &requested_udf,
        diagnostics: &diagnostics,
        generation,
        run_nonce: nonce.max(1),
        runtime_version: &preflight.runtime_version,
        control: &control,
    };
    if !args.is_empty() {
        return suite::child(&case, &controller_sha, &run_id, &args);
    }
    fs::create_dir_all(&diagnostics).map_err(|_| "diagnostics unavailable")?;
    let initial = serde_json::json!({"schema":2,"phaseOneResult":"NOT_RUN","phaseTwoResult":"NOT_RUN",
        "evidenceState":"INCOMPLETE","runtimeCleanupPass":false,"containsSensitiveData":false});
    fs::write(
        diagnostics.join("runtime-summary.json"),
        serde_json::to_vec(&initial).map_err(|_| "summary unavailable")?,
    )
    .map_err(|_| "summary unavailable")?;
    let result = run_normal(&case);
    match result {
        Ok(()) => {
            let summary = serde_json::json!({
                "schema": 1,
                "sourceSha": bogunon_desktop_surface_host::runtime_guard::SOURCE_SHA,
                "controllerSha": controller_sha,
                "workflowSha": workflow_sha,
                "runId": run_id,
                "attempt": 1,
                "generation": generation,
                "result": "PASS",
                "phaseOneComplete": true,
                "phaseTwoStarted": false,
                "phaseOneResult":"PASS","phaseTwoResult":"NOT_RUN","evidenceState":"INCOMPLETE",
                "runtimeCleanupPass":false,
                "containsSensitiveData": false
            });
            fs::write(
                diagnostics.join("runtime-summary.json"),
                format!(
                    "{}\n",
                    serde_json::to_string_pretty(&summary).map_err(|error| error.to_string())?
                ),
            )
            .map_err(|error| error.to_string())?;
            let result = suite::run(&case, &controller_sha, &run_id);
            if result.is_err() {
                let mut summary: serde_json::Value =
                    fs::read(diagnostics.join("runtime-summary.json"))
                        .ok()
                        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                        .unwrap_or(serde_json::Value::Null);
                if summary["evidenceState"] != "COMPLETE" {
                    let recorded_reason =
                        serde_json::from_value(summary["terminalReason"].clone()).ok();
                    let terminal_reason =
                        bogunon_desktop_surface_host::runtime_budget::preserve_terminal_reason(
                            recorded_reason,
                            control.reason(),
                        );
                    summary = serde_json::json!({"schema":2,"sourceSha":bogunon_desktop_surface_host::runtime_guard::SOURCE_SHA,
                        "controllerSha":controller_sha,"runId":run_id,"attempt":1,"phaseOneResult":"PASS",
                        "phaseTwoResult":"EVIDENCE_INCOMPLETE","phaseTwoStarted":true,"evidenceState":"INCOMPLETE",
                        "terminalReason":terminal_reason,
                        "runtimeCleanupPass":false,"containsSensitiveData":false});
                    fs::write(
                        diagnostics.join("runtime-summary.json"),
                        serde_json::to_vec(&summary).map_err(|_| "summary unavailable")?,
                    )
                    .map_err(|_| "summary unavailable")?;
                }
            }
            result
        }
        Err(error) => {
            // Preserve typed terminal failures even if a synchronous teardown crossed the evidence deadline.
            control.stop(match &error {
                bogunon_desktop_surface_host::runtime_qa::RuntimeQaError::Cancelled => {
                    bogunon_desktop_surface_host::runtime_budget::TerminalReason::Cancelled
                }
                bogunon_desktop_surface_host::runtime_qa::RuntimeQaError::Timeout => {
                    bogunon_desktop_surface_host::runtime_budget::TerminalReason::Timeout
                }
                _ => bogunon_desktop_surface_host::runtime_budget::TerminalReason::HarnessFailure,
            });
            let unknown = serde_json::json!({
                "schema": 2,
                "result": "CLEANUP_UNKNOWN",
                "stage": "phase-one",
                "phaseOneResult":"NOT_PASS","phaseTwoResult":"NOT_RUN",
                "terminalReason":control.reason().unwrap_or(bogunon_desktop_surface_host::runtime_budget::TerminalReason::HarnessFailure), "evidenceState":"INCOMPLETE",
                "containsSensitiveData": false
            });
            let _ = fs::create_dir_all(&diagnostics);
            if let Ok(text) = serde_json::to_string_pretty(&unknown) {
                let _ = fs::write(diagnostics.join("runtime-summary.json"), text.as_bytes());
                let _ = fs::write(
                    diagnostics.join("cleanup-unknown.json"),
                    format!("{text}\n"),
                );
            }
            Err(error.to_string())
        }
    }
}
