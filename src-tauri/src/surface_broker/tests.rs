use super::*;

struct Main(bool);

impl MainPresence for Main {
    fn existing_admitted_main(&self) -> bool {
        self.0
    }
}

fn run(
    broker: &mut Broker,
    sequence: u64,
    kind: RequestKind,
) -> Result<BrokerResponse, BrokerError> {
    let request = broker.binding().request(sequence, kind);
    let pending = broker.begin(request, &Main(true))?;
    broker.complete(pending, &Main(true))
}

#[test]
fn policy_accepts_only_the_two_registered_requests() {
    // Given the broker wire policy.
    let names = ["OpenMain", "RefreshProjection"];

    // When the registered names are parsed.
    let parsed = names.map(RequestKind::try_from);

    // Then exactly the approved operations are admitted and unknown operations fail closed.
    assert_eq!(parsed[0], Ok(RequestKind::OpenMain));
    assert_eq!(parsed[1], Ok(RequestKind::RefreshProjection));
    assert_eq!(RequestKind::OpenMain.wire_name(), names[0]);
    assert_eq!(
        RequestKind::try_from("ReadFinance"),
        Err(BrokerError::UnsupportedRequest)
    );
}

#[test]
fn open_main_returns_only_existing_main_intent() {
    // Given a registered Surface and an admitted existing Main.
    let mut broker = Broker::new();

    // When OpenMain is requested.
    let result = run(&mut broker, 1, RequestKind::OpenMain);

    // Then the broker returns only a show-existing-Main intent.
    assert_eq!(result, Ok(BrokerResponse::OpenExistingMain));
}

#[test]
fn open_main_rejects_when_main_is_missing() {
    // Given a registered Surface but no existing admitted Main.
    let mut broker = Broker::new();
    let request = broker.binding().request(1, RequestKind::OpenMain);

    // When OpenMain is requested.
    let result = broker.begin(request, &Main(false));

    // Then no Main creation intent is produced.
    assert_eq!(result.unwrap_err(), BrokerError::MainUnavailable);
}

#[test]
fn refresh_requires_a_revision_publication() {
    // Given no approved projection producer output.
    let mut broker = Broker::new();

    // When RefreshProjection is requested.
    let result = run(&mut broker, 1, RequestKind::RefreshProjection);

    // Then an unavailable error is returned instead of a zero default.
    assert_eq!(result, Err(BrokerError::ProjectionUnavailable));
}

#[test]
fn projection_schema_contains_only_revision() {
    // Given a revision published while Main is admitted.
    let mut broker = Broker::new();
    broker.publish_revision(7, &Main(true)).unwrap();

    // When the projection is refreshed.
    let result = run(&mut broker, 1, RequestKind::RefreshProjection);

    // Then the payload is exactly one revision-sized value with no business fields.
    assert_eq!(Projection::schema_fields(), &["revision"]);
    assert_eq!(
        std::mem::size_of::<Projection>(),
        std::mem::size_of::<u64>()
    );
    let revision = result.map(|response| match response {
        BrokerResponse::OpenExistingMain => 0,
        BrokerResponse::Projection(projection) => projection.revision(),
    });
    assert_eq!(revision, Ok(7));
}

#[test]
fn foreign_and_stale_generation_requests_are_rejected() {
    // Given a registered broker, a foreign binding and a stale generation binding.
    let mut broker = Broker::new();
    let foreign = Broker::new().binding();
    let stale = broker.binding().with_generation(0);

    // When either binding requests Main access.
    let foreign_result = broker.begin(foreign.request(1, RequestKind::OpenMain), &Main(true));
    let stale_result = broker.begin(stale.request(2, RequestKind::OpenMain), &Main(true));

    // Then both are rejected with distinct identity reasons.
    assert_eq!(
        foreign_result.unwrap_err(),
        BrokerError::UnregisteredSurface
    );
    assert_eq!(stale_result.unwrap_err(), BrokerError::StaleGeneration);
}

#[test]
fn duplicate_reordered_and_overflow_sequences_fail_closed() {
    // Given one accepted request sequence.
    let mut broker = Broker::new();
    run(&mut broker, 4, RequestKind::OpenMain).unwrap();

    // When duplicate, reordered and terminal sequences arrive.
    let duplicate = run(&mut broker, 4, RequestKind::OpenMain);
    let reordered = run(&mut broker, 3, RequestKind::OpenMain);
    let overflow = run(&mut broker, u64::MAX, RequestKind::OpenMain);

    // Then stale requests are rejected and overflow permanently closes admission.
    assert_eq!(duplicate, Err(BrokerError::StaleRequest));
    assert_eq!(reordered, Err(BrokerError::StaleRequest));
    assert_eq!(overflow, Err(BrokerError::SequenceOverflow));
    assert_eq!(broker.state(), RegistryState::FailedClosed);
    assert_eq!(
        run(&mut broker, 5, RequestKind::OpenMain),
        Err(BrokerError::SurfaceRetired)
    );
}

#[test]
fn main_retirement_invalidates_pending_and_future_requests() {
    // Given an admitted OpenMain request.
    let mut broker = Broker::new();
    let request = broker.binding().request(1, RequestKind::OpenMain);
    let pending = broker.begin(request, &Main(true)).unwrap();

    // When Main retires before completion.
    broker.retire_main().unwrap();

    // Then the pending and future requests cannot reach Main.
    assert_eq!(
        broker.complete(pending, &Main(true)),
        Err(BrokerError::MainUnavailable)
    );
    assert_eq!(
        run(&mut broker, 2, RequestKind::OpenMain),
        Err(BrokerError::MainUnavailable)
    );
}

#[test]
fn publication_invalidation_rejects_inflight_and_clears_display_data() {
    // Given a pending projection response.
    let mut broker = Broker::new();
    broker.publish_revision(1, &Main(true)).unwrap();
    let request = broker.binding().request(1, RequestKind::RefreshProjection);
    let pending = broker.begin(request, &Main(true)).unwrap();

    // When logout or navigation invalidates the publication.
    broker.invalidate_projection().unwrap();

    // Then in-flight delivery is fenced and no fallback projection is returned.
    assert_eq!(
        broker.complete(pending, &Main(true)),
        Err(BrokerError::StaleRequest)
    );
    assert_eq!(
        run(&mut broker, 2, RequestKind::RefreshProjection),
        Err(BrokerError::ProjectionUnavailable)
    );
}

#[test]
fn newer_request_rejects_older_pending_response() {
    // Given one pending OpenMain response.
    let mut broker = Broker::new();
    let first = broker.binding().request(1, RequestKind::OpenMain);
    let pending = broker.begin(first, &Main(true)).unwrap();

    // When a newer request is admitted.
    run(&mut broker, 2, RequestKind::OpenMain).unwrap();

    // Then the older response is stale.
    assert_eq!(
        broker.complete(pending, &Main(true)),
        Err(BrokerError::StaleRequest)
    );
}

#[test]
fn expired_lease_and_surface_retirement_reject_requests() {
    // Given separate active Surface brokers.
    let mut expired = Broker::new();
    let mut retired = Broker::new();

    // When their leases end through expiry or retirement.
    expired.expire_surface_lease();
    retired.retire_surface();

    // Then neither broker admits a request.
    assert_eq!(
        run(&mut expired, 1, RequestKind::OpenMain),
        Err(BrokerError::LeaseExpired)
    );
    assert_eq!(
        run(&mut retired, 1, RequestKind::OpenMain),
        Err(BrokerError::SurfaceRetired)
    );
}

#[test]
fn revisions_are_monotonic_across_invalidation() {
    // Given a previously published and then invalidated revision.
    let mut broker = Broker::new();
    broker.publish_revision(9, &Main(true)).unwrap();
    broker.invalidate_projection().unwrap();

    // When an equal or older revision is republished.
    let equal = broker.publish_revision(9, &Main(true));
    let older = broker.publish_revision(8, &Main(true));

    // Then both are rejected and a newer revision remains admissible.
    assert_eq!(equal, Err(BrokerError::StaleRevision));
    assert_eq!(older, Err(BrokerError::StaleRevision));
    assert_eq!(broker.publish_revision(10, &Main(true)), Ok(()));
}

#[test]
fn publication_overflow_fails_closed() {
    // Given a broker whose publication epoch cannot advance.
    let mut broker = Broker::new();
    broker.publication.force_epoch(u64::MAX);

    // When a projection is published.
    let result = broker.publish_revision(1, &Main(true));

    // Then the overflow is reported and all later Surface requests are rejected.
    assert_eq!(result, Err(BrokerError::PublicationOverflow));
    assert_eq!(broker.state(), RegistryState::FailedClosed);
    broker.expire_surface_lease();
    broker.retire_surface();
    assert_eq!(broker.state(), RegistryState::FailedClosed);
    assert_eq!(
        run(&mut broker, 1, RequestKind::OpenMain),
        Err(BrokerError::SurfaceRetired)
    );
}
