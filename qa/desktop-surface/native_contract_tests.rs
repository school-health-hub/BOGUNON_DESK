pub(super) use crate::{
    disposable_surface::State,
    main_boundary_state::Authoritative,
    native_adapter::Adapter,
    native_contract::{
        verifier::fake::{Fake, Fault},
        Kind, Outcome, Request, Response,
    },
};
pub(super) fn fixture() -> (Adapter, Fake) {
    (Adapter::new(Authoritative::synthetic()), Fake::new())
}
pub(super) fn available() -> (Adapter, Fake, Request) {
    let (mut adapter, mut fake) = fixture();
    let create = adapter.create().expect("request");
    adapter
        .respond(fake.execute(&create, Fault::None))
        .expect("created");
    (adapter, fake, create)
}
pub(super) fn terminal() -> (Adapter, Fake) {
    let (mut adapter, mut fake, _) = available();
    let close = adapter.close().expect("close").expect("request");
    adapter
        .respond(fake.execute(&close, Fault::None))
        .expect("ack");
    adapter
        .respond(fake.complete_close(&close))
        .expect("closed");
    (adapter, fake)
}
#[test]
fn native_contract_create_request_when_absent() {
    // Given / When / Then: real model creation emits a typed envelope.
    let (mut adapter, _) = fixture();
    let request = adapter.create().expect("request");
    assert_eq!(request.kind(), Kind::CreateOwnSurface);
    assert_eq!(request.sequence(), 1);
    assert_eq!(request.expected(), adapter.state());
}
#[test]
fn native_contract_normal_create_close_cleanup() {
    // Given / When / Then: explicit staged close and verified cleanup preserve every Main field.
    let (mut adapter, mut fake) = terminal();
    let before = adapter.inspect().clone();
    let request = adapter.verify_cleanup().expect("verify");
    adapter
        .respond(fake.execute(&request, Fault::None))
        .expect("verified");
    assert_eq!(adapter.state(), State::Absent);
    assert_eq!(adapter.inspect(), &before);
    assert!(adapter.replacement().is_ok());
}
#[test]
fn native_contract_create_failed_is_explicit() {
    // Given / When / Then: failed create stays failed without synthesized cleanup.
    let (mut a, _) = fixture();
    let r = a.create().expect("create");
    a.respond(Response {
        request: r,
        outcome: Outcome::CreateFailed,
    })
    .expect("failure event");
    assert!(matches!(a.state(), State::Failed(..)));
    assert!(a.replacement().is_err());
}
#[test]
fn native_contract_partial_create_is_permanent_fault() {
    // Given / When / Then: partial native allocation cannot become ordinary failed creation.
    let (mut a, mut f) = fixture();
    let r = a.create().expect("create");
    let before = a.inspect().clone();
    assert!(a.respond(f.execute(&r, Fault::PartialCreate)).is_err());
    assert!(a.faulted());
    assert!(a.create().is_err());
    assert_eq!(a.inspect(), &before);
}
#[test]
fn native_contract_close_during_creation_defers_native_close() {
    // Given / When / Then: close blocks immediately while its native request waits for creation.
    let (mut a, mut f) = fixture();
    let r = a.create().expect("create");
    assert_eq!(a.close().expect("close"), None);
    let close = a
        .respond(f.execute(&r, Fault::None))
        .expect("created")
        .expect("deferred close");
    assert_eq!(close.kind(), Kind::BeginCloseOwnSurface);
    assert_eq!(close.sequence(), 2);
    assert!(matches!(a.state(), State::Disposing(_)));
}
#[test]
fn native_contract_ack_is_not_close_completion() {
    // Given / When / Then: native close acknowledgment leaves disposal pending.
    let (mut a, mut f, _) = available();
    let r = a.close().expect("close").expect("request");
    a.respond(f.execute(&r, Fault::None)).expect("ack");
    assert!(matches!(a.state(), State::Disposing(_)));
    assert!(a.verify_cleanup().is_err());
}
#[test]
fn native_contract_cleanup_hostile_observations_fail_closed() {
    // Given / When / Then: every hostile independently observed cleanup field rejects replacement.
    for fault in [
        Fault::Thread,
        Fault::Token,
        Fault::Class,
        Fault::Pid,
        Fault::Tid,
        Fault::Instance,
        Fault::Destroy,
        Fault::RemainingUnknown,
        Fault::RemainingNonzero,
        Fault::Release,
        Fault::Unknown,
    ] {
        let (mut a, mut f) = terminal();
        let before = a.inspect().clone();
        let r = a.verify_cleanup().expect("verify");
        assert!(a.respond(f.execute(&r, fault)).is_err());
        assert!(a.faulted());
        assert!(a.replacement().is_err());
        assert_eq!(a.inspect(), &before);
    }
}
#[test]
fn native_contract_duplicate_and_reverse_responses_fail_closed() {
    // Given / When / Then: duplicate or completed-before-started response never advances a new state.
    let (mut a, mut f, r) = available();
    assert!(a.respond(f.execute(&r, Fault::None)).is_err());
    assert!(a.faulted());
    let (mut a, _, _) = available();
    let r = a.close().expect("close").expect("request");
    assert!(a
        .respond(Response {
            request: r,
            outcome: Outcome::CloseCompleted
        })
        .is_err());
    assert!(a.faulted());
}
#[test]
fn native_contract_wrong_instance_generation_operation_sequence_fail_closed() {
    // Given / When / Then: each exact-envelope dimension is independently correlated.
    for dimension in 0..4 {
        let (mut a, _, _) = available();
        let r = a.close().expect("close").expect("request");
        let mut wrong = r.clone();
        match dimension {
            0 => {
                let (mut other, _) = fixture();
                wrong.binding = other.create().expect("other").binding().clone();
            }
            1 => {
                let (mut other, mut f) = terminal();
                let v = other.verify_cleanup().expect("verify");
                other.respond(f.execute(&v, Fault::None)).expect("verified");
                wrong.binding.operation = other
                    .replacement()
                    .expect("replacement")
                    .binding()
                    .operation();
                assert_eq!(wrong.binding.instance(), r.binding().instance());
                assert_ne!(
                    wrong.binding.operation().generation(),
                    r.binding().operation().generation()
                );
            }
            2 => {
                let (_, _, old) = available();
                wrong.binding.operation = old.binding().operation();
            }
            3 => wrong.sequence += 1,
            _ => unreachable!(),
        }
        assert!(a
            .respond(Response {
                request: wrong,
                outcome: Outcome::CloseStarted
            })
            .is_err());
        assert!(a.faulted());
    }
}
