use super::*;
struct Main(bool);
impl MainPresence for Main {
    fn existing_admitted_main(&self) -> bool {
        self.0
    }
}
fn run(broker: &mut Broker<Synthetic>, sequence: u64, action: Action) -> Result<Outcome, Error> {
    let request = broker.registry().binding().request(sequence, action);
    let pending = broker.begin(request, &Main(true))?;
    broker.complete(pending, &Main(true))
}
#[test]
fn open_main_needs_no_login_or_projection() {
    assert_eq!(
        run(&mut Broker::synthetic(), 1, Action::OpenMain),
        Ok(Outcome::OpenExistingMain)
    );
}
#[test]
fn absent_main_never_creates_main() {
    let mut b = Broker::synthetic();
    let request = b.registry().binding().request(1, Action::OpenMain);
    assert_eq!(
        b.begin(request, &Main(false)).unwrap_err(),
        Error::MainUnavailable
    );
}
#[test]
fn producer_absence_is_unavailable_not_zero() {
    assert_eq!(
        run(&mut Broker::synthetic(), 1, Action::RefreshProjection),
        Err(Error::Unavailable)
    );
}
#[test]
fn revision_only_projection_and_separate_action_policy() {
    let mut b = Broker::synthetic();
    b.publish_synthetic(7).unwrap();
    let request = b.registry().binding().request(1, Action::RefreshProjection);
    let pending = b.begin(request, &Main(false)).unwrap();
    assert_eq!(
        b.complete(pending, &Main(false)),
        Ok(Outcome::Projection(Projection { revision: 7 }))
    );
}
#[test]
fn duplicate_and_out_of_order_sequences_rejected() {
    let mut b = Broker::synthetic();
    run(&mut b, 4, Action::OpenMain).unwrap();
    assert_eq!(run(&mut b, 4, Action::OpenMain), Err(Error::Sequence));
    assert_eq!(run(&mut b, 3, Action::OpenMain), Err(Error::Sequence));
}
#[test]
fn overflow_closes_admission() {
    let mut b = Broker::synthetic();
    assert_eq!(
        run(&mut b, u64::MAX, Action::OpenMain),
        Err(Error::Overflow)
    );
    assert_eq!(run(&mut b, 1, Action::OpenMain), Err(Error::Closed));
}
#[test]
fn retiring_and_retired_reject_requests() {
    let mut b = Broker::synthetic();
    b.registry_mut().retiring().unwrap();
    assert_eq!(run(&mut b, 1, Action::OpenMain), Err(Error::Closed));
    let _receipt = b.registry_mut().confirm_synthetic_cleanup().unwrap();
    assert_eq!(run(&mut b, 2, Action::OpenMain), Err(Error::Closed));
}
#[test]
fn unknown_rejects_replacement_even_with_prior_receipt() {
    let mut b = Broker::synthetic();
    b.registry_mut().retiring().unwrap();
    let receipt = b.registry_mut().confirm_synthetic_cleanup().unwrap();
    b.registry_mut().cleanup_unknown();
    assert_eq!(b.registry_mut().replace(receipt), Err(Error::Cleanup));
}
#[test]
fn logout_permission_and_main_loss_invalidate_projection_and_pending() {
    for invalidate in [
        Broker::logout,
        Broker::permission_changed,
        Broker::main_lost,
    ] {
        let mut b = Broker::synthetic();
        b.publish_synthetic(1).unwrap();
        let request = b.registry().binding().request(1, Action::RefreshProjection);
        let pending = b.begin(request, &Main(true)).unwrap();
        invalidate(&mut b).unwrap();
        assert_eq!(b.complete(pending, &Main(true)), Err(Error::Stale));
        assert_eq!(
            run(&mut b, 2, Action::RefreshProjection),
            Err(Error::Unavailable)
        );
    }
}
#[test]
fn foreign_instance_and_operation_and_generation_rejected() {
    let mut b = Broker::synthetic();
    let other = Broker::synthetic().registry().binding();
    assert_eq!(
        b.begin(other.request(1, Action::OpenMain), &Main(true))
            .unwrap_err(),
        Error::Identity
    );
    let mut stale = b.registry().binding();
    stale.generation += 1;
    assert_eq!(
        b.begin(stale.request(1, Action::OpenMain), &Main(true))
            .unwrap_err(),
        Error::Identity
    );
    let mut stale = b.registry().binding();
    stale.operation = std::sync::Arc::new(());
    assert_eq!(
        b.begin(stale.request(1, Action::OpenMain), &Main(true))
            .unwrap_err(),
        Error::Identity
    );
}
#[test]
fn replacement_rejects_previous_binding_and_pending() {
    let mut b = Broker::synthetic();
    let old = b.registry().binding();
    let pending = b
        .begin(old.request(1, Action::OpenMain), &Main(true))
        .unwrap();
    b.registry_mut().retiring().unwrap();
    let receipt = b.registry_mut().confirm_synthetic_cleanup().unwrap();
    b.registry_mut().replace(receipt).unwrap();
    assert_eq!(b.complete(pending, &Main(true)), Err(Error::Identity));
    assert_eq!(
        b.begin(old.request(2, Action::OpenMain), &Main(true))
            .unwrap_err(),
        Error::Identity
    );
}
#[test]
fn surface_loss_blocks_inflight_result() {
    let mut b = Broker::synthetic();
    let request = b.registry().binding().request(1, Action::OpenMain);
    let pending = b.begin(request, &Main(true)).unwrap();
    b.registry_mut().lost();
    assert_eq!(b.complete(pending, &Main(true)), Err(Error::Closed));
}
#[test]
fn foreign_cleanup_receipt_rejected() {
    let mut a = Registry::synthetic();
    a.retiring().unwrap();
    let receipt = a.confirm_synthetic_cleanup().unwrap();
    let mut b = Registry::synthetic();
    b.retiring().unwrap();
    b.confirm_synthetic_cleanup().unwrap();
    assert_eq!(b.replace(receipt), Err(Error::Cleanup));
}

#[test]
fn main_loss_invalidates_pending_open_even_if_main_later_exists() {
    let mut b = Broker::synthetic();
    let request = b.registry().binding().request(1, Action::OpenMain);
    let pending = b.begin(request, &Main(true)).unwrap();
    b.main_lost().unwrap();
    assert_eq!(b.complete(pending, &Main(true)), Err(Error::Stale));
}

#[test]
fn newer_request_rejects_older_pending_result() {
    let mut b = Broker::synthetic();
    let request = b.registry().binding().request(1, Action::OpenMain);
    let pending = b.begin(request, &Main(true)).unwrap();
    run(&mut b, 2, Action::OpenMain).unwrap();
    assert_eq!(b.complete(pending, &Main(true)), Err(Error::Stale));
}
#[test]
fn publication_revision_is_monotonic_after_invalidation() {
    let mut b = Broker::synthetic();
    b.publish_synthetic(9).unwrap();
    b.logout().unwrap();
    assert_eq!(b.publish_synthetic(9), Err(Error::Stale));
    assert_eq!(b.publish_synthetic(8), Err(Error::Stale));
    b.publish_synthetic(10).unwrap();
    assert_eq!(
        run(&mut b, 1, Action::RefreshProjection),
        Ok(Outcome::Projection(Projection { revision: 10 }))
    );
}
#[test]
fn publication_overflow_revokes_projection_and_admission() {
    let mut b = Broker::synthetic();
    b.publish_synthetic(1).unwrap();
    b.publication = u64::MAX;
    assert_eq!(b.logout(), Err(Error::Overflow));
    assert_eq!(run(&mut b, 1, Action::OpenMain), Err(Error::Closed));
    assert_eq!(b.projection, None);
}
#[test]
fn replacement_explicitly_allows_only_new_binding() {
    let mut b = Broker::synthetic();
    run(&mut b, 4, Action::OpenMain).unwrap();
    b.registry_mut().retiring().unwrap();
    let receipt = b.registry_mut().confirm_synthetic_cleanup().unwrap();
    b.registry_mut().replace(receipt).unwrap();
    assert_eq!(
        run(&mut b, 1, Action::OpenMain),
        Ok(Outcome::OpenExistingMain)
    );
}
#[test]
fn main_disappears_before_completion() {
    let mut b = Broker::synthetic();
    let request = b.registry().binding().request(1, Action::OpenMain);
    let pending = b.begin(request, &Main(true)).unwrap();
    assert_eq!(
        b.complete(pending, &Main(false)),
        Err(Error::MainUnavailable)
    );
}
#[test]
fn cleanup_requires_retiring_and_cannot_confirm_twice() {
    let mut r = Registry::synthetic();
    assert_eq!(r.confirm_synthetic_cleanup().unwrap_err(), Error::Cleanup);
    r.retiring().unwrap();
    r.confirm_synthetic_cleanup().unwrap();
    assert_eq!(r.confirm_synthetic_cleanup().unwrap_err(), Error::Cleanup);
}
