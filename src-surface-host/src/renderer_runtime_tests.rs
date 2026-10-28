use crate::renderer_runtime::{
    NavigationResult, RendererMessageFailure, RendererObservation, RendererRuntimeState,
    RendererSignal,
};
use crate::resource_diagnostic::{HttpStatusClass, MimeClass, SurfaceAssetKind};

#[test]
fn renderer_ready_is_latched_but_requires_successful_navigation_to_pass() {
    let state = RendererRuntimeState::new();
    assert_eq!(state.signal(), RendererSignal::WaitingForNavigation);
    assert!(state.mark_ready());
    assert!(!state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::WaitingForNavigation);

    state.finish_navigation(NavigationResult::Succeeded);
    assert_eq!(state.signal(), RendererSignal::Ready);
}

#[test]
fn navigation_failure_can_never_become_renderer_ready() {
    let state = RendererRuntimeState::new();
    state.finish_navigation(NavigationResult::Failed);
    assert!(state.mark_ready());
    assert_eq!(state.signal(), RendererSignal::NavigationFailed);
}

#[test]
fn rejected_web_message_is_reported_instead_of_becoming_a_ready_timeout() {
    let state = RendererRuntimeState::new();
    state.finish_navigation(NavigationResult::Succeeded);
    state.reject_message(RendererMessageFailure::Source);

    assert_eq!(
        state.signal(),
        RendererSignal::MessageRejected(RendererMessageFailure::Source)
    );
    assert!(state.mark_ready());
    assert_eq!(
        state.signal(),
        RendererSignal::MessageRejected(RendererMessageFailure::Source)
    );
}

#[test]
fn script_probe_records_only_fixed_stage_codes_and_never_raw_values() {
    let state = RendererRuntimeState::new();
    assert!(state.begin_script_probe());
    assert!(!state.begin_script_probe());
    state.finish_script_probe(Some("\"projection_request_attempted\""));
    assert_eq!(
        state.observations(),
        vec![RendererObservation::ProjectionRequestAttempted]
    );

    assert!(state.begin_script_probe());
    state.finish_script_probe(Some("\"sensitive-or-unknown-value\""));
    assert_eq!(
        state.observations(),
        vec![
            RendererObservation::ProjectionRequestAttempted,
            RendererObservation::ScriptProbeUnknown,
        ]
    );
}

#[test]
fn failed_script_probe_is_observed_and_can_be_retried() {
    let state = RendererRuntimeState::new();
    assert!(state.begin_script_probe());
    state.cancel_script_probe();
    assert!(state.begin_script_probe());
    state.finish_script_probe(None);
    assert_eq!(
        state.observations(),
        vec![RendererObservation::ScriptProbeFailed]
    );
}

#[test]
fn asset_response_records_only_fixed_status_and_mime_classes() {
    let state = RendererRuntimeState::new();
    state.observe_asset_response(
        SurfaceAssetKind::JavaScript,
        HttpStatusClass::Success,
        MimeClass::Expected,
    );
    assert_eq!(
        state.observations(),
        vec![
            RendererObservation::JavaScriptResponseReceived,
            RendererObservation::JavaScriptResponseSucceeded,
            RendererObservation::JavaScriptMimeExpected,
        ]
    );
}

#[test]
fn script_probe_classifies_module_and_policy_failures() {
    for (stage, expected) in [
        (
            "diagnostic_bootstrap_started",
            RendererObservation::DiagnosticBootstrapStarted,
        ),
        ("module_load_error", RendererObservation::ModuleLoadError),
        (
            "csp_blocked",
            RendererObservation::ContentSecurityPolicyBlocked,
        ),
        ("javascript_error", RendererObservation::JavaScriptError),
    ] {
        let state = RendererRuntimeState::new();
        assert!(state.begin_script_probe());
        let encoded = serde_json::to_string(stage)
            .unwrap_or_else(|error| panic!("fixed stage must serialize: {error}"));
        state.finish_script_probe(Some(&encoded));
        assert_eq!(state.observations(), vec![expected]);
    }
}
