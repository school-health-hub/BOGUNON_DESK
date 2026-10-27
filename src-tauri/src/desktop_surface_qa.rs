//! Isolated Main shell for the synthetic Desktop Surface portable QA flavor.
//!
//! This entrypoint intentionally registers no Tauri commands or production
//! plugins. Its only native responsibility is to own the QA window and launch
//! the fixed sibling Surface Host for the current process lifetime.

#[cfg(windows)]
use crate::surface_runtime::SurfaceRuntimeState;
#[cfg(windows)]
#[path = "qa_main_navigation.rs"]
mod navigation;
#[cfg(windows)]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
#[cfg(windows)]
use tauri::Manager;

#[cfg(windows)]
use crate::qa_main_startup_diagnostic::{
    ChildStatus, MainStartupFailure, MainStartupStage, QaMainStartupDiagnostic,
};

#[cfg(windows)]
fn security_stage(stage: crate::main_security::InstallStage) -> MainStartupStage {
    match stage {
        crate::main_security::InstallStage::Caller => MainStartupStage::SecurityCallerInstall,
        crate::main_security::InstallStage::Lifetime => MainStartupStage::SecurityLifetimeInstall,
        crate::main_security::InstallStage::Events => MainStartupStage::SecurityEventsInstall,
    }
}

#[cfg(windows)]
fn security_failure(error: crate::main_security::InstallError) -> MainStartupFailure {
    match error {
        crate::main_security::InstallError::Caller => {
            MainStartupFailure::SecurityCallerInstallFailed
        }
        crate::main_security::InstallError::Lifetime(error) => match error {
            crate::main_lifetime::InstallError::StateMissing => {
                MainStartupFailure::LifetimeStateMissing
            }
            crate::main_lifetime::InstallError::MainConfigMissing => {
                MainStartupFailure::LifetimeMainConfigMissing
            }
            crate::main_lifetime::InstallError::AppUrlInvalid => {
                MainStartupFailure::LifetimeAppUrlInvalid
            }
            crate::main_lifetime::InstallError::MainWebviewMissing => {
                MainStartupFailure::LifetimeMainWebviewMissing
            }
            crate::main_lifetime::InstallError::WebviewUrlUnavailable => {
                MainStartupFailure::LifetimeWebviewUrlUnavailable
            }
            crate::main_lifetime::InstallError::OriginMismatch => {
                MainStartupFailure::LifetimeOriginMismatch
            }
            crate::main_lifetime::InstallError::StateUnavailable => {
                MainStartupFailure::LifetimeStateUnavailable
            }
            crate::main_lifetime::InstallError::AlreadyInstalled => {
                MainStartupFailure::LifetimeAlreadyInstalled
            }
            crate::main_lifetime::InstallError::ResourceRegistrationFailed => {
                MainStartupFailure::LifetimeResourceRegistrationFailed
            }
        },
        crate::main_security::InstallError::Events => {
            MainStartupFailure::SecurityEventsInstallFailed
        }
    }
}

pub fn run() {
    #[cfg(windows)]
    let diagnostic = match QaMainStartupDiagnostic::start() {
        Ok(diagnostic) => diagnostic,
        Err(_) => std::process::exit(8),
    };
    #[cfg(windows)]
    let _ = diagnostic.complete(MainStartupStage::MainEntry);
    let builder = crate::main_security::configure(tauri::Builder::default());
    #[cfg(windows)]
    let builder = builder.manage(diagnostic.clone());
    #[cfg(windows)]
    let builder = builder.manage(SurfaceRuntimeState::inactive());

    #[cfg(windows)]
    let setup_diagnostic = diagnostic.clone();
    #[cfg(windows)]
    let setup_failed = Arc::new(AtomicBool::new(false));
    #[cfg(windows)]
    let setup_failed_in_callback = Arc::clone(&setup_failed);
    let result = builder
        .setup(move |app| {
            #[cfg(windows)]
            if let Err(failure) = navigation::begin(
                app.handle(),
                setup_diagnostic.clone(),
                Arc::clone(&setup_failed_in_callback),
            ) {
                navigation::fail_setup(
                    app.handle(),
                    &setup_diagnostic,
                    &setup_failed_in_callback,
                    failure,
                );
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(windows)]
            if window.label() == "main"
                && matches!(
                    event,
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
                )
            {
                navigation::cancel_pending(window);
            }
        })
        .run(tauri::generate_context!());

    #[cfg(windows)]
    if setup_failed.load(Ordering::SeqCst) {
        std::process::exit(7);
    }

    #[cfg(windows)]
    match result {
        Ok(()) => {
            let _ = diagnostic.complete(MainStartupStage::TauriRuntime);
            let _ = diagnostic.succeed();
        }
        Err(_) => {
            let _ = diagnostic.begin(MainStartupStage::TauriRuntime);
            let _ = diagnostic.fail(MainStartupFailure::TauriRuntimeFailed, ChildStatus::Unknown);
            std::process::exit(7);
        }
    }

    #[cfg(not(windows))]
    if result.is_err() {
        std::process::exit(7);
    }
}
