use crate::disposable_surface::{Completion as C, Error as E, State, Support as S};
use crate::surface_event_types::{Action, Binding, RouteError as R};
use crate::surface_integration_fixture::Scenario;

#[test]
fn full_session_connects_creation_projection_ordering_and_successful_cleanup_completion() {
    let mut session = Scenario::new(2);
    let created = session.run(|r| r.create(S::Supported)).unwrap();
    assert_eq!(session.send(&created, 1), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.projection(&created).copied()),
        Err(R::Inactive)
    );
    session.run(|r| r.created(&created, C::Succeeded)).unwrap();
    assert_eq!(
        session.run(|r| r.projection(&created).copied()),
        Ok(session.main_projection())
    );
    session.send(&created, 1).unwrap();
    assert_eq!(session.send(&created, 1), Err(R::Sequence));
    assert_eq!(session.send(&created, 3), Err(R::Sequence));
    session.send(&created, 2).unwrap();
    let cleanup = session.run(|r| r.dispose()).unwrap();
    assert_eq!(session.send(&created, 3), Err(R::Operation));
    assert_eq!(session.send(&cleanup, 3), Err(R::Inactive));
    session.run(|r| r.disposed(&cleanup, C::Succeeded)).unwrap();
    assert_eq!(session.run(|r| r.state()), State::Absent);
    assert_eq!(session.send(&cleanup, 3), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.projection(&cleanup).copied()),
        Err(R::Inactive)
    );
    assert_eq!(session.requests().len(), 2);
    assert_eq!(session.requests()[1].sequence(), 2);
    assert_eq!(
        session.requests()[1].revision(),
        session.main_projection().revision()
    );
    assert_eq!(session.requests()[1].action(), Action::OpenMain);
    session.assert_main();
}

#[test]
fn loss_during_creation_retires_callbacks_before_and_after_replacement_activation() {
    let mut session = Scenario::new(1);
    let old = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.lost(&old)).unwrap();
    assert_eq!(session.send(&old, 1), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.projection(&old).copied()),
        Err(R::Inactive)
    );
    assert_eq!(
        session.run(|r| r.created(&old, C::Succeeded)),
        Err(R::Lifecycle(E::InvalidTransition))
    );
    let current = session.run(|r| r.retry_create(S::Supported)).unwrap();
    assert_ne!(old.instance(), current.instance());
    assert_ne!(
        old.operation().generation(),
        current.operation().generation()
    );
    assert_eq!(
        session.run(|r| r.created(&old, C::Succeeded)),
        Err(R::Instance)
    );
    assert_eq!(session.send(&current, 1), Err(R::Inactive));
    session.run(|r| r.created(&current, C::Succeeded)).unwrap();
    assert_eq!(session.send(&old, 1), Err(R::Instance));
    assert_eq!(session.run(|r| r.lost(&old)), Err(R::Instance));
    session.send(&current, 1).unwrap();
    assert_eq!(session.requests()[0].binding(), &current);
    session.assert_main();
}

#[test]
fn failed_disposal_requires_current_cleanup_success_before_any_replacement() {
    let mut session = Scenario::new(1);
    let old = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&old, C::Succeeded)).unwrap();
    session.send(&old, 1).unwrap();
    let cleanup = session.run(|r| r.dispose()).unwrap();
    session.run(|r| r.disposed(&cleanup, C::Failed)).unwrap();
    assert_eq!(session.send(&cleanup, 2), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.create(S::Supported)),
        Err(R::Lifecycle(E::ExplicitRetryRequired))
    );
    assert_eq!(
        session.run(|r| r.retry_create(S::Supported)),
        Err(R::Lifecycle(E::InvalidTransition))
    );
    let retry = session.run(|r| r.retry_dispose()).unwrap();
    assert_eq!(
        session.run(|r| r.disposed(&cleanup, C::Succeeded)),
        Err(R::Operation)
    );
    assert_eq!(
        session.run(|r| r.create(S::Supported)),
        Err(R::Lifecycle(E::Busy))
    );
    assert_eq!(session.send(&retry, 2), Err(R::Inactive));
    session.run(|r| r.disposed(&retry, C::Succeeded)).unwrap();
    let current = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&current, C::Succeeded)).unwrap();
    session.send(&current, 1).unwrap();
    let before = session.run(|r| r.state());
    assert_eq!(
        session.run(|r| r.disposed(&retry, C::Succeeded)),
        Err(R::Instance)
    );
    assert_eq!(session.run(|r| r.state()), before);
    assert_eq!(session.requests().len(), 2);
    session.assert_main();
}

#[test]
fn unsupported_after_disposal_cannot_emit_requests_or_bypass_reprobe_budget() {
    let mut session = Scenario::new(1);
    let initial = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&initial, C::Succeeded)).unwrap();
    let cleanup = session.run(|r| r.dispose()).unwrap();
    session.run(|r| r.disposed(&cleanup, C::Succeeded)).unwrap();
    assert_eq!(
        session.run(|r| r.create(S::Unsupported)),
        Err(R::Lifecycle(E::Unsupported))
    );
    assert_eq!(session.send(&cleanup, 1), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.projection(&cleanup).copied()),
        Err(R::Inactive)
    );
    assert_eq!(
        session.run(|r| r.retry_create(S::Unsupported)),
        Err(R::Lifecycle(E::Unsupported))
    );
    assert_eq!(
        session.run(|r| r.retry_create(S::Supported)),
        Err(R::Lifecycle(E::RetryLimit))
    );
    assert_eq!(session.run(|r| r.state()), State::Unsupported);
    assert!(session.requests().is_empty());
    session.assert_main();
}

#[test]
fn stale_generation_and_operation_replays_do_not_consume_current_event_sequence() {
    let mut session = Scenario::new(1);
    let old = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&old, C::Succeeded)).unwrap();
    session.run(|r| r.lost(&old)).unwrap();
    let current = session.run(|r| r.retry_create(S::Supported)).unwrap();
    session.run(|r| r.created(&current, C::Succeeded)).unwrap();
    let mixed = Binding {
        instance: current.instance().clone(),
        operation: old.operation(),
    };
    assert_eq!(session.send(&mixed, 1), Err(R::Operation));
    session.send(&current, 1).unwrap();
    let cleanup = session.run(|r| r.dispose()).unwrap();
    assert_eq!(
        session.run(|r| r.created(&current, C::Succeeded)),
        Err(R::Operation)
    );
    assert_eq!(session.send(&current, 2), Err(R::Operation));
    session.run(|r| r.disposed(&cleanup, C::Succeeded)).unwrap();
    assert_eq!(session.requests().len(), 1);
    session.assert_main();
}
