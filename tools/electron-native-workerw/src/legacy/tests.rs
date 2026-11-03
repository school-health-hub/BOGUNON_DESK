use super::mock::Mock;
use super::{machine::*, model::*};

fn begin(machine: &mut Machine) -> OperationId {
    machine.probe(true);
    let Request::Started(id) = machine.attach() else {
        panic!("expected new operation")
    };
    id
}

fn finish(machine: &mut Machine, id: OperationId, mock: &mut Mock) {
    for _ in 0..30 {
        if machine.advance(id, mock) == Progress::Finished {
            return;
        }
    }
    panic!("operation did not terminate");
}

#[test]
fn starts_normal_and_probe_does_not_attach() {
    let mut machine = Machine::default();
    assert_eq!(machine.state(), State::NormalWindow);
    machine.probe(true);
    assert_eq!(machine.state(), State::ProbeReady);
    machine.probe(false);
    assert_eq!(machine.state(), State::NormalWindow);
    assert!(machine.history().is_empty());
}

#[test]
fn successful_attach_detach_and_duplicates() {
    let mut machine = Machine::default();
    let mut mock = Mock::default();
    assert_eq!(machine.attach(), Request::Unsupported);
    assert_eq!(machine.detach(), Request::Already);
    let id = begin(&mut machine);
    assert_eq!(machine.attach(), Request::Joined(id));
    finish(&mut machine, id, &mut mock);
    assert_eq!(machine.state(), State::Attached);
    assert_eq!(machine.attach(), Request::Already);
    machine.probe(false);
    assert_eq!(machine.state(), State::Attached);
    let Request::Started(detach) = machine.detach() else {
        panic!("detach required")
    };
    assert_eq!(machine.detach(), Request::Joined(detach));
    assert_eq!(machine.attach(), Request::Busy);
    finish(&mut machine, detach, &mut mock);
    assert_eq!(machine.state(), State::NormalWindow);
    assert_eq!(mock.current, mock.original.window);
    assert!(machine.history()[1].verified_restored);
}

#[test]
fn snapshot_failure_has_zero_mutations_and_failed_is_sticky() {
    let mut machine = Machine::default();
    let mut mock = Mock {
        snapshot_failure: true,
        ..Mock::default()
    };
    let id = begin(&mut machine);
    finish(&mut machine, id, &mut mock);
    assert_eq!(machine.state(), State::Failed);
    assert!(mock.calls.is_empty());
    machine.probe(true);
    machine.probe(false);
    assert_eq!(machine.state(), State::Failed);
    assert_eq!(machine.attach(), Request::Failed);
    assert_eq!(machine.detach(), Request::Failed);
    assert_eq!(machine.history()[0].cause, Some(Failure::Snapshot));
}

#[test]
fn each_partially_failed_stage_is_restored_in_reverse_including_failed_stage() {
    for (index, stage) in STAGES.iter().copied().enumerate() {
        let mut machine = Machine::default();
        let mut mock = Mock {
            fail_apply: Some(stage),
            ..Mock::default()
        };
        let id = begin(&mut machine);
        finish(&mut machine, id, &mut mock);
        let record = &machine.history()[0];
        assert_eq!(record.cause, Some(Failure::Mutation(stage)));
        assert_eq!(record.attempted, STAGES[..=index]);
        assert_eq!(
            record.restored,
            STAGES[..=index].iter().rev().copied().collect::<Vec<_>>()
        );
        assert!(record.verified_restored);
        assert_eq!(machine.state(), State::Fallback);
        assert_eq!(mock.current, mock.original.window);
    }
}

#[test]
fn fresh_topology_and_dpi_rejection_precedes_first_write() {
    for error in [
        Failure::ExplorerIdentity,
        Failure::WorkerInvalid,
        Failure::DpiMismatch,
    ] {
        let mut machine = Machine::default();
        let mut mock = Mock {
            attach_failure: Some(error),
            ..Mock::default()
        };
        let id = begin(&mut machine);
        finish(&mut machine, id, &mut mock);
        assert!(mock.calls.is_empty());
        assert_eq!(machine.state(), State::Fallback);
        assert_eq!(machine.history()[0].cause, Some(error));
    }
}

#[test]
fn explorer_change_after_partial_attach_rolls_back_without_reusing_shell() {
    let mut machine = Machine::default();
    let mut mock = Mock::default();
    let id = begin(&mut machine);
    machine.advance(id, &mut mock);
    machine.advance(id, &mut mock);
    mock.attach_failure = Some(Failure::ExplorerIdentity);
    finish(&mut machine, id, &mut mock);
    assert_eq!(machine.state(), State::Fallback);
    assert_eq!(mock.calls, vec![(false, Stage::Hide), (true, Stage::Hide)]);
}

#[test]
fn detach_intent_wins_at_every_attach_boundary() {
    for ticks in 0..=7 {
        let mut machine = Machine::default();
        let mut mock = Mock::default();
        let id = begin(&mut machine);
        for _ in 0..ticks {
            machine.advance(id, &mut mock);
        }
        let writes = mock.calls.len();
        assert_eq!(machine.detach(), Request::Joined(id));
        assert_eq!(machine.attach(), Request::Busy);
        finish(&mut machine, id, &mut mock);
        assert_eq!(machine.state(), State::Fallback);
        assert!(mock.calls[writes..].iter().all(|(restore, _)| *restore));
        assert_eq!(mock.current, mock.original.window);
    }
}

#[test]
fn stale_callbacks_do_not_read_or_write_adapter() {
    let mut machine = Machine::default();
    let mut mock = Mock::default();
    let first = begin(&mut machine);
    machine.detach();
    finish(&mut machine, first, &mut mock);
    let second = begin(&mut machine);
    let before = (mock.reads, mock.calls.len());
    assert_eq!(machine.advance(first, &mut mock), Progress::Stale);
    assert_eq!(
        machine.advance(OperationId(999), &mut mock),
        Progress::Stale
    );
    assert_eq!(before, (mock.reads, mock.calls.len()));
    finish(&mut machine, second, &mut mock);
    assert_eq!(machine.advance(second, &mut mock), Progress::Stale);
}

#[test]
fn rollback_failure_preserves_root_cause_and_never_falls_back() {
    for stage in STAGES {
        let mut machine = Machine::default();
        let mut mock = Mock {
            fail_apply: Some(Stage::Show),
            fail_restore: Some(stage),
            ..Mock::default()
        };
        let id = begin(&mut machine);
        finish(&mut machine, id, &mut mock);
        assert_eq!(machine.state(), State::Failed);
        let record = &machine.history()[0];
        assert_eq!(record.cause, Some(Failure::Mutation(Stage::Show)));
        assert!(record.rollback_errors.contains(&Failure::Restore(stage)));
        assert!(!record.verified_restored);
    }
}

#[test]
fn destroyed_or_reused_main_is_never_written_during_rollback() {
    for reused in [false, true] {
        let mut machine = Machine::default();
        let mut mock = Mock::default();
        let id = begin(&mut machine);
        machine.advance(id, &mut mock);
        machine.advance(id, &mut mock);
        if reused {
            mock.current.main.generation += 1;
        } else {
            mock.main_valid = false;
        }
        machine.detach();
        let before = mock.calls.len();
        finish(&mut machine, id, &mut mock);
        assert_eq!(machine.state(), State::Failed);
        assert_eq!(mock.calls.len(), before);
        assert!(machine.history()[0]
            .rollback_errors
            .contains(&Failure::MainIdentity));
    }
}

#[test]
fn failed_restore_verification_blocks_fallback_even_with_successful_calls() {
    let mut machine = Machine::default();
    let mut mock = Mock {
        fail_apply: Some(Stage::Styles),
        fail_verify_restore: true,
        ..Mock::default()
    };
    let id = begin(&mut machine);
    finish(&mut machine, id, &mut mock);
    assert_eq!(machine.state(), State::Failed);
    assert_eq!(
        machine.history()[0].rollback_errors,
        vec![Failure::Verification]
    );
}

#[test]
fn final_attach_verification_failure_rolls_back_every_stage() {
    let mut machine = Machine::default();
    let mut mock = Mock {
        fail_verify_attach: true,
        ..Mock::default()
    };
    let id = begin(&mut machine);
    finish(&mut machine, id, &mut mock);
    assert_eq!(machine.state(), State::Fallback);
    assert_eq!(machine.history()[0].cause, Some(Failure::Verification));
    assert_eq!(machine.history()[0].restored.len(), STAGES.len());
}
