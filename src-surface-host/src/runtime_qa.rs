use std::{
    fs::{create_dir_all, File},
    io::Write,
    path::Path,
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use thiserror::Error;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;

use crate::{
    browser_exit::BrowserExitSubscription,
    cleanup::{self, BrowserExitEvidence, RuntimeIdentity},
    lifecycle::Attempt,
    native_window::OwnedWindow,
    ownership::Ledger,
    runtime_identity::directory_identity,
    udf::{self, DirectoryObservation},
    windows_host::{
        observe_runtime, pump_pending, ControllerRequest, EnvironmentRequest, HostError,
        RuntimeBinding, StaGuard,
    },
};

#[derive(Debug, Error)]
pub enum RuntimeQaError {
    #[error("host failed: {0}")]
    Host(#[from] HostError),
    #[error("runtime stage timed out")]
    Timeout,
    #[error("UDF verification failed: {0}")]
    Udf(#[from] udf::UdfError),
    #[error("cleanup receipt was not issued: {0:?}")]
    Cleanup(cleanup::CleanupUnknown),
    #[error("diagnostic write failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("diagnostic serialization failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("runtime binding or process identity did not match")]
    Identity,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UdfEvidence<'a> {
    schema: u8,
    requested_under_runner_temp: bool,
    effective_matches_requested: bool,
    profile_under_effective_udf: bool,
    directory_identity_matches: bool,
    runtime_version: &'a str,
    contains_sensitive_data: bool,
}

pub struct RuntimeCase<'a> {
    pub udf: &'a Path,
    pub diagnostics: &'a Path,
    pub generation: u64,
    pub run_nonce: u64,
    pub runtime_version: &'a str,
    pub timeout: Duration,
}

pub fn run_normal(case: &RuntimeCase<'_>) -> Result<(), RuntimeQaError> {
    create_dir_all(case.udf)?;
    create_dir_all(case.diagnostics)?;
    let canonical_requested = std::fs::canonicalize(case.udf)?;
    let requested = DirectoryObservation {
        path: canonical_requested,
        identity: directory_identity(case.udf)?,
    };
    let attempt = Attempt::new(case.generation, case.run_nonce).ok_or(RuntimeQaError::Identity)?;
    let binding = RuntimeBinding {
        generation: case.generation,
        attempt: case.run_nonce,
    };
    let mut ledger = Ledger::new(attempt);
    ledger
        .acquire(attempt, crate::ownership::Resource::Host, 1)
        .map_err(|_| RuntimeQaError::Identity)?;
    let sta = StaGuard::initialize()?;
    let window = OwnedWindow::create_hidden().map_err(HostError::Com)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::Window, 2)
        .map_err(|_| RuntimeQaError::Identity)?;
    let environment_request = EnvironmentRequest::begin(&sta, case.udf, binding)?;
    let environment = wait_for(case.timeout, || environment_request.try_complete())?;
    ledger
        .acquire(attempt, crate::ownership::Resource::Environment, 3)
        .map_err(|_| RuntimeQaError::Identity)?;
    if environment.binding != binding {
        return Err(RuntimeQaError::Identity);
    }
    let browser_exit = BrowserExitSubscription::subscribe(&environment.environment, binding)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::EventToken, 4)
        .map_err(|_| RuntimeQaError::Identity)?;
    let controller_request =
        ControllerRequest::begin(&environment.environment, window.hwnd(), binding)?;
    let controller = wait_for(case.timeout, || controller_request.try_complete())?;
    ledger
        .acquire(attempt, crate::ownership::Resource::Controller, 5)
        .map_err(|_| RuntimeQaError::Identity)?;
    if controller.binding != binding {
        return Err(RuntimeQaError::Identity);
    }
    let observation = observe_runtime(&environment.environment, &controller.controller)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::WebView, 6)
        .map_err(|_| RuntimeQaError::Identity)?;
    ledger
        .release(attempt, crate::ownership::Resource::WebView, 6)
        .map_err(|_| RuntimeQaError::Identity)?;
    let effective = DirectoryObservation {
        path: std::fs::canonicalize(&observation.effective_udf)?,
        identity: directory_identity(&observation.effective_udf)?,
    };
    udf::verify_effective(&requested, &effective, &observation.profile_path)?;
    write_json(
        &case.diagnostics.join("udf-observation.json"),
        &UdfEvidence {
            schema: 1,
            requested_under_runner_temp: true,
            effective_matches_requested: true,
            profile_under_effective_udf: true,
            directory_identity_matches: true,
            runtime_version: case.runtime_version,
            contains_sensitive_data: false,
        },
    )?;
    close_controller(&controller.controller)?;
    drop(controller);
    ledger
        .release(attempt, crate::ownership::Resource::Controller, 5)
        .map_err(|_| RuntimeQaError::Identity)?;
    drop(window);
    ledger
        .release(attempt, crate::ownership::Resource::Window, 2)
        .map_err(|_| RuntimeQaError::Identity)?;
    let exit = wait_for(case.timeout, || browser_exit.try_observe())?;
    if exit.binding != binding || exit.browser_process_id != observation.browser_process_id {
        return Err(RuntimeQaError::Identity);
    }
    drop(browser_exit);
    ledger
        .release(attempt, crate::ownership::Resource::EventToken, 4)
        .map_err(|_| RuntimeQaError::Identity)?;
    drop(environment);
    ledger
        .release(attempt, crate::ownership::Resource::Environment, 3)
        .map_err(|_| RuntimeQaError::Identity)?;
    drop(sta);
    ledger
        .release(attempt, crate::ownership::Resource::Host, 1)
        .map_err(|_| RuntimeQaError::Identity)?;
    let runtime = RuntimeIdentity {
        attempt,
        environment: case.generation,
        browser_process_id: observation.browser_process_id,
        effective_udf: effective.identity,
    };
    let exit = BrowserExitEvidence {
        attempt,
        environment: case.generation,
        browser_process_id: exit.browser_process_id,
        normal_exit: exit.normal,
    };
    cleanup::evaluate(false, &ledger, &runtime, Some(&exit)).map_err(RuntimeQaError::Cleanup)?;
    write_json(
        &case.diagnostics.join("cleanup-receipt.json"),
        &serde_json::json!({
            "schema": 1,
            "result": "PASS",
            "generation": case.generation,
            "containsSensitiveData": false
        }),
    )?;
    write_json(
        &case.diagnostics.join("ownership-ledger.json"),
        &serde_json::json!({
            "schema": 1,
            "result": "RESOLVED",
            "generation": case.generation,
            "containsSensitiveData": false
        }),
    )?;
    write_json(
        &case.diagnostics.join("runtime-summary.json"),
        &serde_json::json!({
            "schema": 1,
            "result": "PASS",
            "phaseOneComplete": true,
            "phaseTwoStarted": false,
            "generation": case.generation,
            "containsSensitiveData": false
        }),
    )?;
    let mut timeline = File::create(case.diagnostics.join("timeline.jsonl"))?;
    timeline.write_all(
        b"{\"stage\":\"phase-one\",\"result\":\"PASS\",\"containsSensitiveData\":false}\n",
    )?;
    Ok(())
}

fn wait_for<T>(
    timeout: Duration,
    mut poll: impl FnMut() -> Result<Option<T>, HostError>,
) -> Result<T, RuntimeQaError> {
    let deadline = Instant::now() + timeout;
    loop {
        let _ = pump_pending()?;
        if let Some(value) = poll()? {
            return Ok(value);
        }
        if Instant::now() >= deadline {
            return Err(RuntimeQaError::Timeout);
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn close_controller(controller: &ICoreWebView2Controller) -> Result<(), RuntimeQaError> {
    // SAFETY: the controller is live, belongs to this STA, and is closed exactly once here.
    unsafe { controller.Close() }.map_err(HostError::Com)?;
    Ok(())
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<(), RuntimeQaError> {
    let mut file = File::create(path)?;
    serde_json::to_writer_pretty(&mut file, value)?;
    file.write_all(b"\n")?;
    Ok(())
}
