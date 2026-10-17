#![cfg(all(test, windows))]

#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation.rs"]
mod observation;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation_fixture.rs"]
mod observation_fixture;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation_reader.rs"]
mod observation_reader;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_process.rs"]
mod read_only_process;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_tests.rs"]
mod read_only_tests;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_topology.rs"]
mod read_only_topology;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/read_only_windows.rs"]
mod read_only_windows;

mod gate;
mod gate_mock_tests;
mod mock_tests;
mod observation_mock_tests;
mod outcome;
mod reader_mock_tests;
mod window_lifecycle;
mod window_observation;
mod worker_evidence_tests;
