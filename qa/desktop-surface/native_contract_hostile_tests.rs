use super::native_contract_tests::*;
#[test]
fn native_contract_stale_cleanup_proof_cannot_advance_other_request() {
    // Given / When / Then: proof is tied to full verify envelope including sequence.
    let (mut a, mut f) = terminal();
    let r = a.verify_cleanup().expect("verify");
    let proof = f.execute(&r, Fault::None);
    let (mut b, _) = terminal();
    let current = b.verify_cleanup().expect("verify");
    assert!(b
        .respond(Response {
            request: current,
            outcome: proof.outcome
        })
        .is_err());
    assert!(b.faulted());
}
#[test]
fn native_contract_explicit_no_response_is_unknown() {
    // Given / When / Then: a caller supplies timeout/absence without any timer or fabricated result.
    let (mut a, _) = fixture();
    let r = a.create().expect("create");
    assert!(a
        .respond(Response {
            request: r.clone(),
            outcome: Outcome::NativeOutcomeUnknown
        })
        .is_err());
    assert!(a.faulted());
}
#[test]
fn native_contract_reentrant_request_fails_closed() {
    // Given / When / Then: a second outstanding request cannot replace pending correlation.
    let (mut a, _) = fixture();
    a.create().expect("create");
    assert!(a.create().is_err());
    assert!(a.faulted());
}
#[test]
fn native_contract_callback_overflow_uses_actual_ledger() {
    // Given an acknowledged close with the exact native request still pending.
    let (mut a, mut f, _) = available();
    let close = a.close().expect("close").expect("request");
    a.respond(f.execute(&close, Fault::None)).expect("ack");
    // When the actual Ledger rejects its seventeenth queued notice.
    let response = f.overflow_callbacks(&close);
    assert_eq!(response.outcome, Outcome::NativeOutcomeUnknown);
    // Then the correlated unknown outcome, rather than an envelope mismatch, faults.
    assert_eq!(
        a.respond(response),
        Err(crate::native_adapter::Error::Order)
    );
    assert!(a.faulted());
    assert!(a.replacement().is_err());
}
#[test]
fn native_contract_queue_overflow_uses_actual_async_queue() {
    // Given / When / Then: the ninth callback closes command acceptance permanently.
    let (mut a, _, r) = available();
    let before = a.inspect().clone();
    for sequence in 1..=8 {
        a.enqueue_callback(crate::surface_event_types::Event {
            binding: r.binding().clone(),
            sequence,
            action: crate::surface_event_types::Action::OpenMain,
        })
        .expect("bounded");
    }
    assert!(a
        .enqueue_callback(crate::surface_event_types::Event {
            binding: r.binding().clone(),
            sequence: 9,
            action: crate::surface_event_types::Action::OpenMain
        })
        .is_err());
    assert!(a.faulted());
    assert_eq!(a.inspect(), &before);
}
#[test]
fn native_contract_surface_lost_does_not_claim_cleanup() {
    // Given / When / Then: explicit loss is terminal but cannot authorize replacement.
    let (mut a, _) = fixture();
    let r = a.create().expect("create");
    a.respond(Response {
        request: r.clone(),
        outcome: Outcome::SurfaceLost,
    })
    .expect("loss");
    assert!(matches!(a.state(), State::Lost(_)));
    assert!(a.replacement().is_err());
}

#[test]
fn native_contract_owner_swap_proof_is_rejected() {
    // Given two independently allocated synthetic owners for the exact same request.
    let (mut a, mut f) = fixture();
    let mut foreign = Fake::new();
    let create = a.create().expect("create");
    a.respond(f.execute(&create, Fault::None)).expect("created");
    foreign.execute(&create, Fault::None);
    let close = a.close().expect("close").expect("request");
    a.respond(f.execute(&close, Fault::None)).expect("ack");
    foreign.execute(&close, Fault::None);
    a.respond(f.complete_close(&close)).expect("closed");
    foreign.complete_close(&close);
    let verify = a.verify_cleanup().expect("verify");
    // When the other owner's cleanup proof is substituted.
    let result = a.respond(foreign.execute(&verify, Fault::None));
    // Then owner identity, not just Surface binding, rejects the proof.
    assert!(result.is_err());
}

#[test]
fn native_contract_duplicate_close_while_creating_faults() {
    // Given / When / Then: deferred close admission is single use.
    let (mut a, _) = fixture();
    a.create().expect("create");
    a.close().expect("first close");
    assert!(a.close().is_err());
    assert!(a.faulted());
}
#[test]
fn native_contract_queued_callback_before_close_is_blocked() {
    // Given a queued own callback and a full Main snapshot.
    let (mut a, mut f, r) = available();
    let before = a.inspect().clone();
    a.enqueue_callback(crate::surface_event_types::Event {
        binding: r.binding().clone(),
        sequence: 1,
        action: crate::surface_event_types::Action::OpenMain,
    })
    .expect("queued");
    // When close is admitted ahead of processing that callback.
    let close = a.close().expect("close").expect("request");
    a.respond(f.execute(&close, Fault::None)).expect("ack");
    // Then command routing is closed and the actual close event reached Disposing.
    assert!(matches!(a.state(), State::Disposing(_)));
    assert_eq!(a.inspect(), &before);
}
#[test]
fn native_contract_available_loss_uses_exact_create_origin() {
    // Given / When / Then: spontaneous loss has an explicit correlated notice and preserves Main.
    let (mut a, _, r) = available();
    let before = a.inspect().clone();
    a.surface_lost(&r).expect("lost");
    assert!(matches!(a.state(), State::Lost(_)));
    assert_eq!(a.inspect(), &before);
}
#[test]
fn native_contract_callback_step_uses_actual_router() {
    // Given / When / Then: the bounded Async queue routes an actual own callback.
    let (mut a, _, r) = available();
    a.enqueue_callback(crate::surface_event_types::Event {
        binding: r.binding().clone(),
        sequence: 1,
        action: crate::surface_event_types::Action::OpenMain,
    })
    .expect("queued");
    assert_eq!(
        a.step_callback().expect("step"),
        crate::async_surface::SyntheticDecision::Command(
            crate::surface_event_types::Action::OpenMain
        )
    );
}
#[test]
fn native_contract_ledger_lifetime_budget_faults_on_third_create() {
    // Given two completed owner lifetimes using the same real Ledger.
    let (mut a, mut f) = terminal();
    for attempt in 0..2 {
        let verify = a.verify_cleanup().expect("verify");
        a.respond(f.execute(&verify, Fault::None))
            .expect("verified");
        let create = a.replacement().expect("replacement");
        let result = a.respond(f.execute(&create, Fault::None));
        if attempt == 0 {
            result.expect("second create");
            let close = a.close().expect("close").expect("request");
            a.respond(f.execute(&close, Fault::None)).expect("ack");
            a.respond(f.complete_close(&close)).expect("completed");
        } else {
            assert!(result.is_err());
            assert!(a.faulted());
        }
    }
}
#[test]
fn native_contract_commands_after_native_fault_are_closed() {
    // Given an actual Router-issued command for the current Surface binding.
    let (mut a, _, r) = available();
    let mut router = crate::surface_event_router::Router::new(
        crate::surface_event_types::MainState::new(1, 2, String::new()).projection(),
        1,
    );
    let own = router
        .create(crate::disposable_surface::Support::Supported)
        .expect("create");
    router
        .created(&own, crate::disposable_surface::Completion::Succeeded)
        .expect("created");
    let request = router
        .accept(crate::surface_event_types::Event {
            binding: own,
            sequence: 1,
            action: crate::surface_event_types::Action::OpenMain,
        })
        .expect("request");
    // When the native outcome becomes unknown.
    assert!(a
        .respond(Response {
            request: r.clone(),
            outcome: Outcome::NativeOutcomeUnknown
        })
        .is_err());
    // Then the adapter rejects commands before they can reach Main.
    assert_eq!(
        a.process(&request),
        Err(crate::native_adapter::Error::Faulted)
    );
    assert_eq!(
        a.enqueue_callback(crate::surface_event_types::Event {
            binding: r.binding().clone(),
            sequence: 1,
            action: crate::surface_event_types::Action::OpenMain
        }),
        Err(crate::native_adapter::Error::Faulted)
    );
}
