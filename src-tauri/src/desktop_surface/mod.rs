mod probe;
mod state;

#[cfg(windows)]
mod windows;

#[cfg(test)]
mod tests;

use tauri::State;

pub(crate) use state::DesktopSurfaceCoordinator;

pub(crate) fn get_desktop_surface_probe(
    coordinator: State<'_, DesktopSurfaceCoordinator>,
) -> probe::DesktopSurfaceProbe {
    let result = probe::probe_current_shell();
    coordinator.record_probe(result.supported);
    result
}

#[path = "../main_commands/desktop_surface.rs"]
pub(crate) mod main_commands;
