use crate::native_contract_tests::*;
#[test]
fn ownership_boundary_duplicate_finalization_cannot_mint_again() {
    // Given a completed owner with its exact pending verification request.
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("verify");
    let first = fake.execute(&request, Fault::None);
    assert!(matches!(first.outcome, Outcome::CleanupVerified(_)));
    // When a second envelope attempts to finalize that same owner.
    let mut repeated = request.clone();
    repeated.sequence += 1;
    let response = fake.execute(&repeated, Fault::None);
    // Then no second proof can be issued.
    assert!(!matches!(response.outcome, Outcome::CleanupVerified(_)));
}

#[test]
fn ownership_boundary_creation_receipt_is_immutable() {
    // Given a successful owner creation.
    let (mut a, mut f, create) = available();
    let receipt = f.owner().expect("owner").clone();
    // When the actual Ledger binds a distinct disposal operation.
    let close = a.close().expect("close").expect("request");
    a.respond(f.execute(&close, Fault::None)).expect("ack");
    // Then the creation operation and every creation observation remain unchanged.
    assert_ne!(create.binding(), close.binding());
    assert_eq!(f.owner(), Some(&receipt));
    assert_eq!(&receipt.creation().binding, create.binding());
}
#[test]
fn ownership_boundary_foreign_creation_receipt_is_rejected() {
    // Given an unrelated receipt with a foreign Surface binding.
    let (_, f, _) = available();
    let (mut a, _) = fixture();
    let request = a.create().expect("create");
    let before = a.inspect().clone();
    // When that receipt is substituted into the exact pending creation envelope.
    let result = a.respond(Response {
        request,
        outcome: Outcome::CreateSucceeded(f.owner().expect("owner").clone()),
    });
    // Then creation faults before availability and preserves Main.
    assert!(result.is_err());
    assert!(a.faulted());
    assert_eq!(a.inspect(), &before);
}
fn rejected(fault: Fault) {
    let (mut a, mut f) = terminal();
    let before = a.inspect().clone();
    let request = a.verify_cleanup().expect("exact pending verify");
    let response = f.execute(&request, fault);
    assert_eq!(response.request, request);
    assert!(a.respond(response).is_err());
    assert!(a.faulted());
    assert!(a.replacement().is_err());
    assert_eq!(a.inspect(), &before);
}
#[test]
fn ownership_boundary_thread_fails_closed() {
    // Given exact pending verification / When synthetic thread is observed / Then fail closed.
    rejected(Fault::Thread);
}
#[test]
fn ownership_boundary_token_fails_closed() {
    // Given exact pending verification / When synthetic token is observed / Then fail closed.
    rejected(Fault::Token);
}
#[test]
fn ownership_boundary_class_fails_closed() {
    // Given exact pending verification / When synthetic class is observed / Then fail closed.
    rejected(Fault::Class);
}
#[test]
fn ownership_boundary_pid_fails_closed() {
    // Given exact pending verification / When synthetic pid is observed / Then fail closed.
    rejected(Fault::Pid);
}
#[test]
fn ownership_boundary_tid_fails_closed() {
    // Given exact pending verification / When synthetic tid is observed / Then fail closed.
    rejected(Fault::Tid);
}
#[test]
fn ownership_boundary_foreign_owner_fails_closed() {
    // Given exact pending verification / When synthetic foreign_owner is observed / Then fail closed.
    rejected(Fault::Instance);
}
#[test]
fn ownership_boundary_destroy_failed_fails_closed() {
    // Given exact pending verification / When synthetic destroy_failed is observed / Then fail closed.
    rejected(Fault::Destroy);
}
#[test]
fn ownership_boundary_ledger_live_fails_closed() {
    // Given exact pending verification / When synthetic ledger_live is observed / Then fail closed.
    rejected(Fault::LedgerLive);
}
#[test]
fn ownership_boundary_residual_one_fails_closed() {
    // Given exact pending verification / When synthetic residual_one is observed / Then fail closed.
    rejected(Fault::RemainingNonzero);
}
#[test]
fn ownership_boundary_residual_missing_fails_closed() {
    // Given exact pending verification / When synthetic residual_missing is observed / Then fail closed.
    rejected(Fault::RemainingUnknown);
}
#[test]
fn ownership_boundary_class_release_failed_fails_closed() {
    // Given exact pending verification / When synthetic class_release_failed is observed / Then fail closed.
    rejected(Fault::ClassRelease);
}
#[test]
fn ownership_boundary_callback_context_remains_fails_closed() {
    // Given exact pending verification / When synthetic callback_context_remains is observed / Then fail closed.
    rejected(Fault::CallbackContext);
}
#[test]
fn ownership_boundary_owner_release_failed_fails_closed() {
    // Given exact pending verification / When synthetic owner_release_failed is observed / Then fail closed.
    rejected(Fault::Release);
}
#[test]
fn ownership_boundary_destroy_unknown_fails_closed() {
    // Given exact pending verification / When synthetic destroy_unknown is observed / Then fail closed.
    rejected(Fault::UnknownDestroy);
}
#[test]
fn ownership_boundary_ledger_unknown_fails_closed() {
    // Given exact pending verification / When synthetic ledger_unknown is observed / Then fail closed.
    rejected(Fault::UnknownLedger);
}
#[test]
fn ownership_boundary_class_release_unknown_fails_closed() {
    // Given exact pending verification / When synthetic class_release_unknown is observed / Then fail closed.
    rejected(Fault::UnknownClassRelease);
}
#[test]
fn ownership_boundary_callback_context_unknown_fails_closed() {
    // Given exact pending verification / When synthetic callback_context_unknown is observed / Then fail closed.
    rejected(Fault::UnknownCallbackContext);
}
#[test]
fn ownership_boundary_owner_release_unknown_fails_closed() {
    // Given exact pending verification / When synthetic owner_release_unknown is observed / Then fail closed.
    rejected(Fault::UnknownOwnerRelease);
}
#[test]
fn ownership_boundary_unknown_fails_closed() {
    // Given exact pending verification / When synthetic unknown is observed / Then fail closed.
    rejected(Fault::Unknown);
}

#[test]
fn ownership_boundary_normal_receipt_preserves_main_and_allows_replacement() {
    // Given an actual terminal Surface with unchanged authoritative Main.
    let (mut a, mut f) = terminal();
    let before = a.inspect().clone();
    let owner = f.owner().expect("owner").clone();
    let request = a.verify_cleanup().expect("verify");
    // When exact owner finalization is verified.
    let response = f.execute(&request, Fault::None);
    assert!(matches!(response.outcome, Outcome::CleanupVerified(_)));
    a.respond(response).expect("verified");
    // Then creation metadata remains immutable, Main equal and replacement explicit.
    assert_eq!(f.owner(), Some(&owner));
    assert_eq!(a.inspect(), &before);
    assert!(a.replacement().is_ok());
}
#[test]
fn ownership_boundary_partial_and_unknown_creation_never_attest_ownership() {
    for (fault, ownership) in [
        (
            Fault::PartialCreate,
            crate::native_contract::ownership_receipt::ResourceOwnership::Partial,
        ),
        (
            Fault::Unknown,
            crate::native_contract::ownership_receipt::ResourceOwnership::Unknown,
        ),
    ] {
        // Given / When a partial or unknown creation runs against the real Ledger.
        let (mut a, mut f) = fixture();
        let request = a.create().expect("create");
        let response = f.execute(&request, fault);
        // Then even retained metadata cannot authorize availability or replacement.
        assert_eq!(f.owner().expect("retained").creation().ownership, ownership);
        assert!(a.respond(response).is_err());
        assert!(a.replacement().is_err());
    }
}
#[test]
fn ownership_boundary_replacement_before_cleanup_is_rejected() {
    // Given / When / Then: terminal lifecycle alone never proves cleanup.
    let (mut a, _) = terminal();
    assert!(a.replacement().is_err());
}
#[test]
fn ownership_boundary_stale_operation_cannot_finalize_current_owner() {
    // Given exact pending verification and original creation operation.
    let (mut a, mut f, create) = available();
    let close = a.close().expect("close").expect("request");
    a.respond(f.execute(&close, Fault::None)).expect("ack");
    a.respond(f.complete_close(&close)).expect("closed");
    let request = a.verify_cleanup().expect("verify");
    let mut stale = request.clone();
    stale.binding.operation = create.binding().operation();
    // When stale operation observations are returned in the real pending envelope.
    let mut response = f.execute(&stale, Fault::None);
    response.request = request;
    // Then failure is outcome validation rather than envelope correlation.
    assert_eq!(
        a.respond(response),
        Err(crate::native_adapter::Error::Order)
    );
}
#[test]
fn ownership_boundary_stale_generation_cannot_rebind_creation_owner() {
    // Given a real generation-two ticket and generation-one owner.
    let (mut source, mut sf) = terminal();
    let verify = source.verify_cleanup().expect("verify");
    source
        .respond(sf.execute(&verify, Fault::None))
        .expect("clean");
    let generation_two = source.replacement().expect("replacement");
    let (mut a, mut f, _) = available();
    let request = a.close().expect("close").expect("request");
    let receipt = f.owner().expect("owner").clone();
    let mut stale = request.clone();
    stale.binding.operation = generation_two.binding().operation();
    stale.expected = State::Disposing(stale.binding.operation());
    // When close attempts to cross creation generation.
    let mut response = f.execute(&stale, Fault::None);
    response.request = request;
    // Then the exact current envelope fails closed and receipt stays unchanged.
    assert_eq!(
        a.respond(response),
        Err(crate::native_adapter::Error::Order)
    );
    assert_eq!(f.owner(), Some(&receipt));
}
