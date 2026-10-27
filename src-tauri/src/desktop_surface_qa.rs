//! Isolated Main shell for the synthetic Desktop Surface portable QA flavor.
//!
//! This entrypoint intentionally registers no Tauri commands or production
//! plugins. Its only native responsibility is to own the QA window and launch
//! the fixed sibling Surface Host for the current process lifetime.

#[cfg(windows)]
use crate::surface_runtime::{self, SurfaceRuntimeState};
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
        crate::main_security::InstallError::Lifetime => {
            MainStartupFailure::SecurityLifetimeInstallFailed
        }
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
            if let Err(error) = crate::main_security::install_observed(app.handle(), |progress| {
                let result = match progress {
                    crate::main_security::InstallProgress::Started(stage) => {
                        setup_diagnostic.begin(security_stage(stage))
                    }
                    crate::main_security::InstallProgress::Completed(stage) => {
                        setup_diagnostic.complete(security_stage(stage))
                    }
                };
                let _ = result;
            }) {
                let _ = setup_diagnostic.fail(security_failure(error), ChildStatus::NotStarted);
                setup_failed_in_callback.store(true, Ordering::SeqCst);
                app.handle().exit(7);
                return Ok(());
            }
            #[cfg(windows)]
            {
                let state = app.state::<SurfaceRuntimeState>();
                surface_runtime::launch_desktop_surface_qa(app.handle(), &state, &setup_diagnostic)
                    .map_err(std::io::Error::other)?;
            }
            Ok(())
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
