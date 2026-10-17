#![cfg(windows)]

mod disposable_surface;
mod evidence_approval;
mod evidence_paths;
mod gate;
mod live_permissions;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation.rs"]
mod observation;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation_reader.rs"]
mod observation_reader;
mod own_approval;
mod own_callbacks;
mod own_coordinator;
mod own_execution;
mod own_gate;
mod own_native;
#[cfg(all(windows, not(test), feature = "own-window-qa-skip-miri"))]
mod own_native_messages;
mod own_native_observation;
mod own_permissions;
mod own_result;
mod own_store;
mod surface_event_router;
mod surface_event_types;

fn main() -> std::process::ExitCode {
    std::panic::set_hook(Box::new(|_| {}));
    let report = match capture(prepare_and_run) {
        Ok(report) => report,
        Err(()) => blocked(own_result::Error::Panic),
    };
    let status = capture(|| report.write_to(&mut std::io::stdout().lock())).unwrap_or(6);
    std::process::ExitCode::from(status)
}
fn prepare_and_run() -> own_result::Report {
    let own_gate::Prepared {
        permit,
        mut store,
        source_sha,
        artifact_sha,
    } = match own_gate::authorize() {
        Ok(prepared) => prepared,
        Err(error) => return blocked(error),
    };
    match own_native::Native::new(permit) {
        Ok(driver) => own_execution::execute(
            driver,
            |record| store.save(record),
            &source_sha,
            &artifact_sha,
        ),
        Err(error) => blocked(error),
    }
}
fn blocked(error: own_result::Error) -> own_result::Report {
    let mut report = own_result::Report::new(Err(error));
    report.finish_cleanup(Ok(()), Some(0));
    report
}
fn capture<T>(operation: impl FnOnce() -> T) -> Result<T, ()> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(operation)) {
        Ok(value) => Ok(value),
        Err(payload) => {
            std::mem::forget(payload);
            Err(())
        }
    }
}
