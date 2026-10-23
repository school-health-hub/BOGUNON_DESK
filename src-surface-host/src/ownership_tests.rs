use crate::{
    cleanup::{self, BrowserExitEvidence, CleanupUnknown, RuntimeIdentity},
    lifecycle::Attempt,
    ownership::{Ledger, OwnershipError, Resource},
    udf::DirectoryIdentity,
};

fn attempt() -> Attempt {
    Attempt::new(1, 2).unwrap()
}

#[test]
fn releases_only_exactly_owned_resources_once() {
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    assert_eq!(ledger.acquire(attempt, Resource::Window, 17), Ok(()));
    assert_eq!(
        ledger.release(attempt, Resource::Window, 18),
        Err(OwnershipError::WrongIdentity)
    );
    assert_eq!(ledger.release(attempt, Resource::Window, 17), Ok(()));
    assert_eq!(
        ledger.release(attempt, Resource::Window, 17),
        Err(OwnershipError::DuplicateRelease)
    );
    assert!(ledger.is_resolved());
}

#[test]
fn partial_creation_without_a_returned_handle_is_unresolved() {
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    assert_eq!(ledger.unresolved(attempt, Resource::Controller), Ok(()));
    assert!(!ledger.is_resolved());
    assert_eq!(
        ledger.release(attempt, Resource::Controller, 7),
        Err(OwnershipError::Unresolved)
    );
}

#[test]
fn failed_native_release_quarantines_owned_resource_and_blocks_receipt() {
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    assert_eq!(ledger.acquire(attempt, Resource::Window, 17), Ok(()));
    assert_eq!(
        ledger.quarantine_release(attempt, Resource::Window, 17),
        Ok(())
    );
    assert!(!ledger.is_resolved());
    assert_eq!(
        ledger.release(attempt, Resource::Window, 17),
        Err(OwnershipError::Unresolved)
    );
}

#[test]
fn backend_registration_lease_is_unique_and_drop_remains_fail_closed() {
    let attempt = attempt();
    let mut ledger = Ledger::new(attempt);
    let lease = ledger
        .acquire_backend_registration(attempt, 23)
        .unwrap_or_else(|error| panic!("first lease must be acquired: {error}"));
    assert!(matches!(
        ledger.acquire_backend_registration(attempt, 23),
        Err(OwnershipError::AlreadyRecorded)
    ));
    assert_eq!(
        ledger.release(attempt, Resource::BackendRegistration, 23),
        Err(OwnershipError::LeaseRequired)
    );
    drop(lease);
    assert!(!ledger.is_resolved());
    assert!(ledger.backend_registration_is_unresolved());

    let other = Ledger::new(attempt);
    let launch = crate::runtime_qa::RuntimeLaunchAuthority::for_test();
    let runtime = RuntimeIdentity::bind(
        &mut ledger,
        &launch,
        attempt,
        8,
        42,
        DirectoryIdentity { volume: 1, file: 3 },
    )
    .unwrap_or_else(|error| panic!("runtime authority must bind: {error}"));
    let exit = BrowserExitEvidence {
        attempt,
        environment: 8,
        browser_process_id: 42,
        normal_exit: true,
    };
    assert_eq!(
        cleanup::evaluate(false, &ledger, &runtime, Some(&exit)),
        Err(CleanupUnknown::ResourceReleaseIncomplete)
    );
    assert_eq!(
        cleanup::evaluate(false, &other, &runtime, Some(&exit)),
        Err(CleanupUnknown::LedgerMismatch)
    );
}
