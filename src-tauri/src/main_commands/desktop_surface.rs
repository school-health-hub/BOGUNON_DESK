//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[cfg(not(feature = "desktop-surface-qa"))]
use crate::surface_runtime::SurfaceRuntimeState;
#[cfg(not(feature = "desktop-surface-qa"))]
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

#[cfg(not(feature = "desktop-surface-qa"))]
#[tauri::command]
pub(crate) fn begin_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
    on_state: Option<tauri::ipc::JavaScriptChannelId>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || {
        if let Some(channel) = on_state {
            runtime.watch_edit(caller.clone(), channel.channel_on(caller.clone()))?;
        }
        runtime.send_edit(EditCommand::Begin)
    })
}

#[cfg(not(feature = "desktop-surface-qa"))]
#[tauri::command]
pub(crate) fn complete_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || runtime.send_edit(EditCommand::Complete))
}

#[cfg(not(feature = "desktop-surface-qa"))]
#[tauri::command]
pub(crate) fn cancel_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), crate::main_caller::CommandError<String>> {
    crate::main_caller::run(&caller, || runtime.send_edit(EditCommand::Cancel))
}
