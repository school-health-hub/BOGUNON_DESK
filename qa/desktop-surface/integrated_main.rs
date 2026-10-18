//! Separately approved, one-shot synchronous QA process; never an OS message loop.
#[cfg(windows)]
mod async_surface;
#[cfg(windows)]
mod disposable_surface;
#[cfg(windows)]
mod evidence_approval;
#[cfg(windows)]
mod evidence_paths;
#[cfg(windows)]
mod integrated_entry;
#[cfg(windows)]
mod integrated_runner;
#[cfg(windows)]
mod integrated_source;
#[cfg(windows)]
mod main_boundary;
#[cfg(windows)]
mod main_boundary_state;
#[cfg(windows)]
mod native_adapter;
#[cfg(windows)]
mod native_contract;
#[cfg(windows)]
mod own_callbacks;
#[cfg(windows)]
mod own_coordinator;
#[cfg(windows)]
mod own_result;
#[cfg(windows)]
mod surface_event_router;
#[cfg(windows)]
mod surface_event_types;

#[cfg(windows)]
fn run(native_possible: &std::cell::Cell<bool>) -> std::process::ExitCode {
    use std::io::Write;
    let opt_in = std::env::var(integrated_runner::OPT_IN_NAME).ok();
    let args =
        integrated_entry::arguments(opt_in.as_deref(), || std::env::args_os().skip(1).collect());
    let mut stdout = std::io::stdout().lock();
    let mut stderr = std::io::stderr().lock();
    let loaded = match args.and_then(integrated_entry::Loaded::load) {
        Ok(loaded) => loaded,
        Err(error) => {
            let output = writeln!(stderr, "INTEGRATED_GATE=BLOCKED REASON={error:?}")
                .and_then(|()| stderr.flush());
            return std::process::ExitCode::from(if output.is_ok() { 2 } else { 6 });
        }
    };
    let now = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(now) => now.as_secs(),
        Err(_) => {
            let output = writeln!(stderr, "INTEGRATED_GATE=BLOCKED").and_then(|()| stderr.flush());
            return std::process::ExitCode::from(if output.is_ok() { 2 } else { 6 });
        }
    };
    native_possible.set(true);
    let report = integrated_runner::pipeline::run_native(
        loaded.input(),
        integrated_runner::evidence::UnixSeconds::new(now),
        &mut stdout,
        &mut stderr,
    );
    std::process::ExitCode::from(report.completed().exit_code())
}
#[cfg(not(windows))]
fn main() -> std::process::ExitCode {
    std::process::ExitCode::from(2)
}

#[cfg(windows)]
fn main() -> std::process::ExitCode {
    std::panic::set_hook(Box::new(|_| {}));
    let native_possible = std::cell::Cell::new(false);
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run(&native_possible))) {
        Ok(code) => code,
        Err(payload) => {
            std::mem::forget(payload);
            std::process::ExitCode::from(if native_possible.get() { 5 } else { 4 })
        }
    }
}
