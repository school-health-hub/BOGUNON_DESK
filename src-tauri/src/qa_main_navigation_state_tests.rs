use super::{Failure, Gate};
use std::time::{Duration, Instant};

fn completed_gate(now: Instant) -> Gate {
    let mut gate = Gate::new(now, Duration::from_secs(1));
    assert_eq!(gate.started(7, now), Ok(()));
    assert_eq!(gate.completed(7, true, now), Ok(()));
    gate
}

#[test]
fn timeout_when_pending_at_deadline() {
    // Given
    let now = Instant::now();
    let mut gate = Gate::new(now, Duration::from_secs(1));
    // When
    assert!(gate.expire(now + Duration::from_secs(1)));
    // Then
    assert!(!gate.waiting());
    assert_eq!(gate.started(7, now), Err(Failure::Timeout));
    assert_eq!(gate.remaining(now + Duration::from_secs(2)), Duration::ZERO);
}

#[test]
fn rejects_when_navigation_failed() {
    // Given
    let now = Instant::now();
    let mut gate = Gate::new(now, Duration::from_secs(1));
    assert_eq!(gate.started(7, now), Ok(()));
    // When
    assert_eq!(
        gate.completed(7, false, now),
        Err(Failure::NavigationFailed)
    );
    // Then
    assert_eq!(gate.claim(now, true, true), Err(Failure::NavigationFailed));
    assert!(!gate.can_start_host());
}

#[test]
fn rejects_when_origin_wrong() {
    // Given
    let now = Instant::now();
    let mut gate = completed_gate(now);
    // When
    assert_eq!(gate.claim(now, true, false), Err(Failure::UnexpectedOrigin));
    // Then
    assert_eq!(gate.finish(), Err(Failure::UnexpectedOrigin));
}

#[test]
fn rejects_when_identity_wrong() {
    // Given
    let now = Instant::now();
    let mut gate = completed_gate(now);
    // When
    assert_eq!(gate.claim(now, false, true), Err(Failure::IdentityMismatch));
    // Then
    assert!(!gate.can_start_host());
}

#[test]
fn closes_when_claim_duplicated() {
    // Given
    let now = Instant::now();
    let mut gate = completed_gate(now);
    assert_eq!(gate.claim(now, true, true), Ok(()));
    // When
    assert_eq!(gate.claim(now, true, true), Err(Failure::Duplicate));
    // Then
    assert_eq!(gate.finish(), Err(Failure::Duplicate));
    assert!(!gate.can_start_host());
}

#[test]
fn host_allowed_only_when_installation_finished() {
    // Given
    let now = Instant::now();
    let mut gate = completed_gate(now);
    assert!(gate.waiting());
    assert!(!gate.can_start_host());
    assert_eq!(gate.claim(now, true, true), Ok(()));
    assert!(!gate.waiting());
    assert!(!gate.expire(now + Duration::from_secs(1)));
    assert!(!gate.can_start_host());
    // When
    assert_eq!(gate.finish(), Ok(()));
    // Then
    assert!(gate.can_start_host());
    assert!(!gate.waiting());
}

#[test]
fn rejects_when_claim_precedes_completion() {
    // Given
    let now = Instant::now();
    let mut gate = Gate::new(now, Duration::from_secs(1));
    // When
    assert_eq!(gate.claim(now, true, true), Err(Failure::Duplicate));
    // Then
    assert!(!gate.can_start_host());
}

#[test]
fn redirects_allowed_but_changed_or_zero_ids_close_gate() {
    // Given
    let now = Instant::now();
    for id in [0, 8] {
        let mut gate = Gate::new(now, Duration::from_secs(1));
        assert_eq!(gate.started(7, now), Ok(()));
        assert_eq!(gate.started(7, now), Ok(()));
        // When
        assert_eq!(gate.started(id, now), Err(Failure::NavigationChanged));
        // Then
        assert!(!gate.can_start_host());
    }
}

#[test]
fn rejects_when_completion_stale_or_missing_start() {
    // Given
    let now = Instant::now();
    for start in [false, true] {
        let mut gate = Gate::new(now, Duration::from_secs(1));
        if start {
            assert_eq!(gate.started(7, now), Ok(()));
        }
        // When
        assert_eq!(
            gate.completed(8, true, now),
            Err(Failure::NavigationChanged)
        );
        // Then
        assert!(!gate.waiting());
    }
}

#[test]
fn rejects_when_completion_or_claim_late() {
    // Given
    let now = Instant::now();
    let late = now + Duration::from_secs(1);
    let mut gate = Gate::new(now, Duration::from_secs(1));
    assert_eq!(gate.started(7, now), Ok(()));
    let mut completed = completed_gate(now);
    // When
    assert_eq!(gate.completed(7, true, late), Err(Failure::Timeout));
    assert_eq!(completed.claim(late, true, true), Err(Failure::Timeout));
    // Then
    assert!(!gate.can_start_host());
    assert!(!completed.can_start_host());
}

#[test]
fn closes_when_completion_duplicated_or_navigation_restarts() {
    // Given
    let now = Instant::now();
    let mut gate = completed_gate(now);
    let mut restarted = completed_gate(now);
    // When
    assert_eq!(gate.completed(7, true, now), Err(Failure::Duplicate));
    assert_eq!(restarted.started(7, now), Err(Failure::Duplicate));
    // Then
    assert!(!gate.waiting());
    assert!(!restarted.waiting());
}

#[test]
fn first_failure_sticky_even_after_active() {
    // Given
    let now = Instant::now();
    for failure in [
        Failure::SubscribeFailed,
        Failure::UnsubscribeFailed,
        Failure::UrlUnavailable,
        Failure::ResourceMissing,
    ] {
        let mut gate = completed_gate(now);
        assert_eq!(gate.claim(now, true, true), Ok(()));
        assert_eq!(gate.finish(), Ok(()));
        // When
        assert!(gate.fail(failure));
        // Then
        assert!(!gate.fail(Failure::Timeout));
        assert_eq!(gate.finish(), Err(failure));
        assert!(!gate.can_start_host());
    }
}
