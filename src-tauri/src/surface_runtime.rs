#[cfg(windows)]
use crate::main_restore_ipc::MainRestoreServer;
#[cfg(windows)]
use bogunon_main_restore_protocol::{
    edit_control::{EditBinding, EditCommand, EditControlError, MAX_EDIT_MESSAGE_BYTES},
    memory_channel::write_frame,
    windows_transport::MAX_GRANT_BYTES,
};
#[cfg(windows)]
use std::{
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
};
#[cfg(windows)]
use tauri::AppHandle;

#[cfg(all(windows, feature = "desktop-surface-qa"))]
use crate::qa_main_startup_diagnostic::{
    ChildStatus, MainStartupFailure, MainStartupStage, QaMainStartupDiagnostic,
};

#[cfg(windows)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ChildBeforeGrant {
    Running,
    Exited,
}

#[cfg(windows)]
pub(crate) const fn classify_child_before_grant(exited: bool) -> ChildBeforeGrant {
    if exited {
        ChildBeforeGrant::Exited
    } else {
        ChildBeforeGrant::Running
    }
}

#[cfg(windows)]
const QA_GATE: &str = "BOGUNON_DESKTOP_SURFACE_QA";

#[cfg(windows)]
pub struct SurfaceRuntimeState {
    runtime: Mutex<Option<SurfaceRuntime>>,
}

#[cfg(windows)]
struct SurfaceRuntime {
    child: Child,
    control: SurfaceControlWriter,
}

#[cfg(windows)]
struct SurfaceControlWriter {
    input: ChildStdin,
    binding: EditBinding,
    next_sequence: u64,
}

#[cfg(windows)]
impl SurfaceControlWriter {
    const fn new(input: ChildStdin, binding: EditBinding) -> Self {
        Self {
            input,
            binding,
            next_sequence: 1,
        }
    }

    fn send(&mut self, command: EditCommand) -> Result<(), String> {
        let payload = self
            .binding
            .request(self.next_sequence, command)
            .map_err(|error| error.to_string())?;
        write_frame(&mut self.input, &payload, MAX_EDIT_MESSAGE_BYTES)
            .map_err(|error| error.to_string())?;
        self.next_sequence = self
            .next_sequence
            .checked_add(1)
            .ok_or_else(|| EditControlError::InvalidSequence.to_string())?;
        Ok(())
    }
}

#[cfg(windows)]
impl SurfaceRuntimeState {
    pub const fn inactive() -> Self {
        Self {
            runtime: Mutex::new(None),
        }
    }

    fn replace(&self, runtime: SurfaceRuntime) -> Result<(), (String, SurfaceRuntime)> {
        let Ok(mut slot) = self.runtime.lock() else {
            return Err((
                "Surface Host process state is unavailable".to_owned(),
                runtime,
            ));
        };
        if slot.is_some() {
            return Err(("Surface Host is already active".to_owned(), runtime));
        }
        *slot = Some(runtime);
        Ok(())
    }

    pub fn send_edit(&self, command: EditCommand) -> Result<(), String> {
        let mut slot = self
            .runtime
            .lock()
            .map_err(|_| "Surface Host process state is unavailable".to_owned())?;
        let runtime = slot
            .as_mut()
            .ok_or_else(|| "Surface Host is not active".to_owned())?;
        if runtime
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_some()
        {
            return Err("Surface Host is not active".to_owned());
        }
        runtime.control.send(command)
    }

    fn stop(&self) {
        let Ok(mut slot) = self.runtime.lock() else {
            return;
        };
        let Some(mut runtime) = slot.take() else {
            return;
        };
        drop(runtime.control);
        if runtime.child.try_wait().ok().flatten().is_none() {
            let _ = runtime.child.kill();
            let _ = runtime.child.wait();
        }
    }
}

#[cfg(windows)]
impl Drop for SurfaceRuntimeState {
    fn drop(&mut self) {
        let Ok(slot) = self.runtime.get_mut() else {
            return;
        };
        let Some(runtime) = slot.as_mut() else {
            return;
        };
        if runtime.child.try_wait().ok().flatten().is_none() {
            let _ = runtime.child.kill();
            let _ = runtime.child.wait();
        }
    }
}

#[cfg(windows)]
fn qa_gate_value_is_enabled(value: Option<&std::ffi::OsStr>) -> bool {
    value.is_some_and(|value| value == "1")
}

#[cfg(windows)]
pub fn qa_launch_requested() -> bool {
    qa_gate_value_is_enabled(std::env::var_os(QA_GATE).as_deref())
}

#[cfg(windows)]
fn fixed_host_path(main_executable: &Path) -> Option<PathBuf> {
    main_executable
        .parent()
        .map(|directory| directory.join("bogunon-desktop-surface-host.exe"))
}

#[cfg(windows)]
pub fn launch_qa_surface(app: &AppHandle, state: &SurfaceRuntimeState) -> Result<(), String> {
    if !qa_launch_requested() {
        return Ok(());
    }
    launch_surface(app, state)
}

/// Launches the fixed sibling host for the dedicated QA binary.
///
/// Unlike the production-only diagnostic hook, the isolated QA entrypoint is
/// already an explicit authorization boundary and must not mutate process,
/// user, or machine environment state to opt in.
#[cfg(all(windows, feature = "desktop-surface-qa"))]
pub fn launch_desktop_surface_qa(
    app: &AppHandle,
    state: &SurfaceRuntimeState,
    diagnostic: &QaMainStartupDiagnostic,
) -> Result<(), String> {
    launch_surface_with_diagnostic(app, state, diagnostic)
}

#[cfg(all(windows, feature = "desktop-surface-qa"))]
fn launch_surface_with_diagnostic(
    app: &AppHandle,
    state: &SurfaceRuntimeState,
    diagnostic: &QaMainStartupDiagnostic,
) -> Result<(), String> {
    let _ = diagnostic.begin(MainStartupStage::HostPath);
    let main_executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let host = fixed_host_path(&main_executable)
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            let _ = diagnostic.fail(MainStartupFailure::HostUnavailable, ChildStatus::NotStarted);
            "The fixed Surface Host executable is unavailable".to_owned()
        })?;
    let _ = diagnostic.complete(MainStartupStage::HostPath);
    let _ = diagnostic.begin(MainStartupStage::HostSpawn);
    let mut child = Command::new(host)
        .arg("--qa-live")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let _ = diagnostic.fail(MainStartupFailure::HostSpawnFailed, ChildStatus::NotStarted);
            error.to_string()
        })?;
    let _ = diagnostic.complete(MainStartupStage::HostSpawn);
    let surface_pid = child.id();
    let generation = u64::from(surface_pid);
    let attempt = 1;
    let _ = diagnostic.begin(MainStartupStage::PipeServer);
    let server = MainRestoreServer::start(app.clone(), generation, attempt, surface_pid).map_err(
        |error| {
            let _ = diagnostic.fail(MainStartupFailure::PipeServerFailed, ChildStatus::Running);
            terminate_child(&mut child);
            error
        },
    )?;
    let _ = diagnostic.complete(MainStartupStage::PipeServer);
    let _ = diagnostic.begin(MainStartupStage::GrantReceive);
    let grant = match server.receive_grant() {
        Ok(grant) => grant,
        Err(error) => {
            let exited = child.try_wait().ok().flatten().is_some();
            let failure = if classify_child_before_grant(exited) == ChildBeforeGrant::Exited {
                MainStartupFailure::HostExitedBeforeGrant
            } else {
                MainStartupFailure::GrantReceiveFailed
            };
            let child_status = if exited {
                ChildStatus::ExitedBeforeGrant
            } else {
                ChildStatus::Running
            };
            let _ = diagnostic.fail(failure, child_status);
            server.retire();
            terminate_child(&mut child);
            return Err(error);
        }
    };
    let _ = diagnostic.complete(MainStartupStage::GrantReceive);
    let edit_binding = grant.edit_binding();
    let mut grant = grant.to_memory_bytes().map_err(|error| error.to_string())?;
    let _ = diagnostic.begin(MainStartupStage::GrantWrite);
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Surface Host inherited channel is unavailable".to_owned())?;
    if let Err(error) = write_frame(&mut stdin, &grant, MAX_GRANT_BYTES) {
        grant.fill(0);
        let _ = diagnostic.fail(MainStartupFailure::GrantWriteFailed, ChildStatus::Unknown);
        server.retire();
        terminate_child(&mut child);
        return Err(error.to_string());
    }
    grant.fill(0);
    let _ = diagnostic.complete(MainStartupStage::GrantWrite);
    let _ = diagnostic.begin(MainStartupStage::ChildRegistration);
    let runtime = SurfaceRuntime {
        child,
        control: SurfaceControlWriter::new(stdin, edit_binding),
    };
    if let Err((error, mut runtime)) = state.replace(runtime) {
        let _ = diagnostic.fail(
            MainStartupFailure::ChildRegistrationFailed,
            ChildStatus::Unknown,
        );
        server.retire();
        terminate_child(&mut runtime.child);
        return Err(error);
    }
    let _ = diagnostic.complete(MainStartupStage::ChildRegistration);
    let _ = diagnostic.begin(MainStartupStage::ServerActivation);
    server.serve().map_err(|error| {
        let _ = diagnostic.fail(
            MainStartupFailure::ServerActivationFailed,
            ChildStatus::Unknown,
        );
        state.stop();
        error
    })?;
    let _ = diagnostic.complete(MainStartupStage::ServerActivation);
    Ok(())
}

#[cfg(windows)]
fn launch_surface(app: &AppHandle, state: &SurfaceRuntimeState) -> Result<(), String> {
    let main_executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let host = fixed_host_path(&main_executable)
        .filter(|path| path.is_file())
        .ok_or_else(|| "The fixed Surface Host executable is unavailable".to_owned())?;
    let mut child = Command::new(host)
        .arg("--qa-live")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;
    let surface_pid = child.id();
    let generation = u64::from(surface_pid);
    let attempt = 1;
    let app = app.clone();
    let server =
        MainRestoreServer::start(app, generation, attempt, surface_pid).map_err(|error| {
            terminate_child(&mut child);
            error
        })?;
    let prepared = (|| {
        let grant = server.receive_grant()?;
        let edit_binding = grant.edit_binding();
        let grant = grant.to_memory_bytes().map_err(|error| error.to_string())?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Surface Host inherited channel is unavailable".to_owned())?;
        Ok::<_, String>((grant, stdin, edit_binding))
    })();
    let (mut grant, mut stdin, edit_binding) = match prepared {
        Ok(prepared) => prepared,
        Err(error) => {
            server.retire();
            terminate_child(&mut child);
            return Err(error);
        }
    };
    if let Err(error) = write_frame(&mut stdin, &grant, MAX_GRANT_BYTES) {
        grant.fill(0);
        server.retire();
        terminate_child(&mut child);
        return Err(error.to_string());
    }
    grant.fill(0);
    let runtime = SurfaceRuntime {
        child,
        control: SurfaceControlWriter::new(stdin, edit_binding),
    };
    if let Err((error, mut runtime)) = state.replace(runtime) {
        server.retire();
        terminate_child(&mut runtime.child);
        return Err(error);
    }
    server.serve().map_err(|error| {
        state.stop();
        error
    })?;
    Ok(())
}

#[cfg(windows)]
fn terminate_child(child: &mut Child) {
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn qa_gate_requires_the_exact_opt_in_value() {
        assert!(!qa_gate_value_is_enabled(None));
        assert!(!qa_gate_value_is_enabled(Some(std::ffi::OsStr::new(
            "true"
        ))));
        assert!(qa_gate_value_is_enabled(Some(std::ffi::OsStr::new("1"))));
    }

    #[test]
    fn host_path_is_fixed_beside_main_and_not_user_selected() {
        assert_eq!(
            fixed_host_path(Path::new(r"C:\qa\BOGUNON DESK.exe")),
            Some(PathBuf::from(r"C:\qa\bogunon-desktop-surface-host.exe"))
        );
    }
}
