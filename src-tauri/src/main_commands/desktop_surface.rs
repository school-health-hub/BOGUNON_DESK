//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
use crate::surface_runtime::SurfaceRuntimeState;
use bogunon_main_restore_protocol::edit_control::EditCommand;
#[tauri::command]
pub(crate) fn get_desktop_surface_probe(
    caller: tauri::Webview,
    coordinator: State<'_, DesktopSurfaceCoordinator>,
) -> Result<probe::DesktopSurfaceProbe, crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        Ok::<probe::DesktopSurfaceProbe, String>(super::get_desktop_surface_probe(coordinator))
    })
}

fn send_edit_control(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
    command: EditCommand,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || runtime.send_edit(command))
}

#[tauri::command]
pub(crate) fn begin_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    send_edit_control(caller, runtime, EditCommand::Begin)
}

#[tauri::command]
pub(crate) fn complete_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    send_edit_control(caller, runtime, EditCommand::Complete)
}

#[tauri::command]
pub(crate) fn cancel_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    send_edit_control(caller, runtime, EditCommand::Cancel)
}
