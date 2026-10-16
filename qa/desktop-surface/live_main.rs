mod diagnostic_output;
mod gate;
mod live;
mod live_permissions;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation.rs"]
mod observation;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation_reader.rs"]
mod observation_reader;
mod outcome;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_process.rs"]
mod read_only_process;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_topology.rs"]
mod read_only_topology;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_windows.rs"]
mod read_only_windows;
mod test_window;
mod window_lifecycle;
mod window_observation;

fn main() -> std::process::ExitCode {
    diagnostic_output::install_private_hook();
    let result = diagnostic_output::execute(live::prepare);
    std::process::ExitCode::from(result.write_to(&mut std::io::stdout().lock()))
}
