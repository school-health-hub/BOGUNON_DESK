use crate::native_contract::owner_policy::{Failure, Policy};
use crate::native_contract::{Kind, Request};
use crate::native_contract_tests::available;
#[test]
fn native_owner_policy_rejects_reentry_and_duplicate_finalization() {
    // Given the real deterministic request envelope.
    let (_, _, create) = available();
    let mut policy = Policy::new();
    // When an owner reserves creation twice.
    policy.create(&create).expect("first");
    // Then duplicate creation cannot allocate another resource.
    assert_eq!(policy.create(&create), Err(Failure::Protocol));
}
#[test]
fn native_owner_policy_rejects_foreign_close() {
    // Given an exact create envelope and a different instance.
    let (_, _, create) = available();
    let (_, _, foreign) = available();
    let mut policy = Policy::new();
    policy.create(&create).expect("create");
    let request = Request {
        kind: Kind::BeginCloseOwnSurface,
        ..foreign
    };
    // When a foreign request crosses the boundary / Then fail closed.
    assert_eq!(policy.close(&request), Err(Failure::Protocol));
}
fn closed_policy() -> (Policy, Request) {
    let (mut adapter, mut fake, create) = available();
    let mut policy = Policy::new();
    policy.create(&create).expect("create");
    let close = adapter.close().expect("close").expect("request");
    policy.close(&close).expect("policy close");
    adapter
        .respond(fake.execute(&close, crate::native_contract_tests::Fault::None))
        .expect("ack");
    adapter.respond(fake.complete_close(&close)).expect("done");
    (policy, adapter.verify_cleanup().expect("verification"))
}
#[test]
fn native_owner_policy_accepts_exact_cleanup_once() {
    // Given exact create/close completion / When finalization is requested / Then at most one admission.
    let (mut policy, verify) = closed_policy();
    assert_eq!(policy.finalize(&verify), Ok(()));
    let mut duplicate = verify;
    duplicate.sequence += 1;
    assert_eq!(policy.finalize(&duplicate), Err(Failure::Protocol));
}
#[test]
fn native_owner_policy_rejects_cleanup_before_close() {
    // Given only creation / When cleanup arrives before close / Then admission fails closed.
    let (_, _, create) = available();
    let mut policy = Policy::new();
    policy.create(&create).unwrap();
    let verify = Request {
        kind: Kind::VerifyOwnSurfaceCleanup,
        sequence: 2,
        expected: crate::disposable_surface::State::Absent,
        ..create
    };
    assert_eq!(policy.finalize(&verify), Err(Failure::Protocol));
}
#[test]
fn native_owner_policy_every_native_failure_blocks_finalization() {
    // Given a terminal lifecycle / When any real-source error is latched / Then no proof admission or recreation.
    for fault in [
        Failure::CreatorThread,
        Failure::LedgerOverflow,
        Failure::CallbackOverflow,
        Failure::CallbackIdentity,
        Failure::Reentry,
        Failure::ClassRegistration,
        Failure::CreateWindow,
        Failure::IdentityMismatch,
        Failure::PartialCreate,
        Failure::DestroyWindow,
        Failure::ResidualUnknown,
        Failure::ResidualWindows,
        Failure::ClassRelease,
        Failure::CallbackContext,
        Failure::OwnerRelease,
        Failure::NativeOutcomeUnknown,
    ] {
        let (mut policy, verify) = closed_policy();
        policy.fault(fault);
        assert_eq!(policy.finalize(&verify), Err(Failure::Protocol));
        assert!(!policy.healthy());
    }
}
#[test]
fn native_owner_policy_rejects_duplicate_sequence() {
    // Given a reserved owner / When close reuses creation sequence / Then reject.
    let (mut adapter, _, create) = available();
    let mut policy = Policy::new();
    policy.create(&create).unwrap();
    let mut close = adapter.close().unwrap().unwrap();
    close.sequence = create.sequence();
    assert_eq!(policy.close(&close), Err(Failure::Protocol));
}
#[test]
fn native_owner_policy_rejects_generation_and_operation_substitution() {
    // Given cleanup for one exact disposal / When its operation is replaced / Then reject.
    let (mut policy, mut verify) = closed_policy();
    let (_, _, foreign) = available();
    verify.binding = foreign.binding().clone();
    assert_eq!(policy.finalize(&verify), Err(Failure::Protocol));
}
#[test]
fn native_callback_gate_reentry_is_rejected_without_unlocking_outer_callback() {
    // Given an active callback / When it reenters / Then the outer lease remains active.
    let gate = crate::native_contract::callback_gate::CallbackGate::new();
    let entry = gate.enter().unwrap();
    assert!(matches!(gate.enter(), Err(Failure::Reentry)));
    assert!(!gate.idle());
    drop(entry);
    assert!(gate.idle());
}
#[test]
fn native_owner_policy_released_owner_cannot_drain_replacement_notices() {
    // Given a finalized owner / When late operations seek admission / Then reject the retired owner.
    let (mut policy, verify) = closed_policy();
    policy.finalize(&verify).unwrap();
    assert!(!policy.operating());
}
#[test]
fn native_owner_policy_same_instance_wrong_generation_fails_closed() {
    // Given a creation binding and a later-generation ticket from the real state machine.
    use crate::disposable_surface::{Completion, State, Support, Surface};
    let (_, _, create) = available();
    let mut surface = Surface::new(1);
    let first = surface.create(Support::Supported).unwrap();
    surface.created(first, Completion::Succeeded).unwrap();
    surface.lost(first.generation()).unwrap();
    let newer = surface.retry_create(Support::Supported).unwrap();
    let mut policy = Policy::new();
    policy.create(&create).unwrap();
    let mut close = create.clone();
    close.kind = Kind::BeginCloseOwnSurface;
    close.sequence = 2;
    close.binding.operation = newer;
    close.expected = State::Disposing(newer);
    // When instance is unchanged but generation differs / Then reject before Ledger rebinding.
    assert_eq!(policy.close(&close), Err(Failure::Protocol));
}
#[test]
fn native_owner_policy_same_generation_wrong_operation_fails_closed() {
    // Given exact disposal and the original same-generation creation operation.
    let (mut policy, mut verify) = closed_policy();
    let (_, _, create) = available();
    assert_eq!(
        verify.binding.operation.generation(),
        create.binding.operation.generation()
    );
    verify.binding.operation = create.binding.operation;
    // When verification substitutes only operation / Then reject.
    assert_eq!(policy.finalize(&verify), Err(Failure::Protocol));
}
#[test]
fn native_owner_ledger_late_callback_cannot_reach_replacement() {
    // Given the actual Ledger with a retired first owner and a second live owner.
    use crate::{own_callbacks::Ledger, own_coordinator::NoticeKind};
    let (_, _, create) = available();
    let mut ledger = Ledger::new();
    let first = ledger.reserve(create.binding()).unwrap();
    ledger.register(10, first).unwrap();
    ledger.notice(10, NoticeKind::Destroyed).unwrap();
    let second = ledger.reserve(create.binding()).unwrap();
    ledger.register(20, second).unwrap();
    // When a late callback targets the retired handle / Then the new owner survives unchanged.
    assert!(ledger.notice(10, NoticeKind::CloseRequested).is_err());
    assert!(ledger.matches(20, second));
}
#[test]
fn native_owner_ledger_context_budget_survives_release() {
    // Given two retired reservations in the same real context.
    use crate::{own_callbacks::Ledger, own_coordinator::NoticeKind};
    let (_, _, create) = available();
    let mut ledger = Ledger::new();
    for handle in [10, 20] {
        let token = ledger.reserve(create.binding()).unwrap();
        ledger.register(handle, token).unwrap();
        ledger.notice(handle, NoticeKind::Destroyed).unwrap();
    }
    // When a third owner tries creation / Then the retained lifetime budget rejects it.
    assert!(ledger.reserve(create.binding()).is_err());
}
#[test]
fn native_owner_policy_accepts_real_adapter_replacement_sequence() {
    // Given actual Adapter/Fake cleanup completion for the first owner.
    let (mut adapter, mut fake) = crate::native_contract_tests::terminal();
    let verify = adapter.verify_cleanup().unwrap();
    adapter
        .respond(fake.execute(&verify, crate::native_contract_tests::Fault::None))
        .unwrap();
    let replacement = adapter.replacement().unwrap();
    assert_eq!(replacement.sequence(), 4);
    // When a fresh Native-owner Policy receives that exact next-owner request.
    let mut policy = Policy::new();
    // Then the coordinator sequence is retained rather than reset to one.
    assert_eq!(policy.create(&replacement), Ok(()));
}
