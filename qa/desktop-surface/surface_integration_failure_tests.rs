use crate::disposable_surface::{Completion as C, Error as E, State, Support as S};
use crate::surface_event_types::RouteError as R;
use crate::surface_integration_fixture::Scenario;

#[test]
fn failed_creation_recovery_loss_and_exhaustion_preserve_authoritative_work() {
    let mut session = Scenario::new(1);
    let first = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&first, C::Failed)).unwrap();
    assert_eq!(session.send(&first, 1), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.create(S::Supported)),
        Err(R::Lifecycle(E::ExplicitRetryRequired))
    );
    let current = session.run(|r| r.retry_create(S::Supported)).unwrap();
    session.run(|r| r.created(&current, C::Succeeded)).unwrap();
    session.send(&current, 1).unwrap();
    session.run(|r| r.lost(&current)).unwrap();
    assert_eq!(session.send(&current, 2), Err(R::Inactive));
    assert_eq!(
        session.run(|r| r.retry_create(S::Supported)),
        Err(R::Lifecycle(E::RetryLimit))
    );
    assert_eq!(
        session.run(|r| r.state()),
        State::Lost(current.operation().generation())
    );
    assert_eq!(session.requests().len(), 1);
    session.assert_main();
}

#[test]
fn creation_retry_spends_the_same_budget_required_by_failed_cleanup() {
    let mut session = Scenario::new(1);
    let first = session.run(|r| r.create(S::Supported)).unwrap();
    session.run(|r| r.created(&first, C::Failed)).unwrap();
    let current = session.run(|r| r.retry_create(S::Supported)).unwrap();
    session.run(|r| r.created(&current, C::Succeeded)).unwrap();
    session.send(&current, 1).unwrap();
    let cleanup = session.run(|r| r.dispose()).unwrap();
    session.run(|r| r.disposed(&cleanup, C::Failed)).unwrap();
    let before = session.run(|r| r.state());
    assert_eq!(
        session.run(|r| r.retry_dispose()),
        Err(R::Lifecycle(E::RetryLimit))
    );
    assert_eq!(
        session.run(|r| r.disposed(&cleanup, C::Succeeded)),
        Err(R::Lifecycle(E::InvalidTransition))
    );
    assert_eq!(
        session.run(|r| r.retry_create(S::Supported)),
        Err(R::Lifecycle(E::InvalidTransition))
    );
    assert_eq!(session.send(&cleanup, 2), Err(R::Inactive));
    assert_eq!(session.run(|r| r.state()), before);
    assert_eq!(session.requests().len(), 1);
    session.assert_main();
}

#[test]
fn cross_coordinator_callbacks_cannot_enter_a_new_lifecycle_with_equal_counters() {
    let mut retired = Scenario::new(0);
    let old = retired.run(|r| r.create(S::Supported)).unwrap();
    retired.run(|r| r.created(&old, C::Succeeded)).unwrap();
    retired.run(|r| r.lost(&old)).unwrap();
    for _ in 0..8 {
        let mut current = Scenario::new(0);
        let binding = current.run(|r| r.create(S::Supported)).unwrap();
        assert_eq!(old.operation(), binding.operation());
        assert_ne!(old.instance(), binding.instance());
        assert_eq!(
            current.run(|r| r.created(&old, C::Succeeded)),
            Err(R::Instance)
        );
        current.run(|r| r.created(&binding, C::Succeeded)).unwrap();
        assert_eq!(current.run(|r| r.lost(&old)), Err(R::Instance));
        assert_eq!(
            current.run(|r| r.disposed(&old, C::Succeeded)),
            Err(R::Instance)
        );
        assert_eq!(
            current.run(|r| r.projection(&old).copied()),
            Err(R::Instance)
        );
        assert_eq!(current.send(&old, 1), Err(R::Instance));
        current.send(&binding, 1).unwrap();
        let cleanup = current.run(|r| r.dispose()).unwrap();
        current.run(|r| r.disposed(&cleanup, C::Succeeded)).unwrap();
        assert_eq!(current.requests().len(), 1);
        current.assert_main();
    }
    retired.assert_main();
}
