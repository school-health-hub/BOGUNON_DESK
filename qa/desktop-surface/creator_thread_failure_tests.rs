use super::*;

#[test]
fn failure_cleanup_after_host_fault_preserves_main() {
    // Given a retained owner and a callback overflow fault.
    let mut h = available();
    let before = h.inspect().clone();
    h.backend.overflow = true;
    assert_eq!(h.pump(16), Err(Error::Overflow));
    assert!(h.close().is_err());
    // When failure cleanup bypasses only normal admission.
    let report = h.failure_cleanup().unwrap();
    // Then resources are observed independently and Main stays authoritative.
    assert_eq!(report.cleanup, cleanup::Status::Succeeded);
    assert_eq!(h.inspect(), &before);
    assert!(h.replacement().is_err());
}

#[test]
fn failure_cleanup_rejects_creator_thread() {
    // Given a retained owner with a failed creator_thread observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::CreatorThread);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::CreatorThread)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_owner_identity() {
    // Given a retained owner with a failed owner_identity observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::OwnerIdentity);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::OwnerIdentity)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_ledger_token() {
    // Given a retained owner with a failed ledger_token observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::LedgerToken);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::LedgerToken)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_destroy() {
    // Given a retained owner with a failed destroy observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::Destroy);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::Destroy)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_ledger_live() {
    // Given a retained owner with a failed ledger_live observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::Ledger);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::Ledger)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_residual_window() {
    // Given a retained owner with a failed residual_window observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::Residual);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::Residual)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_class_release() {
    // Given a retained owner with a failed class_release observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::ClassRelease);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::ClassRelease)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_callback_context() {
    // Given a retained owner with a failed callback_context observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::CallbackClear);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::CallbackClear)
    );
    assert!(h.create().is_err());
}

#[test]
fn failure_cleanup_rejects_owner_release() {
    // Given a retained owner with a failed owner_release observation.
    let mut h = available();
    h.backend.cleanup_fault = Some(cleanup::Fact::OwnerRelease);
    // When independently finalized; Then failure stays explicit and admission closed.
    let report = h.failure_cleanup().unwrap();
    assert_eq!(
        report.cleanup,
        cleanup::Status::Failed(cleanup::Fact::OwnerRelease)
    );
    assert!(h.create().is_err());
}

#[path = "creator_thread_failure_state_tests.rs"]
mod state_tests;
