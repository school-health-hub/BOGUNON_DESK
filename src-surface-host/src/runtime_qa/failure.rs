use std::path::Path;

use super::{RuntimeCase, RuntimeQaError};
use crate::runtime_evidence::{CaseCleanup, FailureCase};

/// Pre-dispatch rejections do not pretend to be WebView2 API failures.
/// Every post-dispatch fault goes through the real request/teardown path.
pub fn run(case: &RuntimeCase<'_>, fault: FailureCase) -> Result<CaseCleanup, RuntimeQaError> {
    match fault {
        FailureCase::EnvironmentRejected | FailureCase::ControllerRejected => {
            // Execute the same typed factory admission seam used before native dispatch.
            use crate::runtime_evidence::{admit_factory, CreationStage};
            let stage = if fault == FailureCase::EnvironmentRejected {
                CreationStage::Environment
            } else {
                CreationStage::Controller
            };
            if admit_factory(Some(fault), stage).is_ok() {
                return Err(RuntimeQaError::Identity);
            }
            super::write_json(
                &case.diagnostics.join("ownership-ledger.json"),
                &serde_json::json!({"schema":1,"creationAttempted":false,"resources":[],"containsSensitiveData":false}),
            )?;
            Ok(CaseCleanup::NoResourcesCreated)
        }
        FailureCase::EnvironmentDeadline
        | FailureCase::ControllerDeadline
        | FailureCase::CancelBeforeController
        | FailureCase::HeldEventToken
        | FailureCase::HeldComReference
        | FailureCase::MissingBrowserExit => {
            super::run_with_fault(case, Some(fault))?;
            Ok(CaseCleanup::Verified)
        }
    }
}

pub fn phase_one_receipt_matches(path: &Path, run: &str, controller: &str) -> bool {
    let value = std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
    match value {
        Some(value) => {
            value["phaseOneComplete"] == true
                && value["result"] == "PASS"
                && value["runId"] == run
                && value["controllerSha"] == controller
                && value["sourceSha"] == crate::runtime_guard::SOURCE_SHA
                && value["attempt"] == 1
        }
        None => false,
    }
}

pub(super) fn held_resource_probe(
    case: &RuntimeCase<'_>,
    fault: Option<FailureCase>,
    environment: &crate::windows_host::BoundEnvironment,
    identity: &crate::cleanup::RuntimeIdentity,
) -> Result<(), RuntimeQaError> {
    use crate::{
        browser_exit::BrowserExitSubscription,
        cleanup,
        ownership::{Ledger, Resource},
    };
    let resource = match fault {
        Some(FailureCase::HeldEventToken) => Resource::EventToken,
        Some(FailureCase::HeldComReference) => Resource::ComReference,
        _ => return Ok(()),
    };
    let attempt = identity.attempt;
    let mut ownership = Ledger::new(attempt);
    let reference = environment.environment.clone();
    let subscription = if resource == Resource::EventToken {
        Some(BrowserExitSubscription::subscribe(
            &reference,
            environment.binding,
        )?)
    } else {
        None
    };
    ownership
        .acquire(attempt, resource, 1)
        .map_err(|_| RuntimeQaError::Identity)?;
    // No exit event is fabricated. The live owned reference/token must deny a receipt
    // before exit evidence is examined (evaluate checks ownership first).
    if cleanup::evaluate(false, &ownership, identity, None)
        != Err(cleanup::CleanupUnknown::ResourceReleaseIncomplete)
    {
        return Err(RuntimeQaError::Identity);
    }
    super::write_json(
        &case.diagnostics.join("retention-observation.json"),
        &serde_json::json!({"schema":1,"liveResource":format!("{resource:?}"),"receiptDenied":true,"containsSensitiveData":false}),
    )?;
    if let Some(subscription) = subscription {
        subscription.unsubscribe()?;
    }
    drop(reference);
    ownership
        .release(attempt, resource, 1)
        .map_err(|_| RuntimeQaError::Identity)?;
    if !ownership.is_resolved() {
        return Err(RuntimeQaError::Identity);
    }
    Ok(())
}
