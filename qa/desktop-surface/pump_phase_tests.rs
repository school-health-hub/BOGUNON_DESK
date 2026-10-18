use super::*;
#[test]
fn c_before_a_is_rejected() {
    // Given no finalization; When stop requested; Then no C or admission.
    let (mut adapter, mut fake) = crate::native_contract_tests::terminal();
    let request = adapter.verify_cleanup().expect("request");
    let a = fake
        .observe_cleanup(&request, crate::native_contract_tests::Fault::None)
        .expect("A");
    let mut phase = Phase::new(a.owner().clone(), request.clone());
    assert_eq!(
        phase
            .stop(&envelope(&phase, 1), StopFacts::quiet())
            .unwrap_err(),
        Error::Order
    );
}
fn envelope(phase: &Phase, sequence: u64) -> Envelope {
    Envelope {
        owner: phase.owner.clone(),
        request: phase.request.clone(),
        sequence,
    }
}
fn pair() -> (Phase, FinalizationObservation, FinalDrainObservation) {
    let (mut adapter, mut fake) = crate::native_contract_tests::terminal();
    let request = adapter.verify_cleanup().expect("request");
    let a = fake
        .observe_cleanup(&request, crate::native_contract_tests::Fault::None)
        .expect("A");
    let facts = super::super::final_drain_contract::DrainFacts {
        current_thread: 7,
        owner_release: super::super::ownership_finalization::Confirmation::Confirmed,
        queue_quiet: super::super::ownership_finalization::Confirmation::Confirmed,
        overflow_clear: super::super::ownership_finalization::Confirmation::Confirmed,
        reentry_clear: super::super::ownership_finalization::Confirmation::Confirmed,
        budget_complete: super::super::ownership_finalization::Confirmation::Confirmed,
        outcome_known: super::super::ownership_finalization::Confirmation::Confirmed,
        scope: super::super::final_drain_contract::DrainScope::ObservableCallbackQueue,
    };
    let b = FinalDrainObservation::synthetic(&a, facts).expect("B");
    (Phase::new(a.owner().clone(), request), a, b)
}
fn pending() -> Phase {
    let (mut phase, a, b) = pair();
    phase
        .close_dispatch_admission(&envelope(&phase, 1))
        .expect("close admission");
    assert!(!phase.dispatch_allowed());
    assert!(phase.callback_delivery_allowed());
    phase
        .begin_finalization(&envelope(&phase, 2))
        .expect("finalizing");
    phase
        .observe_finalization(&envelope(&phase, 3), a)
        .expect("A");
    assert!(phase.callback_delivery_allowed());
    phase
        .observe_final_drain(&envelope(&phase, 4), b)
        .expect("B");
    assert!(!phase.callback_delivery_allowed());
    phase
}
#[test]
fn normal_a_b_c_admits_exact_request() {
    // Given A then B; When C and admission; Then exact integrated admission only.
    let mut phase = pending();
    let c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    let result = phase.admit(c).expect("ABC admission");
    assert!(result.matches(&phase.owner, &phase.request));
}
#[test]
fn c_before_b_is_rejected() {
    // Given A only; When C requested; Then order rejection.
    let (mut phase, a, _) = pair();
    phase
        .close_dispatch_admission(&envelope(&phase, 1))
        .expect("close");
    phase
        .begin_finalization(&envelope(&phase, 2))
        .expect("begin");
    phase
        .observe_finalization(&envelope(&phase, 3), a)
        .expect("A");
    assert_eq!(
        phase
            .stop(&envelope(&phase, 4), StopFacts::quiet())
            .unwrap_err(),
        Error::Order
    );
}
macro_rules! rejects_stop {
    ($name:ident, $field:ident, $value:expr, $error:expr) => {
        #[test]
        fn $name() {
            // Given valid A+B; When one stop condition fails; Then no C/admission.
            let mut phase = pending();
            let mut facts = StopFacts::quiet();
            facts.$field = $value;
            assert_eq!(phase.stop(&envelope(&phase, 5), facts).unwrap_err(), $error);
            assert!(phase.proof.is_none());
        }
    };
}
rejects_stop!(
    admission_open,
    admission_closed,
    false,
    Error::AdmissionOpen
);
rejects_stop!(dispatch_in_flight, in_flight, 1, Error::InFlight);
rejects_stop!(
    callback_pending,
    callback_delivery_complete,
    false,
    Error::CallbackPending
);
rejects_stop!(
    unexpected_quit,
    reason,
    StopReason::UnexpectedQuit,
    Error::UnexpectedQuit
);
rejects_stop!(budget_exceeded, budget, Check::Exceeded, Error::Budget);
rejects_stop!(
    deadline_exceeded,
    deadline,
    Check::Exceeded,
    Error::Deadline
);
rejects_stop!(pump_failure, reason, StopReason::PumpFailure, Error::Pump);
rejects_stop!(
    native_unknown,
    reason,
    StopReason::NativeUnknown,
    Error::NativeUnknown
);
rejects_stop!(
    cleanup_failure,
    reason,
    StopReason::CleanupFailure,
    Error::Cleanup
);
rejects_stop!(
    failure_cleanup_is_not_normal_proof,
    reason,
    StopReason::FailureCleanup,
    Error::FailureCleanup
);
rejects_stop!(budget_unknown, budget, Check::Unknown, Error::NativeUnknown);
rejects_stop!(
    deadline_unknown,
    deadline,
    Check::Unknown,
    Error::NativeUnknown
);

#[path = "pump_phase_edge_tests.rs"]
mod edges;
