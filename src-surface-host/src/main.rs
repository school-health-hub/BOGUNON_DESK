#[cfg(windows)]
fn main() {
    use bogunon_desktop_surface_host::diagnostic::{
        CleanupStatus, FailureCode, QaRuntimeDiagnostic, RuntimeStage,
    };
    use bogunon_main_restore_protocol::windows_transport::{SurfaceRestoreGrant, MAX_GRANT_BYTES};
    use std::io::Read;

    if std::env::args_os().nth(1).as_deref() != Some(std::ffi::OsStr::new("--qa-live")) {
        eprintln!(
            "BOGUNON Desktop Surface Host is not runtime-authorized; verification={}",
            bogunon_desktop_surface_host::RUNTIME_VERIFICATION
        );
        std::process::exit(2);
    }
    let Ok(mut diagnostic) = QaRuntimeDiagnostic::start() else {
        std::process::exit(6);
    };
    if diagnostic.complete(RuntimeStage::HostStarted).is_err()
        || diagnostic.begin(RuntimeStage::GrantRead).is_err()
    {
        std::process::exit(6);
    }
    let mut payload = Vec::with_capacity(MAX_GRANT_BYTES);
    if std::io::stdin()
        .take((MAX_GRANT_BYTES + 1) as u64)
        .read_to_end(&mut payload)
        .is_err()
        || payload.len() > MAX_GRANT_BYTES
    {
        let _ = diagnostic.fail(FailureCode::GrantReadFailed, CleanupStatus::NotEvaluated);
        std::process::exit(3);
    }
    if diagnostic.complete(RuntimeStage::GrantRead).is_err()
        || diagnostic.begin(RuntimeStage::GrantValidation).is_err()
    {
        std::process::exit(6);
    }
    let parsed = SurfaceRestoreGrant::from_memory_bytes(&payload);
    payload.fill(0);
    let Ok(grant) = parsed else {
        let _ = diagnostic.fail(FailureCode::InvalidGrant, CleanupStatus::NotEvaluated);
        std::process::exit(4);
    };
    if diagnostic.complete(RuntimeStage::GrantValidation).is_err() {
        std::process::exit(6);
    }
    match bogunon_desktop_surface_host::live_surface::run(grant, &mut diagnostic) {
        Ok(()) => {
            if diagnostic.succeed().is_err() {
                std::process::exit(6);
            }
        }
        Err(error) => {
            let _ = diagnostic.fail(error.failure_code(), error.cleanup_status());
            std::process::exit(5);
        }
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!(
        "BOGUNON Desktop Surface Host is Windows-only; verification={}",
        bogunon_desktop_surface_host::RUNTIME_VERIFICATION
    );
}
