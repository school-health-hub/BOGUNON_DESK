use super::{machine::*, mock::Mock, model::*};

#[test]
fn reused_main_at_each_forward_boundary_blocks_all_further_writes() {
    for ticks in 1..=7 {
        let mut machine = Machine::default();
        let mut mock = Mock::default();
        machine.probe(true);
        let Request::Started(id) = machine.attach() else {
            panic!("expected start")
        };
        for _ in 0..ticks {
            machine.advance(id, &mut mock);
        }
        mock.current.main.generation += 1;
        let before = mock.calls.len();
        for _ in 0..30 {
            if machine.advance(id, &mut mock) == Progress::Finished {
                break;
            }
        }
        assert_eq!(machine.state(), State::Failed);
        assert_eq!(mock.calls.len(), before);
        assert_eq!(machine.history()[0].cause, Some(Failure::MainIdentity));
    }
}

#[test]
fn changed_shell_identity_and_dpi_are_detected_from_observations() {
    for change in 0..6 {
        let mut machine = Machine::default();
        let mut mock = Mock::default();
        machine.probe(true);
        let Request::Started(id) = machine.attach() else {
            panic!("expected start")
        };
        machine.advance(id, &mut mock);
        let expected = match change {
            0 => {
                mock.explorer.pid += 1;
                Failure::ExplorerIdentity
            }
            1 => {
                mock.explorer.creation_time += 1;
                Failure::ExplorerIdentity
            }
            2 => {
                mock.explorer.verified_image += 1;
                Failure::ExplorerIdentity
            }
            3 => {
                mock.worker.generation += 1;
                Failure::WorkerInvalid
            }
            4 => {
                mock.worker_valid = false;
                Failure::WorkerInvalid
            }
            5 => {
                mock.current.dpi_context += 1;
                Failure::DpiMismatch
            }
            _ => unreachable!(),
        };
        for _ in 0..30 {
            if machine.advance(id, &mut mock) == Progress::Finished {
                break;
            }
        }
        assert!(mock.calls.is_empty());
        assert_eq!(machine.history()[0].cause, Some(expected));
        assert_ne!(machine.state(), State::Attached);
    }
}

#[test]
fn identity_loss_mid_rollback_stops_remaining_writes() {
    let mut machine = Machine::default();
    let mut mock = Mock {
        fail_apply: Some(Stage::Show),
        ..Mock::default()
    };
    machine.probe(true);
    let Request::Started(id) = machine.attach() else {
        panic!("expected start")
    };
    for _ in 0..8 {
        machine.advance(id, &mut mock);
    }
    assert_eq!(mock.calls.last(), Some(&(true, Stage::Show)));
    mock.current.main.process.creation_time += 1;
    let writes = mock.calls.len();
    assert_eq!(machine.advance(id, &mut mock), Progress::Finished);
    assert_eq!(mock.calls.len(), writes);
    assert_eq!(machine.state(), State::Failed);
    assert_eq!(
        machine.history()[0].rollback_errors,
        vec![Failure::MainIdentity]
    );
}

#[test]
fn nondefault_original_window_state_is_fully_preserved() {
    for maximized in [false, true] {
        let mut machine = Machine::default();
        let mut mock = Mock::default();
        mock.original.window.maximized = maximized;
        mock.original.window.minimized = !maximized;
        mock.original.window.visible = false;
        mock.original.window.parent = Some(mock.original.progman);
        mock.original.window.monitor = 4;
        mock.original.window.placement.show_command = if maximized { 3 } else { 2 };
        mock.current = mock.original.window.clone();
        machine.probe(true);
        let Request::Started(id) = machine.attach() else {
            panic!("expected start")
        };
        for _ in 0..8 {
            machine.advance(id, &mut mock);
        }
        let Request::Started(detach) = machine.detach() else {
            panic!("expected detach")
        };
        for _ in 0..30 {
            if machine.advance(detach, &mut mock) == Progress::Finished {
                break;
            }
        }
        assert_eq!(machine.state(), State::NormalWindow);
        assert_eq!(mock.current, mock.original.window);
        assert_eq!(machine.history()[0].snapshot.as_ref(), Some(&mock.original));
    }
}
