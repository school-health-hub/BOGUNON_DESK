use super::*;
fn binding() -> LiveBinding {
    LiveBinding {
        generation: 1,
        attempt: 2,
        host_creation: 3,
        host_pid: 4,
        host_thread: 12,
        host_session: 1,
        explorer_pid: 13,
        source_sha: [5; 20],
        surface: 6,
        explorer_creation: 7,
        sequence: 1,
        ledger_identity: 8,
        lease_identity: 9,
        explorer_generation: 7,
        surface_generation: 11,
    }
}
fn owner(b: LiveBinding) -> OwnerReservation {
    let attempt = Attempt::new(b.generation, b.attempt).unwrap();
    let mut ledger = Ledger::new(attempt);
    ledger
        .acquire(attempt, crate::ownership::Resource::Host, b.host_creation)
        .unwrap();
    ledger
        .acquire(attempt, crate::ownership::Resource::Window, b.surface)
        .unwrap();
    let lease = ledger
        .acquire_backend_registration(attempt, b.lease_identity)
        .unwrap();
    OwnerReservation {
        binding: b,
        ledger,
        lease,
    }
}
fn session() -> PreflightSession {
    PreflightSession::bind_owner(owner(binding()), Duration::from_secs(10)).unwrap()
}
fn observation(s: &PreflightSession) -> Observation {
    Observation {
        binding: binding(),
        provenance: Provenance::Fixture,
        ledger: s.ledger.identity(),
        captured: Duration::from_millis(1),
        worker: 77,
        identity_rechecked: true,
        topology_rechecked: true,
        same_dpi_context: true,
        state: WindowState {
            parent: 0,
            placement_flags: 0,
            placement_show: 1,
            placement_screen: false,
            position: [0, 0, 640, 480],
            placement: [0; 8],
            visible: true,
            style: 0,
            extended_style: 0,
            predecessor: None,
            monitor: 1,
            monitor_bounds: [0, 0, 1920, 1080],
            work: [0, 0, 1920, 1040],
            dpi: 96,
        },
    }
}
#[test]
fn fixture_and_os_observation_cannot_issue_live_permission() {
    for provenance in [Provenance::Fixture, Provenance::OsReadOnly] {
        let mut s = session();
        let mut o = observation(&s);
        o.provenance = provenance;
        let r = s.inspect_at(Some(&o), Duration::from_millis(2), 1);
        assert!(!r.execution_allowed);
        assert_eq!(
            r.blocker,
            if provenance == Provenance::Fixture {
                Blocker::FixtureOnly
            } else {
                Blocker::SeparateApprovalRequired
            }
        );
        assert_eq!(
            s.inspect_at(Some(&o), Duration::from_millis(3), 2).blocker,
            Blocker::Replay
        );
    }
}
#[test]
fn identity_ownership_stale_topology_dpi_and_recovery_fail_closed() {
    for case in 0..7 {
        let mut s = session();
        let mut o = observation(&s);
        match case {
            0 => o.binding.explorer_generation += 1,
            1 => o.binding.surface_generation += 1,
            2 => o.ledger = session().ledger.identity(),
            3 => o.identity_rechecked = false,
            4 => o.topology_rechecked = false,
            5 => o.same_dpi_context = false,
            _ => o.state.parent = 99,
        }
        let expected = match case {
            0 | 1 | 3 => Blocker::IdentityChanged,
            2 => Blocker::OwnershipChanged,
            4 => Blocker::TopologyChanged,
            5 => Blocker::MonitorDpiChanged,
            _ => Blocker::RecoveryUnproven,
        };
        assert_eq!(
            s.inspect_at(Some(&o), Duration::from_millis(2), 1).blocker,
            expected
        );
        assert_eq!(
            s.inspect_at(None, Duration::from_millis(3), 2).blocker,
            Blocker::CleanupUnknown
        );
    }
}
#[test]
fn expired_cancelled_and_host_exit_cannot_reenter() {
    let mut s = session();
    assert_eq!(
        s.inspect_at(None, Duration::from_secs(10), 1).blocker,
        Blocker::Expired
    );
    let mut s = session();
    s.cancel();
    assert_eq!(
        s.inspect_at(None, Duration::from_millis(1), 1).blocker,
        Blocker::Cancelled
    );
    s.host_lost();
    assert_eq!(
        s.inspect_at(None, Duration::from_millis(2), 2).blocker,
        Blocker::CleanupUnknown
    );
}
#[test]
fn missing_target_stale_future_and_replay_observations_are_denied() {
    let mut s = session();
    assert_eq!(
        s.inspect_at(None, Duration::from_millis(1), 1).blocker,
        Blocker::TargetMissing
    );
    assert_eq!(
        s.inspect_at(None, Duration::from_millis(2), 1).blocker,
        Blocker::Replay
    );
    for now in [Duration::ZERO, Duration::from_secs(1)] {
        let mut s = session();
        let o = observation(&s);
        assert_eq!(
            s.inspect_at(Some(&o), now, 1).blocker,
            Blocker::ObservationStale
        );
    }
}
#[test]
fn restored_fixture_and_process_exit_are_not_live_cleanup() {
    let mut s = session();
    let before = observation(&s);
    let mut attached = observation(&s);
    attached.captured = Duration::from_millis(2);
    attached.state.parent = 77;
    let mut after = observation(&s);
    after.captured = Duration::from_millis(3);
    assert_eq!(
        s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
        LiveVerdict::NotVerified
    );
    let mut s = session();
    let before = observation(&s);
    let mut attached = observation(&s);
    attached.captured = Duration::from_millis(2);
    attached.state.parent = 77;
    let mut after = observation(&s);
    after.captured = Duration::from_millis(3);
    after.state.dpi = 144;
    assert_eq!(
        s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
        LiveVerdict::CleanupUnknown
    );
    after.state.dpi = 96;
    assert_eq!(
        s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
        LiveVerdict::CleanupUnknown
    );
}

#[test]
fn released_lease_wrong_generation_and_monitor_dpi_receipt_block() {
    let mut s = session();
    let o = observation(&s);
    s.lease.release(s.attempt).unwrap();
    assert_eq!(
        s.inspect_at(Some(&o), Duration::from_millis(2), 1).blocker,
        Blocker::OwnershipChanged
    );
    let mut b = binding();
    b.explorer_generation += 1;
    assert!(PreflightSession::bind_owner(owner(b), Duration::from_secs(1)).is_err());
    let mut s = session();
    let before = observation(&s);
    let mut attached = observation(&s);
    attached.captured = Duration::from_millis(2);
    attached.state.parent = 77;
    let mut after = observation(&s);
    after.captured = Duration::from_millis(3);
    after.state.monitor = 2;
    assert_eq!(
        s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
        LiveVerdict::CleanupUnknown
    );
}

#[test]
fn transferred_owner_must_match_existing_ledger_and_lease() {
    let mut o = owner(binding());
    let foreign = owner(binding());
    o.lease = foreign.lease;
    assert!(matches!(
        PreflightSession::bind_owner(o, Duration::from_secs(1)),
        Err(Blocker::OwnershipChanged)
    ));
    let mut o = owner(binding());
    o.ledger
        .quarantine_release(
            Attempt::new(1, 2).unwrap(),
            crate::ownership::Resource::Window,
            6,
        )
        .unwrap();
    assert!(matches!(
        PreflightSession::bind_owner(o, Duration::from_secs(1)),
        Err(Blocker::OwnershipChanged)
    ));
}
#[test]
fn cleanup_replay_cancel_and_cross_session_are_sticky_unknown() {
    for case in 0..3 {
        let mut s = session();
        let before = observation(&s);
        let mut attached = observation(&s);
        attached.captured = Duration::from_millis(2);
        attached.state.parent = 77;
        let mut after = observation(&s);
        after.captured = Duration::from_millis(3);
        match case {
            0 => assert_eq!(
                s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
                LiveVerdict::NotVerified
            ),
            1 => s.cancel(),
            _ => after.binding.attempt += 1,
        }
        assert_eq!(
            s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
            LiveVerdict::CleanupUnknown
        );
        assert_eq!(
            s.inspect_at(None, Duration::from_millis(5), 1).blocker,
            Blocker::CleanupUnknown
        );
    }
}
#[test]
fn invalid_ttl_and_sequence_bounds_fail_before_any_authority() {
    for ttl in [Duration::ZERO, Duration::from_secs(31)] {
        assert!(PreflightSession::bind_owner(owner(binding()), ttl).is_err());
    }
    for seq in [0, u64::MAX] {
        let mut s = session();
        assert_eq!(
            s.inspect_at(None, Duration::from_millis(1), seq).blocker,
            Blocker::Replay
        );
    }
}

#[test]
fn complete_restored_state_and_evidence_freshness_are_required() {
    for case in 0..10 {
        let mut s = session();
        let before = observation(&s);
        let mut attached = observation(&s);
        attached.captured = Duration::from_millis(2);
        attached.state.parent = 77;
        let mut after = observation(&s);
        after.captured = Duration::from_millis(3);
        match case {
            0 => after.state.position[0] += 1,
            1 => after.state.visible = false,
            2 => after.state.style = 1,
            3 => after.state.predecessor = Some((10, 11, 12)),
            4 => after.state.placement[0] = 1,
            5 => after.state.placement_flags = 1,
            6 => after.state.placement_show = 2,
            7 => after.state.work[2] -= 1,
            8 => after.provenance = Provenance::OsReadOnly,
            _ => after.binding.source_sha = [9; 20],
        }
        assert_eq!(
            s.assess_cleanup_at(&before, &attached, &after, Duration::from_millis(4)),
            LiveVerdict::CleanupUnknown
        );
    }
    for now in [
        Duration::ZERO,
        Duration::from_secs(1),
        Duration::from_secs(11),
    ] {
        let mut s = session();
        let before = observation(&s);
        let mut attached = observation(&s);
        attached.captured = Duration::from_millis(2);
        attached.state.parent = 77;
        let mut after = observation(&s);
        after.captured = Duration::from_millis(3);
        assert_eq!(
            s.assess_cleanup_at(&before, &attached, &after, now),
            LiveVerdict::CleanupUnknown
        );
    }
}
