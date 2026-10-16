mod probe;
mod state;

#[cfg(windows)]
mod windows;

#[cfg(test)]
mod tests;

// 9B-2A is a simulation contract, deliberately absent from application builds.
#[cfg(test)]
mod lifecycle;

use tauri::State;

pub(crate) use state::DesktopSurfaceCoordinator;

#[tauri::command]
pub(crate) fn get_desktop_surface_probe(
    coordinator: State<'_, DesktopSurfaceCoordinator>,
) -> probe::DesktopSurfaceProbe {
    let result = probe::probe_current_shell();
    coordinator.record_probe(result.supported);
    result
}
