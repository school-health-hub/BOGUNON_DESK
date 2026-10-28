use crate::{
    cleanup::{self, CleanupUnknown},
    ownership::{Ledger, OwnershipError, Resource},
    renderer_session::{
        HandlerKind, HandlerState, RendererSession, RendererSessionError, SessionCleanup,
        SessionOwnership,
    },
    renderer_session_test_support::{
        attempt, fixture, handlers, register, runtime, AddScenario, FakeRegistry,
    },
};
use std::{
    panic::{catch_unwind, AssertUnwindSafe},
    thread,
};

#[test]
fn rolled_back_add_changes_no_ownership() {
    let registry = FakeRegistry {
        add_scenario: Some((HandlerKind::FrameCreated, AddScenario::NativeAddFailed)),
        ..FakeRegistry::default()
    };
    let (mut session, ledger) = fixture(registry);
    assert_eq!(
        session.register(HandlerKind::FrameCreated),
        Err(RendererSessionError::NativeAddRolledBack)
    );
    assert_eq!(
        session.state(HandlerKind::FrameCreated),
        HandlerState::Unregistered
    );
    assert!(!ledger.is_resolved());
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    assert!(ledger.is_resolved());
}

#[test]
fn unresolved_add_quarantines_session_and_blocks_receipt() {
    let registry = FakeRegistry {
        add_scenario: Some((HandlerKind::FrameCreated, AddScenario::RollbackFailed)),
        ..FakeRegistry::default()
    };
    let (mut session, mut ledger) = fixture(registry);
    assert_eq!(
        session.register(HandlerKind::FrameCreated),
        Err(RendererSessionError::NativeAddUnresolved)
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Unresolved));
    let (runtime, exit) = runtime(&mut ledger);
    assert_eq!(
        cleanup::evaluate(false, &ledger, &runtime, Some(&exit)),
        Err(CleanupUnknown::ResourceReleaseIncomplete)
    );
}

#[test]
fn panic_after_native_add_is_quarantined_and_blocks_receipt() {
    let registry = FakeRegistry {
        panic_on_add: Some(HandlerKind::FrameCreated),
        ..FakeRegistry::default()
    };
    let (mut session, mut ledger) = fixture(registry);
    assert_eq!(
        session.register(HandlerKind::FrameCreated),
        Err(RendererSessionError::NativeAddPanicked)
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Unresolved));
    let (runtime, exit) = runtime(&mut ledger);
    assert_eq!(
        cleanup::evaluate(false, &ledger, &runtime, Some(&exit)),
        Err(CleanupUnknown::ResourceReleaseIncomplete)
    );
}

#[test]
fn duplicate_and_closed_registration_do_not_call_native_add() {
    let (mut session, _ledger) = fixture(FakeRegistry::default());
    assert_eq!(session.register(HandlerKind::NavigationStarting), Ok(()));
    assert_eq!(
        session.register(HandlerKind::NavigationStarting),
        Err(RendererSessionError::HandlerAlreadyRecorded)
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    assert_eq!(
        session.register(HandlerKind::FrameCreated),
        Err(RendererSessionError::SessionClosed)
    );
    assert_eq!(session.registry().adds, [HandlerKind::NavigationStarting]);
}

#[test]
fn ledger_identity_and_lease_block_cleanup_substitution() {
    let (mut session, mut ledger) = fixture(FakeRegistry::default());
    assert_eq!(
        ledger.release(attempt(), Resource::BackendRegistration, 23),
        Err(OwnershipError::LeaseRequired)
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    let different = Ledger::new(attempt());
    let (runtime, exit) = runtime(&mut ledger);
    assert_eq!(
        cleanup::evaluate(false, &different, &runtime, Some(&exit)),
        Err(CleanupUnknown::LedgerMismatch)
    );
}

#[test]
fn cleanup_uses_actual_reverse_registration_order() {
    let (mut session, ledger) = fixture(FakeRegistry::default());
    let order = [
        HandlerKind::FrameCreated,
        HandlerKind::NavigationStarting,
        HandlerKind::WebMessageReceived,
        HandlerKind::WebResourceResponseReceived,
    ];
    register(&mut session, &order);
    assert_eq!(
        session.state(HandlerKind::FrameCreated),
        HandlerState::Registered
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    assert!(ledger.is_resolved());
    assert_eq!(
        session.registry().removes,
        [
            HandlerKind::WebResourceResponseReceived,
            HandlerKind::WebMessageReceived,
            HandlerKind::NavigationStarting,
            HandlerKind::FrameCreated
        ]
    );
}

#[test]
fn every_remove_position_failure_remains_unresolved() {
    for failed in [
        HandlerKind::NavigationStarting,
        HandlerKind::NewWindowRequested,
        HandlerKind::WebResourceResponseReceived,
    ] {
        let registry = FakeRegistry {
            remove_failure: Some(failed),
            ..FakeRegistry::default()
        };
        let (mut session, ledger) = fixture(registry);
        register(&mut session, &handlers());
        assert_eq!(session.cleanup(), Ok(SessionCleanup::Unresolved));
        assert_eq!(session.state(failed), HandlerState::Unresolved);
        assert!(!ledger.is_resolved());
    }
}

#[test]
fn remove_panic_remains_fail_closed_and_is_not_retried() {
    let registry = FakeRegistry {
        panic_on_remove: Some(HandlerKind::FrameCreated),
        ..FakeRegistry::default()
    };
    let (mut session, mut ledger) = fixture(registry);
    register(
        &mut session,
        &[
            HandlerKind::NavigationStarting,
            HandlerKind::FrameCreated,
            HandlerKind::WebMessageReceived,
        ],
    );
    let panic = catch_unwind(AssertUnwindSafe(|| session.cleanup()));
    assert!(panic.is_err());
    assert_eq!(
        session.state(HandlerKind::WebMessageReceived),
        HandlerState::Released
    );
    assert_eq!(
        session.state(HandlerKind::FrameCreated),
        HandlerState::ReleaseAttempted
    );
    assert_eq!(
        session.state(HandlerKind::NavigationStarting),
        HandlerState::Registered
    );
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Unresolved));
    assert_eq!(
        session.registry().removes,
        [
            HandlerKind::WebMessageReceived,
            HandlerKind::FrameCreated,
            HandlerKind::NavigationStarting
        ]
    );
    assert!(!ledger.is_resolved());
    let (runtime, exit) = runtime(&mut ledger);
    assert_eq!(
        cleanup::evaluate(false, &ledger, &runtime, Some(&exit)),
        Err(CleanupUnknown::ResourceReleaseIncomplete)
    );
}

#[test]
fn duplicate_cleanup_does_not_repeat_native_remove() {
    let (mut session, _ledger) = fixture(FakeRegistry::default());
    register(&mut session, &handlers()[..2]);
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    assert_eq!(session.cleanup(), Ok(SessionCleanup::Released));
    assert_eq!(session.registry().removes.len(), 2);
}

#[test]
fn drop_cannot_turn_cleanup_into_success() {
    let (runtime, exit, ledger) = {
        let (mut session, mut ledger) = fixture(FakeRegistry::default());
        register(&mut session, &[HandlerKind::NavigationStarting]);
        let (runtime, exit) = runtime(&mut ledger);
        drop(session);
        (runtime, exit, ledger)
    };
    assert_eq!(
        cleanup::evaluate(false, &ledger, &runtime, Some(&exit)),
        Err(CleanupUnknown::ResourceReleaseIncomplete)
    );
}

#[test]
fn wrong_thread_blocks_native_add_and_quarantines_on_drop() {
    let owner = thread::spawn(|| thread::current().id())
        .join()
        .unwrap_or_else(|_| panic!("thread fixture must join"));
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    let mut session = RendererSession::begin_on_thread(
        FakeRegistry::default(),
        &mut ledger,
        SessionOwnership::new(attempt, 23),
        owner,
    )
    .unwrap_or_else(|error| panic!("fixture session must begin: {error}"));
    assert_eq!(
        session.register(HandlerKind::NavigationStarting),
        Err(RendererSessionError::WrongThread)
    );
    assert!(session.registry().adds.is_empty());
    drop(session);
    assert!(!ledger.is_resolved());
}

#[test]
fn wrong_thread_cleanup_never_calls_native_remove() {
    let (mut session, ledger) = fixture(FakeRegistry::default());
    assert_eq!(session.register(HandlerKind::NavigationStarting), Ok(()));
    let other = thread::spawn(|| thread::current().id())
        .join()
        .unwrap_or_else(|_| panic!("thread fixture must join"));
    session.set_creator_thread(other);
    assert_eq!(session.cleanup(), Err(RendererSessionError::WrongThread));
    assert!(session.registry().removes.is_empty());
    drop(session);
    assert!(!ledger.is_resolved());
}
