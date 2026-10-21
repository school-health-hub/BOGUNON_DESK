use super::*;
#[test]
fn reload_revokes_old_generation() {
    // Given an admitted lifetime.
    let mut state = Lifetime::new();
    let lease = state.snapshot().unwrap();
    // When a document starts loading.
    state.started("local".into());
    // Then the old generation is revoked.
    assert!(!state.current(&lease));
}
#[test]
fn completion_requires_matching_started_url() {
    // Given a pending document.
    let mut state = Lifetime::new();
    state.started("local".into());
    // When a different document completes.
    state.finished("other");
    // Then admission remains closed.
    assert!(state.snapshot().is_none());
}
#[test]
fn retirement_is_sticky() {
    // Given a retired lifetime.
    let mut state = Lifetime::new();
    state.retire();
    // When a local document starts and finishes.
    state.started("local".into());
    state.finished("local");
    // Then admission stays closed.
    assert!(state.snapshot().is_none());
}
#[test]
fn distinct_instances_reject_identical_generation() {
    // Given two Main instances.
    let first = Lifetime::new();
    let second = Lifetime::new();
    // When the first instance's lease is checked against the second.
    let admitted = second.current(&first.snapshot().unwrap());
    // Then it is rejected.
    assert!(!admitted);
}
#[test]
fn generation_overflow_retires() {
    // Given an exhausted generation counter.
    let mut state = Lifetime::new();
    state.generation = u64::MAX;
    // When a new document starts.
    state.started("local".into());
    // Then admission closes permanently.
    assert!(state.snapshot().is_none());
}
#[test]
fn reload_clears_channel_registration() {
    // Given a registered destination.
    let mut state = Lifetime::new();
    let lease = state.snapshot().unwrap();
    assert!(state.set_channel(&lease, Some(3)));
    // When a new document loads.
    state.started("local".into());
    state.finished("local");
    // Then the previous destination cannot validate.
    assert!(!state.channel_matches(&lease, Some(3)));
    assert!(state.channel_matches(&state.snapshot().unwrap(), None));
}
#[test]
fn navigation_request_revokes_before_started() {
    // Given an active generation.
    let mut state = Lifetime::new();
    let lease = state.snapshot().unwrap();
    // When navigation is requested.
    assert!(state.requested("local".into()));
    // Then admission and the previous lease are revoked immediately.
    assert!(!state.current(&lease));
    assert!(state.snapshot().is_none());
}
#[test]
fn requested_started_finished_admits_new_generation() {
    // Given a requested document and matching Started.
    let mut state = Lifetime::new();
    assert!(state.requested("local".into()));
    state.started("local".into());
    // When its matching Finished arrives.
    state.finished("local");
    // Then the new document can register a destination.
    assert!(state.snapshot().is_some());
}
#[test]
fn overlapping_navigation_retires() {
    // Given an outstanding navigation.
    let mut state = Lifetime::new();
    assert!(state.requested("local".into()));
    // When another navigation is requested.
    assert!(!state.requested("local".into()));
    // Then even completion cannot restore admission.
    state.started("local".into());
    state.finished("local");
    assert!(state.snapshot().is_none());
}

#[test]
fn finish_before_started_does_not_admit() {
    // Given a requested navigation.
    let mut state = Lifetime::new();
    assert!(state.requested("local".into()));
    // When Finished arrives without Started.
    state.finished("local");
    // Then admission remains closed.
    assert!(state.snapshot().is_none());
}
#[test]
fn duplicate_started_retires() {
    // Given a loading document.
    let mut state = Lifetime::new();
    state.started("local".into());
    // When another Started arrives.
    state.started("local".into());
    // Then late completion cannot reopen admission.
    state.finished("local");
    assert!(state.snapshot().is_none());
}

#[test]
fn trusted_started_admits_bootstrap_before_finished() {
    // Given a requested local document, old leases are revoked.
    let mut state = Lifetime::new();
    let old = state.snapshot().unwrap();
    assert!(state.requested("local".into()));
    assert!(state.snapshot().is_none());
    // When trusted Started precedes React initialization.
    state.started("local".into());
    // Then session restoration and Channel registration can run before Finished.
    let fresh = state
        .snapshot()
        .expect("trusted document bootstrap admission");
    assert!(!state.current(&old));
    assert!(state.set_channel(&fresh, Some(7)));
    assert!(!state.set_channel(&old, Some(8)));
}
