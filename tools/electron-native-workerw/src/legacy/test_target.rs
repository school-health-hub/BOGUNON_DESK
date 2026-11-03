use super::{
    observation::ReadQueries,
    owned::OwnedSurface,
    read_only_windows, target_evidence,
    test_window::{DpiGuard, TestWindow},
};
use crate::{
    lifecycle::Attempt,
    live_contract::LiveBinding,
    ownership::{Ledger, Resource},
    preflight::{OwnerReservation, PreflightSession},
};
use serde::Serialize;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
#[derive(Debug, thiserror::Error)]
#[error("NATIVE05B_TEST_TARGET_REJECTED")]
pub struct TargetRejected;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetReport {
    pub case_id: &'static str,
    pub window_qa_passed: bool,
    pub duplicate_rejected: bool,
    pub wrong_window_rejected: bool,
    pub window_destroyed: bool,
    pub disappearance_rejected: bool,
    pub window_lease_released: bool,
    pub candidate: target_evidence::CandidateReport,
    pub preflight_blocker: String,
    pub local_baseline: target_evidence::Baseline,
    pub native_cleanup: &'static str,
    pub attachment: &'static str,
    pub execution_allowed: bool,
}
pub struct TargetOutcome {
    pub report: TargetReport,
    _window: Option<TestWindow>,
}
pub fn run_target_qa(source: [u8; 20], loss: bool) -> Result<TargetOutcome, TargetRejected> {
    execute(source, loss).map_err(|_| TargetRejected)
}
fn execute(source: [u8; 20], loss: bool) -> Result<TargetOutcome, ()> {
    let _dpi = DpiGuard::enter().map_err(|_| ())?;
    let mut reader = read_only_windows::reader().map_err(|_| ())?;
    let topology = reader.0.topology().map_err(|_| ())?;
    let mut window = TestWindow::create(&reader.0.expected).map_err(|_| ())?;
    window.validate().map_err(|_| ())?;
    let own = window.owned.as_ref().ok_or(())?;
    let generation = own.cookie as u64;
    let state = reader.0.window(window.id()).map_err(|_| ())?;
    let baseline = target_evidence::baseline(&state, &topology, generation).map_err(|_| ())?;
    let candidate = target_evidence::classify(&mut reader, &topology, &state).map_err(|_| ())?;
    let duplicate_rejected = TestWindow::create(&reader.0.expected).is_err();
    let wrong_window_rejected =
        OwnedSurface::capture(topology.shell.id, &reader.0.expected).is_err();
    let nonce = u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| ())?
            .as_nanos(),
    )
    .map_err(|_| ())?;
    let attempt = Attempt::new(nonce, nonce).ok_or(())?;
    let mut ledger = Ledger::new(attempt);
    ledger
        .acquire(attempt, Resource::Host, state.identity.process.created)
        .map_err(|_| ())?;
    ledger
        .acquire(attempt, Resource::Window, state.identity.id.0 as u64)
        .map_err(|_| ())?;
    let lease = ledger
        .acquire_backend_registration(attempt, nonce)
        .map_err(|_| ())?;
    let binding = LiveBinding {
        generation: nonce,
        attempt: nonce,
        host_creation: state.identity.process.created,
        host_pid: baseline.pid,
        host_thread: baseline.thread_id,
        host_session: state.identity.process.session,
        explorer_pid: baseline.explorer_pid,
        source_sha: source,
        ledger_identity: nonce,
        lease_identity: nonce,
        surface: state.identity.id.0 as u64,
        explorer_creation: topology.shell.process.created,
        explorer_generation: topology.shell.process.created,
        surface_generation: generation,
        sequence: 1,
    };
    let mut session = PreflightSession::bind_owner(
        OwnerReservation {
            binding,
            ledger,
            lease,
        },
        Duration::from_secs(10),
    )
    .map_err(|_| ())?;
    let mut preflight_blocker = "CandidateNotVerified".to_owned();
    if candidate.selected {
        match session.observe_target() {
            Ok(observation) => {
                preflight_blocker = format!("{:?}", session.inspect(Some(&observation), 1).blocker)
            }
            Err(blocker) => preflight_blocker = format!("{blocker:?}"),
        }
    }
    if loss {
        session.host_lost();
        preflight_blocker = format!("{:?}", session.inspect(None, 2).blocker);
        // The binary exits abnormally only after writing this loss record. No live cleanup claim.
        return Ok(TargetOutcome {
            _window: Some(window),
            report: TargetReport {
                case_id: "host-loss",
                window_qa_passed: duplicate_rejected && wrong_window_rejected,
                duplicate_rejected,
                wrong_window_rejected,
                window_destroyed: false,
                disappearance_rejected: false,
                window_lease_released: false,
                candidate,
                preflight_blocker,
                local_baseline: baseline,
                native_cleanup: "NotVerified",
                attachment: "NOT_RUN",
                execution_allowed: false,
            },
        });
    }
    let old_id = window.id();
    let proof = window.close().map_err(|_| ())?;
    let disappearance_rejected = reader.0.identity(old_id).is_err();
    let released = session.settle_test_target(proof);
    Ok(TargetOutcome {
        _window: None,
        report: TargetReport {
            case_id: "normal",
            window_qa_passed: duplicate_rejected
                && wrong_window_rejected
                && disappearance_rejected
                && released,
            duplicate_rejected,
            wrong_window_rejected,
            window_destroyed: true,
            disappearance_rejected,
            window_lease_released: released,
            candidate,
            preflight_blocker,
            local_baseline: baseline,
            native_cleanup: "NotVerified",
            attachment: "NOT_RUN",
            execution_allowed: false,
        },
    })
}
