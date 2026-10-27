use super::{native, Bootstrap, Failure, CLEANUP_BUDGET};
use crate::qa_main_startup_diagnostic::{ChildStatus, MainStartupStage};
use std::sync::{atomic::Ordering, mpsc, Arc};
use std::time::Instant;
use tauri::{Manager, WebviewWindow};

pub(super) fn schedule(main: WebviewWindow, bootstrap: Arc<Bootstrap>, ready: bool) {
    if bootstrap.cleanup_scheduled.swap(true, Ordering::SeqCst) {
        return;
    }
    let fallback_main = main.clone();
    let fallback_state = Arc::clone(&bootstrap);
    let spawned = std::thread::Builder::new()
        .name("qa-navigation-continuation".into())
        .spawn(move || {
            let (send, receive) = mpsc::sync_channel(1);
            let detach_state = Arc::clone(&bootstrap);
            let queued = main.with_webview(move |platform| {
                // SAFETY: [Category 8 — FFI] Tauri gives a live controller on its
                // owning UI apartment; core is owned and dropped on that thread.
                let result = unsafe { platform.controller().CoreWebView2() }
                    .map_err(|_| Failure::UnsubscribeFailed)
                    .and_then(|core| {
                        if ready {
                            native::detach_completed(&core, &detach_state)
                        } else {
                            native::detach(&core, &detach_state)
                        }
                    });
                let _ = send.send(result);
            });
            let detached =
                queued.is_ok() && matches!(receive.recv_timeout(CLEANUP_BUDGET), Ok(Ok(())));
            if !detached {
                bootstrap.record_failure(Failure::UnsubscribeFailed);
            }
            let app = main.app_handle().clone();
            let fallback_app = app.clone();
            let continue_state = Arc::clone(&bootstrap);
            // Queue a separate task AFTER with_webview returns, avoiding recursive
            // Tauri runtime/window borrows or blocking a COM callback on Host startup.
            if app
                .run_on_main_thread(move || {
                    if ready && detached {
                        initialize(&main, &continue_state);
                    } else {
                        terminate(&main, &continue_state);
                    }
                })
                .is_err()
            {
                bootstrap.record_failure(Failure::ResourceMissing);
                fallback_app.exit(7);
            }
        });
    if spawned.is_err() {
        fallback_state.record_failure(Failure::UnsubscribeFailed);
        // No continuation worker exists. Do not re-enter with_webview from a
        // COM callback: Tauri executes UI-thread tasks inline. Fail closed;
        // token cleanup cannot be independently confirmed on this terminal path.
        fallback_main.app_handle().exit(7);
    }
}

fn terminate(main: &WebviewWindow, bootstrap: &Arc<Bootstrap>) {
    if let Err(failure) = native::detach_now(main, Arc::clone(bootstrap)) {
        bootstrap.record_failure(failure);
    }
    main.app_handle().exit(7);
}

fn initialize(main: &WebviewWindow, bootstrap: &Arc<Bootstrap>) {
    // NavigationStarting remains live through prepare, including security setup.
    if let Err(failure) = prepare(main, bootstrap) {
        bootstrap.record_failure(failure);
        terminate(main, bootstrap);
        return;
    }
    // Separate UI task, outside the worker's with_webview closure: no recursive
    // Tauri runtime borrow. Transfer protection to MainLifetime/MainEvents first.
    if let Err(failure) = native::detach_now(main, Arc::clone(bootstrap)) {
        bootstrap.record_failure(failure);
        terminate(main, bootstrap);
        return;
    }
    let app = main.app_handle();
    let finished = bootstrap
        .gate
        .lock()
        .map_err(|_| Failure::IdentityMismatch)
        .and_then(|mut gate| {
            gate.finish()?;
            if gate.can_start_host() {
                Ok(())
            } else {
                Err(Failure::NavigationFailed)
            }
        });
    if let Err(failure) = finished {
        bootstrap.record_failure(failure);
        terminate(main, bootstrap);
        return;
    }
    if !crate::main_lifetime::admit(app) || !crate::main_caller::is_registered_main(main.as_ref()) {
        bootstrap.record_failure(Failure::IdentityMismatch);
        terminate(main, bootstrap);
        return;
    }
    let Some(state) = app.try_state::<crate::surface_runtime::SurfaceRuntimeState>() else {
        bootstrap.record_failure(Failure::ResourceMissing);
        terminate(main, bootstrap);
        return;
    };
    if crate::surface_runtime::launch_desktop_surface_qa(app, &state, &bootstrap.diagnostic)
        .is_err()
    {
        bootstrap.failed.store(true, Ordering::SeqCst);
        terminate(main, bootstrap);
    }
}

fn prepare(main: &WebviewWindow, bootstrap: &Arc<Bootstrap>) -> Result<(), Failure> {
    let app = main.app_handle();
    let url = main.url().map_err(|_| Failure::UrlUnavailable)?;
    if app
        .try_state::<crate::main_caller::MainCallerGuard>()
        .is_none()
        || app
            .try_state::<crate::main_lifetime::MainLifetime>()
            .is_none()
        || app.try_state::<crate::main_events::MainEvents>().is_none()
        || app
            .try_state::<crate::surface_runtime::SurfaceRuntimeState>()
            .is_none()
    {
        return Err(Failure::ResourceMissing);
    }
    let identity_ok = crate::main_caller::is_registered_main(main.as_ref());
    let origin_ok = crate::main_lifetime::local(app, &url);
    let claimed = bootstrap
        .gate
        .lock()
        .map_err(|_| Failure::IdentityMismatch)
        .and_then(|mut gate| gate.claim(Instant::now(), identity_ok, origin_ok));
    bootstrap.changed.notify_all();
    claimed?;
    bootstrap
        .diagnostic
        .complete(MainStartupStage::InitialNavigation)
        .map_err(|_| Failure::NavigationFailed)?;
    let result = crate::main_security::install_after_caller_observed(app, |progress| {
        let _ = match progress {
            crate::main_security::InstallProgress::Started(stage) => bootstrap
                .diagnostic
                .begin(super::super::security_stage(stage)),
            crate::main_security::InstallProgress::Completed(stage) => bootstrap
                .diagnostic
                .complete(super::super::security_stage(stage)),
        };
    });
    if let Err(error) = result {
        // Preserve the precise security failure before the generic gate closes.
        let _ = bootstrap.diagnostic.fail(
            super::super::security_failure(error),
            ChildStatus::NotStarted,
        );
        return Err(Failure::NavigationFailed);
    }
    Ok(())
}
