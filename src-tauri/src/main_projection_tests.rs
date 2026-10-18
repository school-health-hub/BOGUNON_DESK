use super::*;

#[test]
fn publication_uses_current_main_lease() {
    // Given an admitted Main lifetime.
    let mut state = Lifetime::new();
    let lease = state.publisher_lease().unwrap();
    // When the producer publishes its revision.
    let approved = state.publish_projection(&lease, 1).unwrap();
    // Then the approved cache contains only that revision.
    assert_eq!(approved.revision(), 1);
    assert_eq!(state.projection(), Ok(approved));
}

#[test]
fn unavailable_without_a_producer() {
    // Given an admitted Main without a publication.
    let state = Lifetime::new();
    // When its projection is read.
    let result = state.projection();
    // Then no value is invented.
    assert_eq!(result, Err(ProjectionError::Unavailable));
}
#[test]
fn foreign_main_lease_cannot_publish() {
    // Given separate Main instances.
    let source = Lifetime::new();
    let mut target = Lifetime::new();
    let lease = source.publisher_lease().unwrap();
    // When the foreign lease publishes.
    let result = target.publish_projection(&lease, 1);
    // Then its authority is rejected.
    assert_eq!(result, Err(ProjectionError::StalePublisher));
    assert_eq!(target.projection(), Err(ProjectionError::Unavailable));
}
#[test]
fn failed_revision_preserves_last_good_publication() {
    for rejected in [8, 9] {
        // Given a published revision.
        let mut state = Lifetime::new();
        let lease = state.publisher_lease().unwrap();
        let approved = state.publish_projection(&lease, 9).unwrap();
        // When an older or duplicate revision arrives.
        let result = state.publish_projection(&lease, rejected);
        // Then the last good cache survives.
        assert_eq!(result, Err(ProjectionError::StaleRevision));
        assert_eq!(state.projection(), Ok(approved));
    }
}
#[test]
fn revocation_prevents_old_lease_revival_and_keeps_watermark() {
    for reason in [
        ProjectionRevocation::Logout,
        ProjectionRevocation::PermissionChanged,
    ] {
        // Given a publication and its publisher lease.
        let mut state = Lifetime::new();
        let old = state.publisher_lease().unwrap();
        state.publish_projection(&old, 9).unwrap();
        // When trust is revoked.
        state.revoke_projection(reason);
        // Then even a higher old-lease revision cannot restore the cache.
        assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
        assert_eq!(
            state.publish_projection(&old, 10),
            Err(ProjectionError::StalePublisher)
        );
        let fresh = state.publisher_lease().unwrap();
        assert_eq!(
            state.publish_projection(&fresh, 9),
            Err(ProjectionError::StaleRevision)
        );
        assert_eq!(state.publish_projection(&fresh, 10).unwrap().revision(), 10);
    }
}
#[test]
fn navigation_invalidates_publisher_and_clears_cache() {
    // Given an active projection.
    let mut state = Lifetime::new();
    let old = state.publisher_lease().unwrap();
    state.publish_projection(&old, 1).unwrap();
    // When navigation is requested before Started.
    assert!(state.requested("local".into()));
    // Then admission closes and the publication disappears immediately.
    assert!(matches!(
        state.publisher_lease(),
        Err(ProjectionError::Unavailable)
    ));
    assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
    state.started("local".into());
    assert_eq!(
        state.publish_projection(&old, 2),
        Err(ProjectionError::StalePublisher)
    );
    assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
}
#[test]
fn direct_started_clears_publication() {
    // Given an active projection.
    let mut state = Lifetime::new();
    let old = state.publisher_lease().unwrap();
    state.publish_projection(&old, 1).unwrap();
    // When a trusted document starts directly.
    state.started("local".into());
    // Then no old document publication remains.
    assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
    assert_eq!(
        state.publish_projection(&old, 2),
        Err(ProjectionError::StalePublisher)
    );
}
#[test]
fn retirement_closes_publisher_and_clears_publication() {
    // Given an active projection.
    let mut state = Lifetime::new();
    let lease = state.publisher_lease().unwrap();
    state.publish_projection(&lease, 1).unwrap();
    // When the Main instance is lost.
    state.retire();
    // Then neither reads nor publishers remain available.
    assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
    assert!(matches!(
        state.publisher_lease(),
        Err(ProjectionError::Unavailable)
    ));
    assert_eq!(
        state.publish_projection(&lease, 2),
        Err(ProjectionError::StalePublisher)
    );
}
#[test]
fn epoch_overflow_closes_only_publisher() {
    // Given an exhausted publisher epoch and an ordinary Main generation.
    let mut state = Lifetime::new();
    state.projection.epoch = Some(u64::MAX);
    let lease = state.publisher_lease().unwrap();
    let main = state.snapshot().unwrap();
    state.publish_projection(&lease, 1).unwrap();
    // When the projection is revoked.
    state.revoke_projection(ProjectionRevocation::Logout);
    // Then Main command admission survives while publisher authority is closed.
    assert!(state.current(&main));
    assert!(matches!(
        state.publisher_lease(),
        Err(ProjectionError::PublisherClosed)
    ));
    assert_eq!(
        state.publish_projection(&lease, 2),
        Err(ProjectionError::PublisherClosed)
    );
    assert_eq!(state.projection(), Err(ProjectionError::Unavailable));
}
#[test]
fn stale_publisher_cannot_replace_last_good_cache() {
    // Given a foreign publisher and an existing good publication.
    let foreign = Lifetime::new().publisher_lease().unwrap();
    let mut state = Lifetime::new();
    let lease = state.publisher_lease().unwrap();
    let good = state.publish_projection(&lease, 1).unwrap();
    // When the foreign publisher submits a newer revision.
    let result = state.publish_projection(&foreign, 100);
    // Then both the cache and watermark remain unchanged.
    assert_eq!(result, Err(ProjectionError::StalePublisher));
    assert_eq!(state.projection(), Ok(good));
    assert_eq!(state.publish_projection(&lease, 2).unwrap().revision(), 2);
}
