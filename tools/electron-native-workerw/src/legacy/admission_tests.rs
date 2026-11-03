use super::{admission::*, machine::Progress, mock::Mock, model::*};
use crate::lifecycle::Attempt;
fn context() -> Context {
    let m = Mock::default();
    Context {
        attempt: Attempt {
            generation: 1,
            nonce: 2,
        },
        owner: m.original.window.main,
        explorer: m.explorer,
        sequence: 1,
    }
}
fn drive(tx: &mut HostTransaction, id: OperationId, m: &mut Mock) {
    for _ in 0..32 {
        if tx.step(id, m) == Progress::Finished {
            return;
        }
    }
    panic!("bounded model did not complete");
}
#[test]
fn restores_without_claiming_native_cleanup() {
    let c = context();
    let mut tx = HostTransaction::new(c).unwrap();
    let mut m = Mock::default();
    let id = tx.attach(c).unwrap();
    drive(&mut tx, id, &mut m);
    assert_eq!(tx.state(), "ModelAttached");
    let id = tx.detach(Context { sequence: 2, ..c }).unwrap();
    drive(&mut tx, id, &mut m);
    assert_eq!(tx.state(), "Detached");
    assert!(!tx.native_cleanup_verified());
    assert_eq!(
        tx.attach(Context { sequence: 3, ..c }),
        Err(Rejection::Retired)
    );
}
#[test]
fn rejects_session_owner_explorer_and_replay_before_api_access() {
    let c = context();
    let mut tx = HostTransaction::new(c).unwrap();
    assert_eq!(
        tx.attach(Context {
            attempt: Attempt {
                nonce: 3,
                ..c.attempt
            },
            ..c
        }),
        Err(Rejection::Session)
    );
    assert_eq!(
        tx.attach(Context {
            owner: WindowIdentity {
                generation: 99,
                ..c.owner
            },
            ..c
        }),
        Err(Rejection::Owner)
    );
    assert_eq!(
        tx.attach(Context {
            explorer: ProcessIdentity {
                creation_time: 99,
                ..c.explorer
            },
            ..c
        }),
        Err(Rejection::Explorer)
    );
    tx.attach(c).unwrap();
    assert_eq!(tx.attach(c), Err(Rejection::Replay));
    assert_eq!(
        tx.attach(Context { sequence: 2, ..c }),
        Err(Rejection::Busy)
    );
}
#[test]
fn cancellation_wins_and_late_callbacks_do_not_write() {
    let c = context();
    let mut tx = HostTransaction::new(c).unwrap();
    let mut m = Mock::default();
    let id = tx.attach(c).unwrap();
    tx.step(id, &mut m);
    tx.step(id, &mut m);
    tx.detach(Context { sequence: 2, ..c }).unwrap();
    assert_eq!(
        tx.detach(Context { sequence: 3, ..c }),
        Err(Rejection::Retired)
    );
    drive(&mut tx, id, &mut m);
    assert_eq!(m.current, m.original.window);
    let count = m.calls.len();
    assert_eq!(tx.step(OperationId(999), &mut m), Progress::Stale);
    assert_eq!(m.calls.len(), count);
}
#[test]
fn cleanup_failure_and_explorer_replacement_stay_unknown() {
    for shell in [false, true] {
        let c = context();
        let mut tx = HostTransaction::new(c).unwrap();
        let mut m = Mock::default();
        let id = tx.attach(c).unwrap();
        drive(&mut tx, id, &mut m);
        if shell {
            tx.explorer_changed(ProcessIdentity {
                creation_time: 99,
                ..c.explorer
            });
        } else {
            m.fail_restore = Some(Stage::Parent);
            let id = tx.detach(Context { sequence: 2, ..c }).unwrap();
            drive(&mut tx, id, &mut m);
        }
        assert_eq!(tx.state(), "CleanupUnknown");
        assert!(tx.return_to_normal());
        assert_eq!(
            tx.attach(Context { sequence: 4, ..c }),
            Err(Rejection::CleanupUnknown)
        );
        assert!(!tx.native_cleanup_verified());
    }
}
#[test]
fn host_exit_does_not_certify_native_cleanup() {
    let c = context();
    let mut tx = HostTransaction::new(c).unwrap();
    tx.attach(c).unwrap();
    tx.host_lost();
    assert_eq!(tx.state(), "CleanupUnknown");
    assert!(!tx.native_cleanup_verified());
    assert!(tx.return_to_normal());
}
#[test]
fn invalid_constructor_and_request_sequence_extremes_are_rejected() {
    let c = context();
    for bad in [
        Context {
            attempt: Attempt {
                generation: 0,
                ..c.attempt
            },
            ..c
        },
        Context {
            owner: WindowIdentity {
                thread: 0,
                ..c.owner
            },
            ..c
        },
        Context {
            explorer: ProcessIdentity {
                creation_time: 0,
                ..c.explorer
            },
            ..c
        },
    ] {
        assert!(HostTransaction::new(bad).is_err());
    }
    let mut tx = HostTransaction::new(c).unwrap();
    for sequence in [0, u64::MAX] {
        assert_eq!(tx.attach(Context { sequence, ..c }), Err(Rejection::Replay));
    }
    let mut m = Mock::default();
    let id = tx.attach(c).unwrap();
    drive(&mut tx, id, &mut m);
    assert_eq!(
        tx.detach(Context {
            sequence: 2,
            owner: WindowIdentity {
                generation: 99,
                ..c.owner
            },
            ..c
        }),
        Err(Rejection::Owner)
    );
    assert_eq!(tx.state(), "ModelAttached");
    tx.host_lost();
    assert_eq!(tx.state(), "CleanupUnknown");
    let calls = m.calls.len();
    assert_eq!(tx.step(id, &mut m), Progress::Stale);
    assert_eq!(m.calls.len(), calls);
}
