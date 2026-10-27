//! QA-only one-shot bootstrap. The first app navigation starts after subscription.
use crate::qa_main_startup_diagnostic::{
    ChildStatus, MainStartupFailure, MainStartupStage, QaMainStartupDiagnostic,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Condvar, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
#[path = "qa_main_navigation_continue.rs"]
mod continuation;
#[path = "qa_main_navigation_native.rs"]
mod native;
#[path = "qa_main_navigation_state.rs"]
mod state;
use state::{Failure, Gate};

const NAVIGATION_BUDGET: Duration = Duration::from_secs(30);
const CLEANUP_BUDGET: Duration = Duration::from_secs(2);
#[derive(Default)]
struct Tokens {
    starting: Option<i64>,
    completed: Option<i64>,
}
pub(super) struct Bootstrap {
    gate: Mutex<Gate>,
    changed: Condvar,
    tokens: Mutex<Tokens>,
    cleanup_scheduled: AtomicBool,
    diagnostic: QaMainStartupDiagnostic,
    failed: Arc<AtomicBool>,
}

fn failure_code(failure: Failure) -> MainStartupFailure {
    match failure {
        Failure::Timeout => MainStartupFailure::NavigationTimeout,
        Failure::NavigationFailed => MainStartupFailure::NavigationFailed,
        Failure::UnexpectedOrigin => MainStartupFailure::NavigationUnexpectedOrigin,
        Failure::IdentityMismatch => MainStartupFailure::NavigationIdentityMismatch,
        Failure::Duplicate => MainStartupFailure::NavigationDuplicate,
        Failure::SubscribeFailed => MainStartupFailure::NavigationSubscribeFailed,
        Failure::UnsubscribeFailed => MainStartupFailure::NavigationUnsubscribeFailed,
        Failure::UrlUnavailable => MainStartupFailure::NavigationUrlUnavailable,
        Failure::ResourceMissing => MainStartupFailure::NavigationResourceMissing,
        Failure::NavigationChanged => MainStartupFailure::NavigationChanged,
    }
}

impl Bootstrap {
    fn record_failure(&self, failure: Failure) {
        if let Ok(mut gate) = self.gate.lock() {
            gate.fail(failure);
        }
        self.failed.store(true, Ordering::SeqCst);
        self.changed.notify_all();
        let _ = self
            .diagnostic
            .fail(failure_code(failure), ChildStatus::NotStarted);
    }
    fn fail(self: &Arc<Self>, main: &WebviewWindow, failure: Failure) {
        self.record_failure(failure);
        continuation::schedule(main.clone(), Arc::clone(self), false);
    }
    fn observe_started(self: &Arc<Self>, main: &WebviewWindow, id: u64) {
        let result = self
            .gate
            .lock()
            .map_err(|_| Failure::IdentityMismatch)
            .and_then(|mut gate| gate.started(id, Instant::now()));
        if let Err(failure) = result {
            self.fail(main, failure);
        }
    }
    fn observe_completed(self: &Arc<Self>, main: &WebviewWindow, id: u64, success: bool) {
        let result = self
            .gate
            .lock()
            .map_err(|_| Failure::IdentityMismatch)
            .and_then(|mut gate| gate.completed(id, success, Instant::now()));
        self.changed.notify_all();
        match result {
            Ok(()) => continuation::schedule(main.clone(), Arc::clone(self), true),
            Err(failure) => self.fail(main, failure),
        }
    }
}

fn target(app: &AppHandle, config: &tauri::utils::config::WindowConfig) -> Result<Url, Failure> {
    let WebviewUrl::App(path) = &config.url else {
        return Err(Failure::UnexpectedOrigin);
    };
    let root = if config.use_https_scheme {
        "https://tauri.localhost/"
    } else {
        "http://tauri.localhost/"
    };
    let url = Url::parse(root)
        .and_then(|root| root.join(path.to_str().unwrap_or_default()))
        .map_err(|_| Failure::UnexpectedOrigin)?;
    if tauri::is_dev() || path.to_str().is_none() || !crate::main_lifetime::local(app, &url) {
        return Err(Failure::UnexpectedOrigin);
    }
    Ok(url)
}

pub(super) fn begin(
    app: &AppHandle,
    diagnostic: QaMainStartupDiagnostic,
    failed: Arc<AtomicBool>,
) -> Result<(), Failure> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == "main")
        .ok_or(Failure::ResourceMissing)?;
    if config.create || app.get_webview_window("main").is_some() {
        return Err(Failure::Duplicate);
    }
    let url = target(app, config)?;
    let bootstrap = Arc::new(Bootstrap {
        gate: Mutex::new(Gate::new(Instant::now(), NAVIGATION_BUDGET)),
        changed: Condvar::new(),
        tokens: Mutex::new(Tokens::default()),
        cleanup_scheduled: AtomicBool::new(false),
        diagnostic,
        failed,
    });
    if !app.manage(Arc::clone(&bootstrap)) {
        return Err(Failure::Duplicate);
    }
    // No app document or IPC runs before Caller is pinned. Tauri skips Navigate
    // for this fixed blank bootstrap; it is never admitted by the origin guard.
    let blank = Url::parse("about:blank").map_err(|_| Failure::UnexpectedOrigin)?;
    let mut bootstrap_config = config.clone();
    bootstrap_config.url = WebviewUrl::External(blank);
    let main = WebviewWindowBuilder::from_config(app, &bootstrap_config)
        .map_err(|_| Failure::ResourceMissing)?
        .build()
        .map_err(|_| Failure::ResourceMissing)?;
    let result = crate::main_security::install_caller_observed(app, |progress| {
        let _ = match progress {
            crate::main_security::InstallProgress::Started(stage) => {
                bootstrap.diagnostic.begin(super::security_stage(stage))
            }
            crate::main_security::InstallProgress::Completed(stage) => {
                bootstrap.diagnostic.complete(super::security_stage(stage))
            }
        };
    });
    if let Err(error) = result {
        let _ = bootstrap
            .diagnostic
            .fail(super::security_failure(error), ChildStatus::NotStarted);
        bootstrap.fail(&main, Failure::IdentityMismatch);
        return Ok(());
    }
    bootstrap
        .diagnostic
        .begin(MainStartupStage::InitialNavigation)
        .map_err(|_| Failure::SubscribeFailed)?;
    if let Err(failure) = native::attach(&main, Arc::clone(&bootstrap)) {
        bootstrap.fail(&main, failure);
        return Ok(());
    }
    if let Err(failure) = start_deadline(main.clone(), Arc::clone(&bootstrap)) {
        bootstrap.fail(&main, failure);
        return Ok(());
    }
    if main.navigate(url).is_err() {
        bootstrap.fail(&main, Failure::NavigationFailed);
    }
    Ok(())
}

fn start_deadline(main: WebviewWindow, bootstrap: Arc<Bootstrap>) -> Result<(), Failure> {
    std::thread::Builder::new()
        .name("qa-initial-navigation-deadline".into())
        .spawn(move || {
            let mut gate = match bootstrap.gate.lock() {
                Ok(gate) => gate,
                Err(error) => {
                    drop(error.into_inner());
                    bootstrap.fail(&main, Failure::IdentityMismatch);
                    return;
                }
            };
            while gate.waiting() {
                let now = Instant::now();
                if gate.expire(now) {
                    drop(gate);
                    bootstrap.fail(&main, Failure::Timeout);
                    return;
                }
                let remaining = gate.remaining(now);
                match bootstrap.changed.wait_timeout(gate, remaining) {
                    Ok((next, _)) => gate = next,
                    Err(error) => {
                        drop(error.into_inner());
                        bootstrap.fail(&main, Failure::IdentityMismatch);
                        return;
                    }
                }
            }
        })
        .map(|_| ())
        .map_err(|_| Failure::SubscribeFailed)
}

pub(super) fn cancel_pending(window: &tauri::Window) {
    if let Some(bootstrap) = window.try_state::<Arc<Bootstrap>>() {
        let pending = bootstrap
            .gate
            .lock()
            .map(|gate| gate.waiting())
            .unwrap_or(true);
        if pending {
            bootstrap.record_failure(Failure::ResourceMissing);
            window.app_handle().exit(7);
        }
    }
}

pub(super) fn fail_setup(
    app: &AppHandle,
    diagnostic: &QaMainStartupDiagnostic,
    failed: &AtomicBool,
    failure: Failure,
) {
    failed.store(true, Ordering::SeqCst);
    let _ = diagnostic.fail(failure_code(failure), ChildStatus::NotStarted);
    app.exit(7);
}
