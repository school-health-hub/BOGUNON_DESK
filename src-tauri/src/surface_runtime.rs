#[cfg(windows)]
use crate::main_restore_ipc::MainRestoreServer;
#[cfg(windows)]
use std::{
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
};
#[cfg(windows)]
use tauri::AppHandle;

#[cfg(windows)]
const QA_GATE: &str = "BOGUNON_DESKTOP_SURFACE_QA";

#[cfg(windows)]
pub struct SurfaceRuntimeState {
    child: Mutex<Option<Child>>,
}

#[cfg(windows)]
impl SurfaceRuntimeState {
    pub const fn inactive() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    fn replace(&self, child: Child) -> Result<(), (String, Child)> {
        let Ok(mut slot) = self.child.lock() else {
            return Err((
                "Surface Host process state is unavailable".to_owned(),
                child,
            ));
        };
        if slot.is_some() {
            return Err(("Surface Host is already active".to_owned(), child));
        }
        *slot = Some(child);
        Ok(())
    }

    fn stop(&self) {
        let Ok(mut slot) = self.child.lock() else {
            return;
        };
        let Some(mut child) = slot.take() else {
            return;
        };
        if child.try_wait().ok().flatten().is_none() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(windows)]
impl Drop for SurfaceRuntimeState {
    fn drop(&mut self) {
        let Ok(slot) = self.child.get_mut() else {
            return;
        };
        let Some(child) = slot.as_mut() else {
            return;
        };
        if child.try_wait().ok().flatten().is_none() {
            let _ = child.kill();
            let _ = child.wait();
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
        let grant = grant.to_memory_bytes().map_err(|error| error.to_string())?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Surface Host inherited channel is unavailable".to_owned())?;
        Ok::<_, String>((grant, stdin))
    })();
    let (mut grant, mut stdin) = match prepared {
        Ok(prepared) => prepared,
        Err(error) => {
            server.retire();
            terminate_child(&mut child);
            return Err(error);
        }
    };
    if let Err(error) = stdin.write_all(&grant) {
        grant.fill(0);
        server.retire();
        terminate_child(&mut child);
        return Err(error.to_string());
    }
    grant.fill(0);
    drop(stdin);
    if let Err((error, mut child)) = state.replace(child) {
        server.retire();
        terminate_child(&mut child);
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
