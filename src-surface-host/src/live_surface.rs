use std::{
    cell::Cell,
    ffi::OsStr,
    fs::{create_dir, remove_dir_all},
    path::{Path, PathBuf},
    rc::Rc,
    thread,
    time::{Duration, Instant},
};

use bogunon_main_restore_protocol::windows_transport::SurfaceRestoreGrant;
use thiserror::Error;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;

use crate::{
    browser_exit::BrowserExitSubscription,
    cleanup::{self, BrowserExitEvidence, CleanupUnknown, RuntimeIdentity},
    diagnostic::{
        CleanupStatus, DiagnosticWriteError, FailureCode, QaRuntimeDiagnostic, RuntimeStage,
    },
    ipc::Generation,
    lifecycle::Attempt,
    main_restore::NamedPipeMainOpener,
    native_window::OwnedWindow,
    ownership::{Ledger, OwnershipError, Resource},
    renderer_runtime::RendererSignal,
    renderer_session::SessionCleanup,
    runtime_identity::directory_identity,
    surface_connection::MainOpener,
    udf::{self, DirectoryObservation},
    windows_host::{
        attach_surface_renderer, observe_runtime, pump_pending, ControllerRequest,
        EnvironmentRequest, HostError, RuntimeBinding, StaGuard,
    },
};

const CREATION_TIMEOUT: Duration = Duration::from_secs(30);
const INTERACTION_TIMEOUT: Duration = Duration::from_secs(300);

#[path = "live_surface_cleanup.rs"]
mod rejected_cleanup;

#[derive(Debug, Error)]
pub enum LiveSurfaceError {
    #[error("Surface runtime grant is invalid")]
    InvalidGrant,
    #[error("Surface runtime path is invalid")]
    InvalidPath,
    #[error("Surface UDF validation failed; local release complete={local_release_complete}")]
    Udf {
        source: udf::UdfError,
        cleanup: CleanupStatus,
        local_release_complete: bool,
    },
    #[error("Surface runtime WebView2 override is not trusted")]
    OverrideUntrusted,
    #[error("Surface runtime operation timed out")]
    Timeout,
    #[error("Surface renderer navigation failed")]
    NavigationFailed,
    #[error("Surface renderer did not become ready")]
    RendererReadyTimeout,
    #[error("Surface runtime native host failed: {0}")]
    Host(#[from] HostError),
    #[error("Surface runtime ownership failed: {0}")]
    Ownership(#[from] OwnershipError),
    #[error("Surface runtime cleanup is unverified: {0:?}")]
    Cleanup(CleanupUnknown),
    #[error("Surface Main restore channel failed")]
    MainRestore,
    #[error("Surface temporary storage cleanup failed")]
    TemporaryCleanup,
    #[error("Surface QA diagnostic failed: {0}")]
    Diagnostic(#[from] DiagnosticWriteError),
}

impl LiveSurfaceError {
    pub const fn failure_code(&self) -> FailureCode {
        match self {
            Self::InvalidGrant => FailureCode::InvalidGrant,
            Self::InvalidPath => FailureCode::InvalidPath,
            Self::Udf { source, .. } => match source {
                udf::UdfError::InvalidPath => FailureCode::UdfInvalidPath,
                udf::UdfError::ObservationFailed => FailureCode::UdfObservationFailed,
                udf::UdfError::EffectiveMismatch | udf::UdfError::SharedIdentity => {
                    FailureCode::UdfEffectiveMismatch
                }
                udf::UdfError::ProfileOutsideUdf => FailureCode::UdfProfileOutside,
                udf::UdfError::Overlap | udf::UdfError::OverrideUntrusted => {
                    FailureCode::RuntimeAdmissionRejected
                }
            },
            Self::OverrideUntrusted => FailureCode::RuntimeAdmissionRejected,
            Self::Timeout => FailureCode::Timeout,
            Self::NavigationFailed => FailureCode::NavigationFailed,
            Self::RendererReadyTimeout => FailureCode::RendererReadyTimeout,
            Self::Host(_) => FailureCode::NativeHostFailed,
            Self::Ownership(_) => FailureCode::OwnershipFailed,
            Self::Cleanup(_) => FailureCode::CleanupUnverified,
            Self::MainRestore => FailureCode::MainRestoreFailed,
            Self::TemporaryCleanup => FailureCode::TemporaryCleanupFailed,
            Self::Diagnostic(_) => FailureCode::DiagnosticWriteFailed,
        }
    }

    pub const fn cleanup_status(&self) -> CleanupStatus {
        match self {
            Self::Cleanup(_) => CleanupStatus::Unknown,
            Self::TemporaryCleanup => CleanupStatus::Receipt,
            Self::Udf { cleanup, .. } => *cleanup,
            _ => CleanupStatus::NotEvaluated,
        }
    }
}

struct TrackedMainOpener {
    inner: NamedPipeMainOpener,
    opened: Rc<Cell<bool>>,
}

impl MainOpener for TrackedMainOpener {
    type Error = bogunon_main_restore_protocol::windows_transport::TransportError;

    fn open_existing_main(&self) -> Result<(), Self::Error> {
        self.inner.open_existing_main()?;
        self.opened.set(true);
        Ok(())
    }
}

pub fn run(
    grant: SurfaceRestoreGrant,
    diagnostic: &mut QaRuntimeDiagnostic,
) -> Result<(), LiveSurfaceError> {
    diagnostic.begin(RuntimeStage::RuntimeAdmission)?;
    reject_webview_overrides()?;
    diagnostic.complete(RuntimeStage::RuntimeAdmission)?;
    let (endpoint, binding) = grant.into_parts();
    let generation_value = binding.generation;
    let generation = Generation::new(generation_value).ok_or(LiveSurfaceError::InvalidGrant)?;
    let attempt =
        Attempt::new(generation_value, binding.attempt).ok_or(LiveSurfaceError::InvalidGrant)?;
    let runtime_binding = RuntimeBinding {
        generation: generation_value,
        attempt: binding.attempt,
    };
    diagnostic.begin(RuntimeStage::BundleValidation)?;
    let executable = std::env::current_exe().map_err(|_| LiveSurfaceError::InvalidPath)?;
    let bundle_dir = sibling_bundle(&executable).ok_or(LiveSurfaceError::InvalidPath)?;
    diagnostic.complete(RuntimeStage::BundleValidation)?;
    diagnostic.begin(RuntimeStage::UdfCreation)?;
    let udf_root = qa_udf(generation_value)?;
    // A pre-existing directory is never adopted as this attempt's owned QA storage.
    let requested = create_owned_qa_udf(&udf_root)?;
    diagnostic.complete(RuntimeStage::UdfCreation)?;

    let mut ledger = Ledger::new(attempt);
    ledger.acquire(attempt, Resource::Host, 1)?;
    let sta = StaGuard::initialize()?;
    diagnostic.begin(RuntimeStage::WindowCreation)?;
    let window = OwnedWindow::create_hidden().map_err(HostError::Com)?;
    ledger.acquire(attempt, Resource::Window, 2)?;
    diagnostic.complete(RuntimeStage::WindowCreation)?;
    diagnostic.begin(RuntimeStage::EnvironmentCreation)?;
    let environment = wait_for(CREATION_TIMEOUT, || {
        EnvironmentRequest::begin(&sta, &udf_root, runtime_binding)
    })?;
    ledger.acquire(attempt, Resource::Environment, 3)?;
    diagnostic.complete(RuntimeStage::EnvironmentCreation)?;
    diagnostic.begin(RuntimeStage::BrowserExitSubscription)?;
    let browser_exit =
        BrowserExitSubscription::subscribe(&environment.environment, runtime_binding)?;
    ledger.acquire(attempt, Resource::EventToken, 4)?;
    diagnostic.complete(RuntimeStage::BrowserExitSubscription)?;
    diagnostic.begin(RuntimeStage::ControllerCreation)?;
    let controller = wait_controller(
        CREATION_TIMEOUT,
        &environment.environment,
        window.hwnd(),
        runtime_binding,
    )?;
    ledger.acquire(attempt, Resource::Controller, 5)?;
    diagnostic.complete(RuntimeStage::ControllerCreation)?;
    diagnostic.begin(RuntimeStage::UdfVerification)?;
    ledger.acquire(attempt, Resource::WebView, 6)?;
    let observed = observe_runtime(&environment.environment, &controller.controller);
    let expected_browser = observed.as_ref().ok().map(|value| value.browser_process_id);
    let verified = observed
        .map_err(|_| udf::UdfError::ObservationFailed)
        .and_then(|observation| {
            let effective = observe_directory(&observation.effective_udf)
                .map_err(|_| udf::UdfError::ObservationFailed)?;
            udf::verify_effective_on_disk(&requested, &effective, &observation.profile_path)?;
            Ok((observation, effective))
        });
    let (observation, effective) = match verified {
        Ok(verified) => verified,
        Err(source) => {
            // Keep the first failed stage/code. A rejected storage identity cannot
            // authorize a cleanup receipt or deletion, even after local releases.
            let local_release_complete = rejected_cleanup::release_rejected(
                rejected_cleanup::RejectedResources {
                    controller,
                    window,
                    subscription: browser_exit,
                    environment,
                    sta,
                },
                &mut ledger,
                attempt,
                runtime_binding,
                expected_browser,
            );
            return Err(LiveSurfaceError::Udf {
                source,
                cleanup: CleanupStatus::Unknown,
                local_release_complete,
            });
        }
    };
    let launch = crate::runtime_qa::RuntimeLaunchAuthority::new();
    let runtime = RuntimeIdentity::bind(
        &mut ledger,
        &launch,
        attempt,
        generation_value,
        observation.browser_process_id,
        effective.identity,
    )?;
    diagnostic.complete(RuntimeStage::UdfVerification)?;

    diagnostic.begin(RuntimeStage::MainRestoreReady)?;
    let opened = Rc::new(Cell::new(false));
    let opener = TrackedMainOpener {
        inner: NamedPipeMainOpener::new(OsStr::new(&endpoint), binding)
            .map_err(|_| LiveSurfaceError::MainRestore)?,
        opened: Rc::clone(&opened),
    };
    diagnostic.complete(RuntimeStage::MainRestoreReady)?;
    let mut renderer = attach_surface_renderer(
        &controller.controller,
        &bundle_dir,
        generation,
        opener,
        &mut ledger,
        attempt,
        diagnostic,
    )?;
    wait_renderer_ready(CREATION_TIMEOUT, &renderer.runtime, diagnostic)?;
    diagnostic.begin(RuntimeStage::WindowDisplay)?;
    // SAFETY: [Category 8 — FFI boundary] the controller is live on this STA and the
    // boolean is copied synchronously by WebView2.
    unsafe { controller.controller.SetIsVisible(true) }.map_err(HostError::Com)?;
    window.show().map_err(HostError::Com)?;
    diagnostic.complete(RuntimeStage::WindowDisplay)?;
    wait_for_interaction(INTERACTION_TIMEOUT, &window, || opened.get(), diagnostic)?;

    diagnostic.begin(RuntimeStage::RendererSessionCleanup)?;
    if renderer.session.cleanup().map_err(HostError::Renderer)? != SessionCleanup::Released {
        return Err(LiveSurfaceError::Cleanup(
            CleanupUnknown::ResourceReleaseIncomplete,
        ));
    }
    drop(renderer);
    diagnostic.complete(RuntimeStage::RendererSessionCleanup)?;
    diagnostic.begin(RuntimeStage::ControllerClose)?;
    close_controller(&controller.controller)?;
    drop(controller);
    ledger.release(attempt, Resource::WebView, 6)?;
    ledger.release(attempt, Resource::Controller, 5)?;
    diagnostic.complete(RuntimeStage::ControllerClose)?;
    diagnostic.begin(RuntimeStage::WindowDestroy)?;
    window.destroy().map_err(HostError::Com)?;
    ledger.release(attempt, Resource::Window, 2)?;
    diagnostic.complete(RuntimeStage::WindowDestroy)?;
    diagnostic.begin(RuntimeStage::BrowserExitObservation)?;
    let exit = wait_observation(CREATION_TIMEOUT, &browser_exit)?;
    if exit.binding != runtime_binding || exit.browser_process_id != observation.browser_process_id
    {
        return Err(LiveSurfaceError::Cleanup(
            CleanupUnknown::BrowserProcessMismatch,
        ));
    }
    diagnostic.complete(RuntimeStage::BrowserExitObservation)?;
    diagnostic.begin(RuntimeStage::BrowserExitUnsubscribe)?;
    browser_exit.unsubscribe()?;
    ledger.release(attempt, Resource::EventToken, 4)?;
    diagnostic.complete(RuntimeStage::BrowserExitUnsubscribe)?;
    drop(environment);
    ledger.release(attempt, Resource::Environment, 3)?;
    drop(sta);
    ledger.release(attempt, Resource::Host, 1)?;
    let evidence = BrowserExitEvidence {
        attempt,
        environment: generation_value,
        browser_process_id: exit.browser_process_id,
        normal_exit: exit.normal,
    };
    diagnostic.begin(RuntimeStage::CleanupEvaluation)?;
    cleanup::evaluate(false, &ledger, &runtime, Some(&evidence))
        .map_err(LiveSurfaceError::Cleanup)?;
    diagnostic.complete(RuntimeStage::CleanupEvaluation)?;
    diagnostic.begin(RuntimeStage::UdfRemoval)?;
    remove_qa_udf(&udf_root, &requested)?;
    diagnostic.complete(RuntimeStage::UdfRemoval)?;
    Ok(())
}

fn wait_for(
    timeout: Duration,
    begin: impl FnOnce() -> Result<EnvironmentRequest, HostError>,
) -> Result<crate::windows_host::BoundEnvironment, LiveSurfaceError> {
    let request = begin()?;
    wait_poll(timeout, || request.try_complete())
}

fn wait_controller(
    timeout: Duration,
    environment: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Environment,
    hwnd: windows::Win32::Foundation::HWND,
    binding: RuntimeBinding,
) -> Result<crate::windows_host::BoundController, LiveSurfaceError> {
    let request = ControllerRequest::begin(environment, hwnd, binding)?;
    wait_poll(timeout, || request.try_complete())
}

fn wait_observation(
    timeout: Duration,
    subscription: &BrowserExitSubscription,
) -> Result<crate::browser_exit::BrowserExitObservation, LiveSurfaceError> {
    wait_poll(timeout, || subscription.try_observe())
}

fn wait_poll<T>(
    timeout: Duration,
    mut poll: impl FnMut() -> Result<Option<T>, HostError>,
) -> Result<T, LiveSurfaceError> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(value) = poll()? {
            return Ok(value);
        }
        if Instant::now() >= deadline {
            return Err(LiveSurfaceError::Timeout);
        }
        let _ = pump_pending()?;
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_renderer_ready(
    timeout: Duration,
    state: &crate::renderer_runtime::RendererRuntimeState,
    diagnostic: &mut QaRuntimeDiagnostic,
) -> Result<(), LiveSurfaceError> {
    let deadline = Instant::now() + timeout;
    loop {
        match state.signal() {
            RendererSignal::WaitingForNavigation => {}
            RendererSignal::NavigationFailed => return Err(LiveSurfaceError::NavigationFailed),
            RendererSignal::WaitingForReady => {
                diagnostic.complete(RuntimeStage::HtmlNavigation)?;
                diagnostic.begin(RuntimeStage::RendererReady)?;
            }
            RendererSignal::Ready => {
                diagnostic.complete(RuntimeStage::HtmlNavigation)?;
                diagnostic.complete(RuntimeStage::RendererReady)?;
                return Ok(());
            }
        }
        if Instant::now() >= deadline {
            return Err(LiveSurfaceError::RendererReadyTimeout);
        }
        let _ = pump_pending()?;
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_interaction(
    timeout: Duration,
    window: &OwnedWindow,
    opened: impl Fn() -> bool,
    diagnostic: &mut QaRuntimeDiagnostic,
) -> Result<(), LiveSurfaceError> {
    diagnostic.begin(RuntimeStage::MainRestoreRequest)?;
    let deadline = Instant::now() + timeout;
    loop {
        if opened() {
            diagnostic.complete(RuntimeStage::MainRestoreRequest)?;
            return Ok(());
        }
        if window.close_requested() {
            diagnostic.begin(RuntimeStage::WindowCloseRequest)?;
            diagnostic.complete(RuntimeStage::WindowCloseRequest)?;
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(LiveSurfaceError::Timeout);
        }
        let _ = pump_pending()?;
        thread::sleep(Duration::from_millis(10));
    }
}

fn close_controller(controller: &ICoreWebView2Controller) -> Result<(), LiveSurfaceError> {
    // SAFETY: [Category 8 — FFI boundary] the controller is live on its creator STA and
    // this is the only explicit Close call in the live Surface success path.
    unsafe { controller.Close() }.map_err(HostError::Com)?;
    Ok(())
}

fn sibling_bundle(executable: &Path) -> Option<PathBuf> {
    executable.parent().map(|parent| parent.join("surface"))
}

fn qa_udf(generation: u64) -> Result<PathBuf, LiveSurfaceError> {
    let root = std::env::temp_dir();
    if !root.is_absolute() {
        return Err(LiveSurfaceError::InvalidPath);
    }
    Ok(root.join(format!(
        "bogunon-desktop-surface-qa-{}-{generation}",
        std::process::id()
    )))
}

fn observe_directory(path: &Path) -> Result<DirectoryObservation, LiveSurfaceError> {
    let path = path
        .canonicalize()
        .map_err(|_| LiveSurfaceError::InvalidPath)?;
    let identity = directory_identity(&path).map_err(|_| LiveSurfaceError::InvalidPath)?;
    Ok(DirectoryObservation { path, identity })
}

fn create_owned_qa_udf(path: &Path) -> Result<DirectoryObservation, LiveSurfaceError> {
    create_dir(path).map_err(|_| LiveSurfaceError::InvalidPath)?;
    observe_directory(path)
}

fn reject_webview_overrides() -> Result<(), LiveSurfaceError> {
    if has_override(|name| std::env::var_os(name).is_some()) {
        Err(LiveSurfaceError::OverrideUntrusted)
    } else {
        Ok(())
    }
}

fn has_override(mut present: impl FnMut(&str) -> bool) -> bool {
    const NAMES: [&str; 4] = [
        "WEBVIEW2_USER_DATA_FOLDER",
        "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "WEBVIEW2_RELEASE_CHANNEL_PREFERENCE",
    ];
    NAMES.iter().any(|name| present(name))
}

fn remove_qa_udf(path: &Path, owned: &DirectoryObservation) -> Result<(), LiveSurfaceError> {
    rejected_cleanup::verify_removal_root(path, owned)?;
    let root = std::env::temp_dir()
        .canonicalize()
        .map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
    let target = path
        .canonicalize()
        .map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
    let name_ok = target
        .file_name()
        .and_then(OsStr::to_str)
        .is_some_and(|name| name.starts_with("bogunon-desktop-surface-qa-"));
    if !name_ok || target.parent() != Some(root.as_path()) || target != owned.path {
        return Err(LiveSurfaceError::TemporaryCleanup);
    }
    remove_dir_all(target).map_err(|_| LiveSurfaceError::TemporaryCleanup)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundle_path_is_fixed_beside_the_surface_host() {
        assert_eq!(
            sibling_bundle(Path::new(r"C:\qa\bogunon-desktop-surface-host.exe")),
            Some(PathBuf::from(r"C:\qa\surface"))
        );
    }

    #[test]
    fn override_guard_is_fail_closed() {
        assert!(!has_override(|_| false));
        assert!(has_override(|name| name == "WEBVIEW2_USER_DATA_FOLDER"));
    }

    #[test]
    fn failure_classification_never_promotes_unverified_cleanup() {
        let cleanup = LiveSurfaceError::Cleanup(CleanupUnknown::ResourceReleaseIncomplete);
        assert_eq!(cleanup.failure_code(), FailureCode::CleanupUnverified);
        assert_eq!(cleanup.cleanup_status(), CleanupStatus::Unknown);

        let pre_cleanup = LiveSurfaceError::Timeout;
        assert_eq!(pre_cleanup.failure_code(), FailureCode::Timeout);
        assert_eq!(pre_cleanup.cleanup_status(), CleanupStatus::NotEvaluated);

        let after_receipt = LiveSurfaceError::TemporaryCleanup;
        assert_eq!(
            after_receipt.failure_code(),
            FailureCode::TemporaryCleanupFailed
        );
        assert_eq!(after_receipt.cleanup_status(), CleanupStatus::Receipt);
    }
}
