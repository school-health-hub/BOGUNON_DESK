mod child;
mod support;
use support::{close_controller, expire_budget, ownership_event, wait_for, write_json};
pub mod failure;
pub mod suite;

use std::{fs::create_dir_all, path::Path, time::Duration};

use serde::Serialize;
use thiserror::Error;

use crate::{
    browser_exit::BrowserExitSubscription,
    cleanup::{self, BrowserExitEvidence, RuntimeIdentity},
    lifecycle::Attempt,
    native_window::OwnedWindow,
    ownership::Ledger,
    runtime_identity::directory_identity,
    udf::{self, DirectoryObservation},
    windows_host::{
        observe_runtime, ControllerRequest, EnvironmentRequest, HostError, RuntimeBinding, StaGuard,
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
    run_with_fault(case, None)
}

fn run_with_fault(
    case: &RuntimeCase<'_>,
    fault: Option<crate::runtime_evidence::FailureCase>,
) -> Result<(), RuntimeQaError> {
    use crate::runtime_evidence::FailureCase;
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
    ownership_event(case, "Host", "acquire")?;
    crate::runtime_evidence::admit_factory(
        fault,
        crate::runtime_evidence::CreationStage::Environment,
    )
    .map_err(|_| RuntimeQaError::Identity)?;
    let sta = StaGuard::initialize()?;
    let window = OwnedWindow::create_hidden().map_err(HostError::Com)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::Window, 2)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Window", "acquire")?;
    let environment_request = EnvironmentRequest::begin(&sta, case.udf, binding)?;
    if fault == Some(FailureCase::EnvironmentDeadline) {
        expire_budget(|| environment_request.try_complete())?;
        // Drain the SAME request below, not a retry.
        support::timeline_event(
            case,
            &serde_json::json!({"stage":"environment-deadline","expected":true}),
        )?;
    }
    let environment = wait_for(case.timeout, || environment_request.try_complete())?;
    drop(environment_request);
    ledger
        .acquire(attempt, crate::ownership::Resource::Environment, 3)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Environment", "acquire")?;
    if environment.binding != binding {
        return Err(RuntimeQaError::Identity);
    }
    let browser_exit = BrowserExitSubscription::subscribe(&environment.environment, binding)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::EventToken, 4)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "EventToken", "acquire")?;
    let mut cancel_state = crate::lifecycle::Lifecycle::new(attempt);
    for phase in [
        crate::lifecycle::Phase::CreatingWindow,
        crate::lifecycle::Phase::CreatingEnvironment,
        crate::lifecycle::Phase::EnvironmentObserved,
        crate::lifecycle::Phase::CreatingController,
    ] {
        cancel_state
            .transition(attempt, phase)
            .map_err(|_| RuntimeQaError::Identity)?;
    }
    crate::runtime_evidence::admit_factory(
        fault,
        crate::runtime_evidence::CreationStage::Controller,
    )
    .map_err(|_| RuntimeQaError::Identity)?;
    let controller_request =
        ControllerRequest::begin(&environment.environment, window.hwnd(), binding)?;
    if fault == Some(FailureCase::CancelBeforeController) {
        cancel_state
            .transition(attempt, crate::lifecycle::Phase::Retiring)
            .map_err(|_| RuntimeQaError::Identity)?;
    }
    if matches!(
        fault,
        Some(FailureCase::ControllerDeadline | FailureCase::CancelBeforeController)
    ) {
        expire_budget(|| controller_request.try_complete())?;
        // Cancellation closes admission before callback retrieval. No new request/retry.
        support::timeline_event(
            case,
            &serde_json::json!({"stage":fault,"admissionOpen":false}),
        )?;
    }
    let controller = wait_for(case.timeout, || controller_request.try_complete())?;
    drop(controller_request);
    if fault == Some(FailureCase::CancelBeforeController)
        && cancel_state
            .transition(attempt, crate::lifecycle::Phase::Quarantined)
            .is_ok()
    {
        return Err(RuntimeQaError::Identity);
    }
    ledger
        .acquire(attempt, crate::ownership::Resource::Controller, 5)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Controller", "acquire")?;
    if controller.binding != binding {
        return Err(RuntimeQaError::Identity);
    }
    let observation = observe_runtime(&environment.environment, &controller.controller)?;
    ledger
        .acquire(attempt, crate::ownership::Resource::WebView, 6)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "WebView", "acquire")?;
    ledger
        .release(attempt, crate::ownership::Resource::WebView, 6)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "WebView", "release")?;
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
    failure::held_resource_probe(
        case,
        fault,
        &environment,
        &RuntimeIdentity {
            attempt,
            environment: case.generation,
            browser_process_id: observation.browser_process_id,
            effective_udf: effective.identity.clone(),
        },
    )?;
    close_controller(&controller.controller)?;
    drop(controller);
    ledger
        .release(attempt, crate::ownership::Resource::Controller, 5)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Controller", "release")?;
    if fault.is_some() {
        window.destroy().map_err(HostError::Com)?;
    } else {
        drop(window);
    }
    ledger
        .release(attempt, crate::ownership::Resource::Window, 2)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Window", "release")?;
    if fault == Some(FailureCase::MissingBrowserExit) {
        expire_budget(|| browser_exit.try_observe())?;
    }
    let exit = wait_for(case.timeout, || browser_exit.try_observe())?;
    if exit.binding != binding || exit.browser_process_id != observation.browser_process_id {
        return Err(RuntimeQaError::Identity);
    }
    if fault.is_some() {
        browser_exit.unsubscribe()?;
    } else {
        drop(browser_exit);
    }
    ledger
        .release(attempt, crate::ownership::Resource::EventToken, 4)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "EventToken", "release")?;
    drop(environment);
    ledger
        .release(attempt, crate::ownership::Resource::Environment, 3)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Environment", "release")?;
    drop(sta);
    ledger
        .release(attempt, crate::ownership::Resource::Host, 1)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Host", "release")?;
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
    let accepted_exit = if fault == Some(FailureCase::MissingBrowserExit) {
        None
    } else {
        Some(&exit)
    };
    // The fault expires the receipt observer budget. The real exit was still drained to
    // avoid abandoning resources; a late observation cannot repair the expired case.
    cleanup::evaluate(false, &ledger, &runtime, accepted_exit).map_err(RuntimeQaError::Cleanup)?;
    support::write_completion(case, fault)
}
