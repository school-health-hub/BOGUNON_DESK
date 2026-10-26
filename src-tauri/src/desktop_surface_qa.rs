//! Isolated Main shell for the synthetic Desktop Surface portable QA flavor.
//!
//! This entrypoint intentionally registers no Tauri commands or production
//! plugins. Its only native responsibility is to own the QA window and launch
//! the fixed sibling Surface Host for the current process lifetime.

#[cfg(windows)]
use crate::surface_runtime::{self, SurfaceRuntimeState};
#[cfg(windows)]
use tauri::Manager;

pub fn run() {
    let builder = crate::main_security::configure(tauri::Builder::default());
    #[cfg(windows)]
    let builder = builder.manage(SurfaceRuntimeState::inactive());

    builder
        .setup(|app| {
            crate::main_security::install(app.handle())?;
            #[cfg(windows)]
            {
                let state = app.state::<SurfaceRuntimeState>();
                surface_runtime::launch_desktop_surface_qa(app.handle(), &state)
                    .map_err(std::io::Error::other)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running isolated Desktop Surface QA");
}
