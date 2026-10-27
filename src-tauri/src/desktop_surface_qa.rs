//! Isolated Main shell for the synthetic Desktop Surface portable QA flavor.
//!
//! This entrypoint intentionally registers no Tauri commands or production
//! plugins. Its only native responsibility is to own the QA window and launch
//! the fixed sibling Surface Host for the current process lifetime.

#[cfg(windows)]
use crate::surface_runtime::{self, SurfaceRuntimeState};
#[cfg(windows)]
use tauri::Manager;

#[cfg(windows)]
use crate::qa_main_startup_diagnostic::{
    ChildStatus, MainStartupFailure, MainStartupStage, QaMainStartupDiagnostic,
};

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
    let result = builder
        .setup(move |app| {
            #[cfg(windows)]
            let _ = setup_diagnostic.begin(MainStartupStage::SecurityInstall);
            crate::main_security::install(app.handle()).map_err(|error| {
                #[cfg(windows)]
                let _ = setup_diagnostic.fail(
                    MainStartupFailure::SecurityInstallFailed,
                    ChildStatus::NotStarted,
                );
                error
            })?;
            #[cfg(windows)]
            let _ = setup_diagnostic.complete(MainStartupStage::SecurityInstall);
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
