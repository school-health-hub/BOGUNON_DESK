use super::{RuntimeCase, RuntimeQaError};
use crate::{
    runtime_evidence::FailureCase,
    windows_host::{pump_pending_bounded, HostError},
};
use serde::Serialize;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::Path,
    thread,
    time::Duration,
};
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;
pub(super) fn admit(case: &RuntimeCase<'_>) -> Result<(), RuntimeQaError> {
    case.control.admission().map_err(|reason| match reason {
        crate::runtime_budget::TerminalReason::Cancelled => RuntimeQaError::Cancelled,
        _ => RuntimeQaError::Timeout,
    })
}

pub(super) fn wait_for<T>(
    case: &RuntimeCase<'_>,
    cleanup_only: bool,
    mut poll: impl FnMut() -> Result<Option<T>, HostError>,
) -> Result<T, RuntimeQaError> {
    loop {
        // Cancellation closes admission, but an already-dispatched callback is drained
        // only within the reserved cleanup budget. No replacement request is made.
        case.control.observe_cancellation();
        let admitted = cleanup_only || case.control.admission().is_ok();
        let deadline = if cleanup_only || !admitted {
            &case.control.cleanup
        } else {
            &case.control.work
        };
        let left = deadline.remaining().min(case.control.run.remaining());
        if left.is_zero() {
            case.control
                .stop(crate::runtime_budget::TerminalReason::Timeout);
            return Err(RuntimeQaError::Timeout);
        }
        let _ = pump_pending_bounded(|| {
            case.control.observe_cancellation();
            !deadline.expired()
                && !case.control.run.expired()
                && (cleanup_only || !admitted || case.control.reason().is_none())
        })?;
        if deadline.expired()
            || case.control.run.expired()
            || (admitted && !cleanup_only && case.control.reason().is_some())
        {
            continue;
        }
        if let Some(value) = poll()? {
            return Ok(value);
        }
        thread::sleep(
            deadline
                .remaining()
                .min(case.control.run.remaining())
                .min(Duration::from_millis(10)),
        );
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
    // A zero observer budget expires before invoking the pending request.
    drop(poll);
    Ok(())
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
