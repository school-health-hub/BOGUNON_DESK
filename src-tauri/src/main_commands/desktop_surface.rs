//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) fn get_desktop_surface_probe(
    caller: tauri::Webview,
    coordinator: State<'_, DesktopSurfaceCoordinator>,
) -> Result<probe::DesktopSurfaceProbe, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        Ok::<probe::DesktopSurfaceProbe, String>(super::get_desktop_surface_probe(coordinator))
    })
}
