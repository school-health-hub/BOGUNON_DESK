use std::cell::{Cell, RefCell};

use serde::Serialize;

use crate::resource_diagnostic::{HttpStatusClass, MimeClass, SurfaceAssetKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationResult {
    Pending,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RendererMessageFailure {
    Source,
    Payload,
    Contract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RendererSignal {
    WaitingForNavigation,
    WaitingForReady,
    Ready,
    NavigationFailed,
    MessageRejected(RendererMessageFailure),
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RendererObservation {
    HtmlDocumentLoaded,
    ScriptStarted,
    ReactMountComplete,
    BridgeInitialized,
    BridgeUnavailable,
    ProjectionRequestAttempted,
    WebMessageReceived,
    MessageContractAccepted,
    ProjectionResponseSent,
    ProjectionApplied,
    ReadyPostAttempted,
    RendererReadyAccepted,
    RootMissing,
    ScriptProbeFailed,
    ScriptProbeUnknown,
    DiagnosticBootstrapStarted,
    ModuleLoadError,
    ContentSecurityPolicyBlocked,
    JavaScriptError,
    HtmlResponseReceived,
    HtmlResponseSucceeded,
    HtmlResponseFailed,
    HtmlMimeExpected,
    HtmlMimeMismatch,
    HtmlMimeMissing,
    JavaScriptResponseReceived,
    JavaScriptResponseSucceeded,
    JavaScriptResponseFailed,
    JavaScriptMimeExpected,
    JavaScriptMimeMismatch,
    JavaScriptMimeMissing,
    CssResponseReceived,
    CssResponseSucceeded,
    CssResponseFailed,
    CssMimeExpected,
    CssMimeMismatch,
    CssMimeMissing,
    AssetResponseInspectionFailed,
}

pub struct RendererRuntimeState {
    navigation: Cell<NavigationResult>,
    ready: Cell<bool>,
    message_failure: Cell<Option<RendererMessageFailure>>,
    script_probe_in_flight: Cell<bool>,
    observations: RefCell<Vec<RendererObservation>>,
}

impl RendererRuntimeState {
    pub const fn new() -> Self {
        Self {
            navigation: Cell::new(NavigationResult::Pending),
            ready: Cell::new(false),
            message_failure: Cell::new(None),
            script_probe_in_flight: Cell::new(false),
            observations: RefCell::new(Vec::new()),
        }
    }

    pub fn finish_navigation(&self, result: NavigationResult) {
        if self.navigation.get() == NavigationResult::Pending {
            self.navigation.set(result);
        }
    }

    pub fn mark_ready(&self) -> bool {
        if self.ready.replace(true) {
            return false;
        }
        true
    }

    pub fn observe(&self, observation: RendererObservation) {
        let mut observations = self.observations.borrow_mut();
        if !observations.contains(&observation) {
            observations.push(observation);
        }
    }

    pub fn observations(&self) -> Vec<RendererObservation> {
        self.observations.borrow().clone()
    }

    pub fn observe_asset_response(
        &self,
        asset: SurfaceAssetKind,
        status: HttpStatusClass,
        mime: MimeClass,
    ) {
        let received = match asset {
            SurfaceAssetKind::Html => RendererObservation::HtmlResponseReceived,
            SurfaceAssetKind::JavaScript => RendererObservation::JavaScriptResponseReceived,
            SurfaceAssetKind::Css => RendererObservation::CssResponseReceived,
        };
        let status = match (asset, status) {
            (SurfaceAssetKind::Html, HttpStatusClass::Success) => {
                RendererObservation::HtmlResponseSucceeded
            }
            (SurfaceAssetKind::Html, HttpStatusClass::Failure) => {
                RendererObservation::HtmlResponseFailed
            }
            (SurfaceAssetKind::JavaScript, HttpStatusClass::Success) => {
                RendererObservation::JavaScriptResponseSucceeded
            }
            (SurfaceAssetKind::JavaScript, HttpStatusClass::Failure) => {
                RendererObservation::JavaScriptResponseFailed
            }
            (SurfaceAssetKind::Css, HttpStatusClass::Success) => {
                RendererObservation::CssResponseSucceeded
            }
            (SurfaceAssetKind::Css, HttpStatusClass::Failure) => {
                RendererObservation::CssResponseFailed
            }
        };
        let mime = match (asset, mime) {
            (SurfaceAssetKind::Html, MimeClass::Expected) => RendererObservation::HtmlMimeExpected,
            (SurfaceAssetKind::Html, MimeClass::Mismatch) => RendererObservation::HtmlMimeMismatch,
            (SurfaceAssetKind::Html, MimeClass::Missing) => RendererObservation::HtmlMimeMissing,
            (SurfaceAssetKind::JavaScript, MimeClass::Expected) => {
                RendererObservation::JavaScriptMimeExpected
            }
            (SurfaceAssetKind::JavaScript, MimeClass::Mismatch) => {
                RendererObservation::JavaScriptMimeMismatch
            }
            (SurfaceAssetKind::JavaScript, MimeClass::Missing) => {
                RendererObservation::JavaScriptMimeMissing
            }
            (SurfaceAssetKind::Css, MimeClass::Expected) => RendererObservation::CssMimeExpected,
            (SurfaceAssetKind::Css, MimeClass::Mismatch) => RendererObservation::CssMimeMismatch,
            (SurfaceAssetKind::Css, MimeClass::Missing) => RendererObservation::CssMimeMissing,
        };
        self.observe(received);
        self.observe(status);
        self.observe(mime);
    }

    pub fn begin_script_probe(&self) -> bool {
        !self.script_probe_in_flight.replace(true)
    }

    pub fn cancel_script_probe(&self) {
        self.script_probe_in_flight.set(false);
    }

    pub fn finish_script_probe(&self, result: Option<&str>) {
        self.script_probe_in_flight.set(false);
        let observation = result
            .and_then(|value| serde_json::from_str::<String>(value).ok())
            .and_then(|value| match value.as_str() {
                "html_document_loaded" => Some(RendererObservation::HtmlDocumentLoaded),
                "script_started" => Some(RendererObservation::ScriptStarted),
                "react_mount_complete" => Some(RendererObservation::ReactMountComplete),
                "bridge_initialized" => Some(RendererObservation::BridgeInitialized),
                "bridge_unavailable" => Some(RendererObservation::BridgeUnavailable),
                "projection_request_attempted" => {
                    Some(RendererObservation::ProjectionRequestAttempted)
                }
                "projection_applied" => Some(RendererObservation::ProjectionApplied),
                "ready_post_attempted" => Some(RendererObservation::ReadyPostAttempted),
                "root_missing" => Some(RendererObservation::RootMissing),
                "diagnostic_bootstrap_started" => {
                    Some(RendererObservation::DiagnosticBootstrapStarted)
                }
                "module_load_error" => Some(RendererObservation::ModuleLoadError),
                "csp_blocked" => Some(RendererObservation::ContentSecurityPolicyBlocked),
                "javascript_error" => Some(RendererObservation::JavaScriptError),
                _ => None,
            })
            .unwrap_or(if result.is_some() {
                RendererObservation::ScriptProbeUnknown
            } else {
                RendererObservation::ScriptProbeFailed
            });
        self.observe(observation);
    }

    pub fn reject_message(&self, failure: RendererMessageFailure) {
        if self.message_failure.get().is_none() {
            self.message_failure.set(Some(failure));
        }
    }

    pub fn signal(&self) -> RendererSignal {
        if let Some(failure) = self.message_failure.get() {
            return RendererSignal::MessageRejected(failure);
        }
        match (self.navigation.get(), self.ready.get()) {
            (NavigationResult::Pending, _) => RendererSignal::WaitingForNavigation,
            (NavigationResult::Failed, _) => RendererSignal::NavigationFailed,
            (NavigationResult::Succeeded, false) => RendererSignal::WaitingForReady,
            (NavigationResult::Succeeded, true) => RendererSignal::Ready,
        }
    }
}

impl Default for RendererRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
