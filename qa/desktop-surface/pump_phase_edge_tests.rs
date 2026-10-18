use super::*;
#[test]
fn owner_mismatch_is_terminal() {
    // Given another owner; When transition attempted; Then sticky owner failure.
    let mut phase = pending();
    let other = pending();
    let mut input = envelope(&phase, 5);
    input.owner = other.owner;
    assert_eq!(
        phase.stop(&input, StopFacts::quiet()).unwrap_err(),
        Error::Owner
    );
    assert!(!phase.dispatch_allowed());
}
#[test]
fn operation_mismatch_is_terminal() {
    // Given creation operation in cleanup request; When stop requested; Then reject.
    let mut phase = pending();
    let mut input = envelope(&phase, 5);
    input.request.binding.operation = phase.owner.creation().binding.operation();
    assert_eq!(
        phase.stop(&input, StopFacts::quiet()).unwrap_err(),
        Error::Request
    );
}
#[test]
fn request_sequence_mismatch_is_terminal() {
    // Given another native request; When stop requested; Then exact request rejects.
    let mut phase = pending();
    let mut input = envelope(&phase, 5);
    input.request.sequence += 1;
    assert_eq!(
        phase.stop(&input, StopFacts::quiet()).unwrap_err(),
        Error::Request
    );
}
#[test]
fn phase_sequence_duplicate_is_terminal() {
    // Given four completed transitions; When sequence four repeats; Then fail closed.
    let mut phase = pending();
    assert_eq!(
        phase
            .stop(&envelope(&phase, 4), StopFacts::quiet())
            .unwrap_err(),
        Error::Sequence
    );
}
#[test]
fn duplicate_c_revokes_admission() {
    // Given C issued once; When second stop attempted; Then first C cannot admit.
    let mut phase = pending();
    let c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    assert!(phase
        .stop(&envelope(&phase, 6), StopFacts::quiet())
        .is_err());
    assert!(phase.admit(c).is_err());
}
#[test]
fn stale_c_from_other_phase_rejected() {
    // Given separate phases; When a C crosses phase identity; Then no replacement admission.
    let mut first = pending();
    let c = first
        .stop(&envelope(&first, 5), StopFacts::quiet())
        .expect("C");
    let mut second = pending();
    let _own_c = second
        .stop(&envelope(&second, 5), StopFacts::quiet())
        .expect("own C");
    assert!(second.admit(c).is_err());
}
#[test]
fn original_failure_survives_cleanup_and_stop_errors() {
    // Given lifecycle failure; When cleanup success is modeled then stop attempted; Then original persists.
    let mut phase = pending();
    phase.record_failure(Error::Pump);
    phase.record_failure(Error::FailureCleanup);
    assert!(phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .is_err());
    assert_eq!(phase.original_failure(), Some(Error::Pump));
    assert!(!phase.dispatch_allowed());
}
#[test]
fn mismatched_b_does_not_admit() {
    // Given A and B from different owners; When B delivered; Then cleanup failure.
    let (mut phase, a, _) = pair();
    let (_, _, b) = pair();
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
        phase.observe_final_drain(&envelope(&phase, 4), b),
        Err(Error::Cleanup)
    );
}
#[test]
fn sequence_overflow_cannot_wrap() {
    // Given exhausted sequence; When zero arrives; Then fail closed.
    let mut phase = pending();
    phase.sequence = u64::MAX;
    assert_eq!(
        phase
            .stop(&envelope(&phase, 0), StopFacts::quiet())
            .unwrap_err(),
        Error::Sequence
    );
}
#[test]
fn same_owner_c_stamp_mismatch_rejected() {
    // Given matching owner/request; When C phase stamp differs; Then no admission.
    let mut phase = pending();
    let mut c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    c.stamp = Rc::new(());
    assert!(phase.admit(c).is_err());
}
#[test]
fn c_operation_mismatch_rejected() {
    // Given valid C; When its request operation changes; Then no admission.
    let mut phase = pending();
    let mut c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    c.request.binding.operation = phase.owner.creation().binding.operation();
    assert!(phase.admit(c).is_err());
}
#[test]
fn c_generation_mismatch_rejected() {
    // Given generation-two replacement; When substituted into C; Then reject.
    let (mut adapter, mut fake) = crate::native_contract_tests::terminal();
    let cleanup = adapter.verify_cleanup().expect("cleanup");
    adapter
        .respond(fake.execute(&cleanup, crate::native_contract_tests::Fault::None))
        .expect("legacy cleanup");
    let replacement = adapter.replacement().expect("replacement");
    let mut phase = pending();
    let mut c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    c.request.binding.operation = replacement.binding().operation();
    assert!(phase.admit(c).is_err());
}
#[test]
fn invalid_initial_request_never_opens_dispatch() {
    // Given a creation operation rather than cleanup; When Phase constructed; Then admission closed.
    let (phase, _, _) = pair();
    let mut request = phase.request.clone();
    request.kind = super::super::super::Kind::CreateOwnSurface;
    let invalid = Phase::new(phase.owner.clone(), request);
    assert_eq!(invalid.state(), State::Failed);
    assert!(!invalid.dispatch_allowed());
}
#[test]
fn unknown_is_sticky_after_later_error() {
    // Given native unknown; When later operation fails; Then unknown remains and original retained.
    let mut phase = pending();
    phase.record_failure(Error::NativeUnknown);
    phase.record_failure(Error::Order);
    assert_eq!(phase.state(), State::Unknown);
    assert_eq!(phase.original_failure(), Some(Error::NativeUnknown));
}
#[test]
fn same_owner_altered_a_request_is_rejected() {
    // Given A belonging to another exact request; When observed; Then no normal completion.
    let (mut phase, a, _) = pair();
    phase.request.sequence += 1;
    phase
        .close_dispatch_admission(&envelope(&phase, 1))
        .expect("close");
    phase
        .begin_finalization(&envelope(&phase, 2))
        .expect("begin");
    assert_eq!(
        phase.observe_finalization(&envelope(&phase, 3), a),
        Err(Error::Request)
    );
}
#[test]
fn initial_creation_ticket_is_not_cleanup_ticket() {
    // Given original creation operation; When phase seeded; Then no dispatch admission.
    let (phase, _, _) = pair();
    let mut request = phase.request.clone();
    request.binding.operation = phase.owner.creation().binding.operation();
    assert!(!Phase::new(phase.owner.clone(), request).dispatch_allowed());
}
#[test]
fn c_owner_mismatch_is_rejected() {
    // Given C with another owner receipt; When admission attempted; Then no replacement.
    let mut phase = pending();
    let other = pending();
    let mut c = phase
        .stop(&envelope(&phase, 5), StopFacts::quiet())
        .expect("C");
    c.owner = other.owner;
    assert!(phase.admit(c).is_err());
}
