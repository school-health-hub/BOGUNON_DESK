use super::*;

#[test]
fn failure_cleanup_normal_owner() {
    // Given an available owner; When independently cleaned; Then no lifecycle success is inferred.
    let mut h = available();
    let report = h.failure_cleanup().unwrap();
    assert_eq!(report.cleanup, cleanup::Status::Succeeded);
    assert!(h.faulted());
    assert!(h.replacement().is_err());
}
#[test]
fn failure_cleanup_backend_fault_blocks_normal_verify_but_not_cleanup() {
    // Given a backend failure that leaves its owner retained.
    let mut h = available();
    h.backend.backend_fault = true;
    assert!(h.close().is_err());
    assert!(h.verify_cleanup().is_err());
    // When failure cleanup bypasses normal dispatch; Then retained resources can be cleaned.
    assert_eq!(
        h.failure_cleanup().unwrap().cleanup,
        cleanup::Status::Succeeded
    );
}
#[test]
fn failure_cleanup_stopped_host() {
    // Given a stopped host; When cleanup is requested; Then stop does not block resource cleanup.
    let mut h = available();
    h.stop().unwrap();
    assert_eq!(
        h.failure_cleanup().unwrap().cleanup,
        cleanup::Status::Succeeded
    );
}
#[test]
fn failure_cleanup_partial_create() {
    // Given partial creation with no successful receipt response.
    let mut h = fixture();
    h.backend.fault = Fault::PartialCreate;
    assert!(h.create().is_err());
    // When retained ownership is finalized; Then original failure and partial phase remain recorded.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(report.observation.resources, cleanup::Resources::Partial);
    assert_eq!(report.original, Some(Error::Unknown));
}
#[test]
fn failure_cleanup_unknown_create() {
    // Given unknown creation; When known resources are cleaned; Then initial uncertainty is retained.
    let mut h = fixture();
    h.backend.fault = Fault::Unknown;
    assert!(h.create().is_err());
    let report = h.failure_cleanup().unwrap();
    assert_eq!(report.observation.resources, cleanup::Resources::Unknown);
    assert_eq!(report.original, Some(Error::Unknown));
}
#[test]
fn failure_cleanup_before_create_confirms_no_resources() {
    // Given no creation request; When cleanup is requested; Then the fake reports its actual empty ledger.
    let mut h = fixture();
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.observation.resources,
        cleanup::Resources::NoResourcesConfirmed
    );
    assert_eq!(report.cleanup, cleanup::Status::Succeeded);
}
#[test]
fn failure_cleanup_duplicate_rejected() {
    // Given a consumed cleanup capability; When cleanup is repeated; Then no second attempt occurs.
    let mut h = available();
    h.failure_cleanup().unwrap();
    assert!(matches!(
        h.failure_cleanup(),
        Err(cleanup::Error::Duplicate)
    ));
}
#[test]
fn failure_cleanup_reentry_rejected_without_consuming_attempt() {
    // Given an active native call; When cleanup attempts to reenter; Then it is rejected.
    let mut h = available();
    h.entered = true;
    assert!(matches!(h.failure_cleanup(), Err(cleanup::Error::Reentry)));
    h.entered = false;
    assert!(h.failure_cleanup().is_ok());
}
#[test]
fn failure_cleanup_thread_mismatch() {
    // Given a creator thread identity mismatch; When cleanup starts; Then Native is never entered.
    let mut h = available();
    h.creator = std::thread::spawn(|| std::thread::current().id())
        .join()
        .unwrap();
    assert!(matches!(h.failure_cleanup(), Err(cleanup::Error::Thread)));
}
#[test]
fn failure_cleanup_preserves_first_failure() {
    // Given overflow followed by secondary normal-admission failures.
    let mut h = available();
    h.backend.overflow = true;
    assert_eq!(h.pump(16), Err(Error::Overflow));
    assert!(h.close().is_err());
    // When cleanup succeeds; Then the original failure stays Overflow.
    assert_eq!(h.failure_cleanup().unwrap().original, Some(Error::Overflow));
}
#[test]
fn failure_cleanup_unknown_residual_prioritized() {
    // Given unknown residual count; When cleanup returns; Then no success can be inferred.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::Residual);
    h.backend.cleanup_unknown = true;
    assert_eq!(
        h.failure_cleanup().unwrap().cleanup,
        cleanup::Status::Unknown(cleanup::Fact::Residual)
    );
}
#[test]
fn failure_cleanup_main_fields_preserved_on_failure() {
    // Given Main data, draft and authentication state; When cleanup fails; Then every authoritative field survives.
    let mut h = available();
    let before = h.inspect().clone();
    h.backend.cleanup_fault = Some(cleanup::Fact::Destroy);
    h.failure_cleanup().unwrap();
    assert_eq!(h.inspect(), &before);
}
#[test]
fn failure_cleanup_capability_cannot_cross_owners() {
    // Given a capability from one owner and another retained owner.
    let mut a = available();
    let mut b = available();
    let cap = a.backend.cleanup_capability().unwrap();
    // When the wrong backend receives it; Then identity mismatch prevents success.
    let report = b.backend.cleanup_failure(cap);
    assert_eq!(
        report.status(),
        cleanup::Status::Failed(cleanup::Fact::OwnerIdentity)
    );
}

#[test]
fn failure_cleanup_capability_rejection_records_both_results() {
    // Given an existing callback failure and unavailable capability.
    let mut h = available();
    h.backend.overflow = true;
    assert!(h.pump(16).is_err());
    h.backend.cleanup_issued = true;
    // When acquisition fails; Then both first failure and cleanup uncertainty survive.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(report.original, Some(Error::Overflow));
    assert_eq!(report.admission, Some(cleanup::Error::Duplicate));
    assert!(matches!(report.cleanup, cleanup::Status::Unknown(_)));
}
#[test]
fn failure_cleanup_protocol_error_is_preserved() {
    // Given an unavailable surface; When a close is attempted; Then protocol failure is retained.
    let mut h = fixture();
    assert!(h.close().is_err());
    assert_eq!(h.original_failure(), Some(Error::Protocol));
    assert_eq!(h.failure_cleanup().unwrap().original, Some(Error::Protocol));
}
#[test]
fn failure_cleanup_blocks_command_during_native_entry() {
    // Given cleanup's terminal admission and active native call; When command arrives; Then reentry rejects it.
    let mut h = available();
    h.stopped = true;
    h.entered = true;
    assert_eq!(h.close(), Err(Error::Reentry));
}
#[test]
fn failure_cleanup_blocks_replacement_during_native_entry() {
    // Given cleanup's terminal admission and active native call; When replacement arrives; Then reentry rejects it.
    let mut h = available();
    h.stopped = true;
    h.entered = true;
    assert_eq!(h.replacement(), Err(Error::Reentry));
}
