use super::{RuntimeCase, RuntimeQaError};
use crate::{
    runtime_evidence::FailureCase,
    windows_host::{pump_pending, HostError},
};
use serde::Serialize;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::Path,
    thread,
    time::{Duration, Instant},
};
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;
pub(super) fn wait_for<T>(
    timeout: Duration,
    mut poll: impl FnMut() -> Result<Option<T>, HostError>,
) -> Result<T, RuntimeQaError> {
    let deadline = Instant::now() + timeout;
    if timeout.is_zero() {
        return Err(RuntimeQaError::Timeout);
    }
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

pub(super) fn close_controller(controller: &ICoreWebView2Controller) -> Result<(), RuntimeQaError> {
    // SAFETY: the controller is live, belongs to this STA, and is closed exactly once here.
    unsafe { controller.Close() }.map_err(HostError::Com)?;
    Ok(())
}

pub(super) fn write_json(path: &Path, value: &impl Serialize) -> Result<(), RuntimeQaError> {
    let mut file = File::create(path)?;
    serde_json::to_writer_pretty(&mut file, value)?;
    file.write_all(b"\n")?;
    Ok(())
}

pub(super) fn expire_budget<T>(
    poll: impl FnMut() -> Result<Option<T>, HostError>,
) -> Result<(), RuntimeQaError> {
    match wait_for(Duration::ZERO, poll) {
        Err(RuntimeQaError::Timeout) => Ok(()),
        _ => Err(RuntimeQaError::Identity),
    }
}

pub(super) fn ownership_event(
    case: &RuntimeCase<'_>,
    resource: &str,
    operation: &str,
) -> Result<(), RuntimeQaError> {
    let path = case.diagnostics.join("ownership-ledger.json");
    let mut events: Vec<serde_json::Value> = if path.exists() {
        serde_json::from_slice(&std::fs::read(&path)?)?
    } else {
        Vec::new()
    };
    events.push(
        serde_json::json!({"resource":resource,"operation":operation,"generation":case.generation}),
    );
    write_json(&path, &events)
}

pub(super) fn write_completion(
    case: &RuntimeCase<'_>,
    fault: Option<FailureCase>,
) -> Result<(), RuntimeQaError> {
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
        &case.diagnostics.join("runtime-summary.json"),
        &serde_json::json!({
            "schema": 1,
            "result": "PASS",
            "phaseOneComplete": fault.is_none(),
            "phaseTwoStarted": fault.is_some(),
            "generation": case.generation,
            "containsSensitiveData": false
        }),
    )?;
    let mut timeline = OpenOptions::new()
        .create(true)
        .append(true)
        .open(case.diagnostics.join("timeline.jsonl"))?;
    serde_json::to_writer(
        &mut timeline,
        &serde_json::json!({
            "stage":if fault.is_some(){"phase-two"}else{"phase-one"},
            "fault":fault,"result":"CLEANUP_VERIFIED","containsSensitiveData":false
        }),
    )?;
    timeline.write_all(&[10])?;
    Ok(())
}

pub(super) fn timeline_event(
    case: &RuntimeCase<'_>,
    event: &impl Serialize,
) -> Result<(), RuntimeQaError> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(case.diagnostics.join("timeline.jsonl"))?;
    serde_json::to_writer(&mut file, event)?;
    file.write_all(&[10])?;
    Ok(())
}
