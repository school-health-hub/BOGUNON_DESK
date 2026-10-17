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

mod diagnostic_output;
mod disposable_surface;
mod disposable_surface_tests;
mod evidence_approval;
mod evidence_approval_tests;
mod evidence_paths;
mod evidence_pipeline_tests;
mod evidence_record;
mod evidence_schema;
mod evidence_schema_tests;
mod evidence_store;
mod evidence_store_tests;
mod gate;
mod gate_mock_tests;
mod live_evidence_tests;
mod live_observation;
mod main_boundary;
mod main_boundary_failure_tests;
mod main_boundary_state;
mod main_boundary_tests;
mod mock_tests;
mod observation_mock_tests;
mod outcome;
mod own_approval;
mod own_approval_tests;
mod own_callbacks;
mod own_coordinator;
mod own_coordinator_tests;
mod own_execution;
mod own_execution_tests;
mod own_ledger_tests;
mod own_loss_tests;
mod own_result;
mod own_store;
mod own_store_tests;
mod own_structure_tests;
mod reader_mock_tests;
mod surface_event_failure_tests;
mod surface_event_router;
mod surface_event_tests;
mod surface_event_types;
mod surface_integration_failure_tests;
mod surface_integration_fixture;
mod surface_integration_tests;
mod topology_evidence_tests;
mod topology_reader_tests;
mod window_lifecycle;
mod window_observation;
mod worker_evidence_tests;
mod worker_topology_contract_tests;
