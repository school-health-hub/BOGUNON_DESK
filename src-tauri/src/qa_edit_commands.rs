//! Fixed, sanitized error boundary for the synthetic QA shell only.
use bogunon_main_restore_protocol::edit_control::EditCommand;
use tauri::State;

use crate::surface_runtime::SurfaceRuntimeState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Failure {
    CallerDenied,
    RuntimeInactive,
    FrameWriteFailed,
    Unknown,
}

fn classify(error: crate::main_caller::CommandError<Failure>) -> Failure {
    match error {
        crate::main_caller::CommandError::Caller { .. } => Failure::CallerDenied,
        crate::main_caller::CommandError::Existing(failure) => failure,
    }
}

#[tauri::command]
pub(crate) fn begin_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), Failure> {
    crate::main_caller::run(&caller, || runtime.send_qa_edit(EditCommand::Begin)).map_err(classify)
}

#[tauri::command]
pub(crate) fn complete_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), Failure> {
    crate::main_caller::run(&caller, || runtime.send_qa_edit(EditCommand::Complete))
        .map_err(classify)
}

#[tauri::command]
pub(crate) fn cancel_desktop_surface_edit(
    caller: tauri::Webview,
    runtime: State<'_, SurfaceRuntimeState>,
) -> Result<(), Failure> {
    crate::main_caller::run(&caller, || runtime.send_qa_edit(EditCommand::Cancel)).map_err(classify)
}

pub(crate) fn write_control(
    writer: &mut impl std::io::Write,
    payload: &[u8],
) -> Result<(), Failure> {
    bogunon_main_restore_protocol::memory_channel::write_frame(
        writer,
        payload,
        bogunon_main_restore_protocol::edit_control::MAX_EDIT_MESSAGE_BYTES,
    )
    .map_err(|_| Failure::FrameWriteFailed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn guard_failure_is_sanitized() {
        assert_eq!(
            classify(crate::main_caller::CommandError::Caller {
                caller_guard: crate::main_caller::Error::IdentityMismatch,
            }),
            Failure::CallerDenied
        );
    }
    #[test]
    fn inactive_runtime_is_distinct() {
        assert_eq!(
            SurfaceRuntimeState::inactive().send_qa_edit(EditCommand::Begin),
            Err(Failure::RuntimeInactive)
        );
    }
    #[test]
    fn frame_write_failure_does_not_expose_io_error() {
        let mut bytes = [0_u8; 1];
        let mut writer = std::io::Cursor::new(bytes.as_mut_slice());
        assert_eq!(
            write_control(&mut writer, b"fixed"),
            Err(Failure::FrameWriteFailed)
        );
    }
}
