use super::probe::{classify_topology, ShellTopology, WorkerCandidate};
use super::state::{DesktopSurfaceCoordinator, DesktopSurfaceState};

fn valid_worker() -> WorkerCandidate {
    WorkerCandidate {
        is_valid: true,
        is_visible: true,
        belongs_to_shell_process: true,
        hosts_desktop_view: false,
        is_attachment_sibling: true,
        has_usable_bounds: true,
    }
}

fn topology(workers: Vec<WorkerCandidate>) -> ShellTopology {
    ShellTopology {
        progman_found: true,
        shell_process_validated: true,
        desktop_view_host_found: true,
        workers,
    }
}

#[test]
fn reports_unavailable_when_progman_is_missing() {
    let result = classify_topology(&ShellTopology {
        progman_found: false,
        shell_process_validated: false,
        desktop_view_host_found: false,
        workers: Vec::new(),
    });

    assert!(!result.supported);
    assert_eq!(result.reason_code(), Some("progman_not_found"));
}

#[test]
fn reports_unavailable_when_workerw_is_missing() {
    let result = classify_topology(&topology(Vec::new()));

    assert!(!result.supported);
    assert_eq!(result.reason_code(), Some("workerw_candidate_not_found"));
}

#[test]
fn reports_unavailable_when_desktop_view_host_has_no_sibling() {
    let mut worker = valid_worker();
    worker.is_attachment_sibling = false;
    let result = classify_topology(&topology(vec![worker]));

    assert!(!result.supported);
    assert_eq!(result.reason_code(), Some("attachment_candidate_not_found"));
}

#[test]
fn reports_available_for_a_valid_attachment_candidate() {
    let result = classify_topology(&topology(vec![valid_worker()]));

    assert!(result.supported);
    assert!(result.attachment_candidate_found);
    assert!(result.candidate_still_valid);
    assert_eq!(result.reason_code(), None);
}

#[test]
fn reports_unavailable_for_a_stale_attachment_candidate() {
    let mut worker = valid_worker();
    worker.is_valid = false;
    let result = classify_topology(&topology(vec![worker]));

    assert!(!result.supported);
    assert_eq!(result.reason_code(), Some("attachment_candidate_stale"));
}

#[test]
fn selects_the_first_valid_sibling_deterministically() {
    let mut unrelated = valid_worker();
    unrelated.is_attachment_sibling = false;
    let mut stale_sibling = valid_worker();
    stale_sibling.is_valid = false;
    let result = classify_topology(&topology(vec![unrelated, stale_sibling, valid_worker()]));

    assert!(result.supported);
    assert_eq!(result.worker_candidate_count, 3);
    assert!(result.candidate_still_valid);
}

#[test]
fn reports_unavailable_when_desktop_view_host_is_missing() {
    let mut snapshot = topology(vec![valid_worker()]);
    snapshot.desktop_view_host_found = false;

    let result = classify_topology(&snapshot);

    assert!(!result.supported);
    assert_eq!(result.reason_code(), Some("desktop_view_host_not_found"));
}

#[test]
fn coordinator_records_available_probe_without_leaving_probe_state() {
    let coordinator = DesktopSurfaceCoordinator::default();

    let state = coordinator.record_probe(true);

    assert_eq!(state, DesktopSurfaceState::ProbeAvailable);
    assert_eq!(coordinator.current(), DesktopSurfaceState::ProbeAvailable);
}

#[test]
fn coordinator_records_unavailable_probe_without_leaving_probe_state() {
    let coordinator = DesktopSurfaceCoordinator::default();

    let state = coordinator.record_probe(false);

    assert_eq!(state, DesktopSurfaceState::ProbeUnavailable);
    assert_eq!(coordinator.current(), DesktopSurfaceState::ProbeUnavailable);
}

#[test]
fn frontend_probe_dto_does_not_serialize_native_window_handles() {
    let result = classify_topology(&topology(vec![valid_worker()]));
    let json = serde_json::to_string(&result).expect("probe DTO should serialize");

    assert!(!json.contains("hwnd"));
    assert!(!json.contains("handle"));
    assert!(!json.contains("pointer"));
}

#[test]
fn desktop_surface_state_defaults_to_normal_window() {
    let coordinator = DesktopSurfaceCoordinator::default();

    assert_eq!(coordinator.current(), DesktopSurfaceState::NormalWindow);
}

#[cfg(windows)]
#[test]
fn current_windows_shell_probe_returns_a_consistent_sanitized_result() {
    let result = super::probe::probe_current_shell();
    let json = serde_json::to_string(&result).expect("probe DTO should serialize");

    println!("desktop surface probe: {json}");
    assert_eq!(
        result.state,
        if result.supported {
            DesktopSurfaceState::ProbeAvailable
        } else {
            DesktopSurfaceState::ProbeUnavailable
        }
    );
    if result.supported {
        assert!(result.progman_found);
        assert!(result.desktop_view_host_found);
        assert!(result.attachment_candidate_found);
        assert!(result.candidate_still_valid);
    } else {
        assert!(result.reason_code().is_some());
    }
    assert!(!json.contains("hwnd"));
    assert!(!json.contains("handle"));
}
