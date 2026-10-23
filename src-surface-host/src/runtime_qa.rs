mod types;
use types::UdfEvidence;
pub use types::{RuntimeCase, RuntimeQaError};
mod child;
mod support;
use support::{close_controller, expire_budget, ownership_event, wait_for, write_json};
pub mod failure;
pub mod suite;

use std::{cell::Cell, fs::create_dir_all, rc::Rc};

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

pub(crate) struct RuntimeLaunchAuthority {
    claimed: Cell<bool>,
    identity: Rc<()>,
}

impl RuntimeLaunchAuthority {
    fn new() -> Self {
        Self {
            claimed: Cell::new(false),
            identity: Rc::new(()),
        }
    }

    pub(crate) fn claim(&self) -> Result<Rc<()>, crate::ownership::OwnershipError> {
        if self.claimed.replace(true) {
            return Err(crate::ownership::OwnershipError::AlreadyRecorded);
        }
        Ok(Rc::clone(&self.identity))
    }

    #[cfg(test)]
    pub(crate) fn for_test() -> Self {
        Self::new()
    }
}

pub fn run_normal(case: &RuntimeCase<'_>) -> Result<(), RuntimeQaError> {
    run_with_fault(case, None)
}

fn run_with_fault(
    case: &RuntimeCase<'_>,
    fault: Option<crate::runtime_evidence::FailureCase>,
) -> Result<(), RuntimeQaError> {
    use crate::runtime_evidence::FailureCase;
    support::admit(case)?;
    create_dir_all(case.udf)?;
    create_dir_all(case.diagnostics)?;
    let canonical_requested = std::fs::canonicalize(case.udf)?;
    let requested = DirectoryObservation {
        path: canonical_requested,
        identity: directory_identity(case.udf)?,
    };
    let attempt = Attempt::new(case.generation, case.run_nonce).ok_or(RuntimeQaError::Identity)?;
    let launch = RuntimeLaunchAuthority::new();
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
    support::admit(case)?;
    let environment_request = EnvironmentRequest::begin(&sta, case.udf, binding)?;
    if fault == Some(FailureCase::EnvironmentDeadline) {
        expire_budget(|| environment_request.try_complete())?;
        // Drain the SAME request below, not a retry.
        support::timeline_event(
            case,
            &serde_json::json!({"stage":"environment-deadline","expected":true}),
        )?;
    }
    let environment = wait_for(case, false, || environment_request.try_complete())?;
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
    support::admit(case)?;
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
    let controller = wait_for(case, false, || controller_request.try_complete())?;
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
    let runtime = RuntimeIdentity::bind(
        &mut ledger,
        &launch,
        attempt,
        case.generation,
        observation.browser_process_id,
        effective.identity.clone(),
    )
    .map_err(|_| RuntimeQaError::Identity)?;
    failure::held_resource_probe(case, fault, &environment, &runtime)?;
    let _ = case.control.admission();
    close_controller(&controller.controller)?;
    drop(controller);
    ledger
        .release(attempt, crate::ownership::Resource::Controller, 5)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Controller", "release")?;
    if let Err(error) = window.destroy() {
        ledger
            .quarantine_release(attempt, crate::ownership::Resource::Window, 2)
            .map_err(|_| RuntimeQaError::Identity)?;
        ownership_event(case, "Window", "release-unconfirmed")?;
        support::timeline_event(
            case,
            &serde_json::json!({"stage":"cleanup","resource":"Window","result":"CLEANUP_UNKNOWN"}),
        )?;
        return Err(HostError::Com(error).into());
    }
    ledger
        .release(attempt, crate::ownership::Resource::Window, 2)
        .map_err(|_| RuntimeQaError::Identity)?;
    ownership_event(case, "Window", "release")?;
    if fault == Some(FailureCase::MissingBrowserExit) {
        expire_budget(|| browser_exit.try_observe())?;
    }
    let exit = wait_for(case, true, || browser_exit.try_observe())?;
    if exit.binding != binding || exit.browser_process_id != observation.browser_process_id {
        return Err(RuntimeQaError::Identity);
    }
    if let Err(error) = browser_exit.unsubscribe() {
        ledger
            .quarantine_release(attempt, crate::ownership::Resource::EventToken, 4)
            .map_err(|_| RuntimeQaError::Identity)?;
        ownership_event(case, "EventToken", "release-unconfirmed")?;
        support::timeline_event(
            case,
            &serde_json::json!({"stage":"cleanup","resource":"EventToken","result":"CLEANUP_UNKNOWN"}),
        )?;
        return Err(error.into());
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
    let exit = BrowserExitEvidence {
        attempt,
        environment: case.generation,
        browser_process_id: exit.browser_process_id,
        normal_exit: exit.normal,
    };
    let accepted_exit = (fault != Some(FailureCase::MissingBrowserExit)).then_some(&exit);
    // The fault expires the receipt observer budget. The real exit was still drained to
    // avoid abandoning resources; a late observation cannot repair the expired case.
    cleanup::evaluate(false, &ledger, &runtime, accepted_exit).map_err(RuntimeQaError::Cleanup)?;
    case.control.observe_cancellation();
    if let Some(reason) = case.control.reason() {
        return Err(match reason {
            crate::runtime_budget::TerminalReason::Cancelled => RuntimeQaError::Cancelled,
            _ => RuntimeQaError::Timeout,
        });
    }
    if case.control.evidence.expired() || case.control.run.expired() {
        return Err(RuntimeQaError::Timeout);
    }
    support::write_completion(case, fault)
}
