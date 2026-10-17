use super::*;
use crate::native_contract_tests::{terminal, Fault};
fn observation() -> FinalizationObservation {
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("cleanup request");
    fake.observe_cleanup(&request, Fault::None)
        .expect("finalization")
}
fn quiet() -> DrainFacts {
    DrainFacts {
        current_thread: 7,
        owner_release: Confirmation::Confirmed,
        queue_quiet: Confirmation::Confirmed,
        overflow_clear: Confirmation::Confirmed,
        reentry_clear: Confirmation::Confirmed,
        budget_complete: Confirmation::Confirmed,
        outcome_known: Confirmation::Confirmed,
        scope: DrainScope::ObservableCallbackQueue,
    }
}
#[test]
fn normal_finalization_drain_proof() {
    // Given finalized Synthetic ownership; When drain then verifier run; Then exact proof.
    let a = observation();
    let request = a.request().clone();
    let owner = a.owner().clone();
    let b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    assert!(verify_final_drain(a, b)
        .expect("proof")
        .matches(&request, &owner));
}
#[test]
fn duplicate_final_drain_rejected() {
    // Given a consumed drain admission; When requested again; Then duplicate is terminal.
    let a = observation();
    let _b = FinalDrainObservation::synthetic(&a, quiet()).expect("first");
    assert_eq!(
        FinalDrainObservation::synthetic(&a, quiet()).unwrap_err(),
        DrainError::Duplicate
    );
}
#[test]
fn failed_final_drain_cannot_be_retried() {
    // Given one failed drain attempt; When retried with quiet facts; Then admission stays closed.
    let a = observation();
    let mut facts = quiet();
    facts.outcome_known = Confirmation::Unknown;
    assert!(FinalDrainObservation::synthetic(&a, facts).is_err());
    assert_eq!(
        FinalDrainObservation::synthetic(&a, quiet()).unwrap_err(),
        DrainError::Duplicate
    );
}
#[test]
fn another_owner_receipt_rejected() {
    // Given two independent owners; When their receipts cross; Then no proof is issued.
    let a = observation();
    let other = observation();
    let b = FinalDrainObservation::synthetic(&other, quiet()).expect("other drain");
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Owner);
}
#[test]
fn same_owner_different_finalization_stamp_rejected() {
    // Given an unrelated correlation stamp; When substituted after drain; Then owner binding rejects.
    let a = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.stamp = Rc::new(());
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Owner);
}
#[test]
fn another_cleanup_request_sequence_rejected() {
    // Given a valid pair; When the cleanup request sequence differs; Then exact request rejects.
    let a = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.request.sequence += 1;
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Request);
}
#[test]
fn another_operation_rejected() {
    // Given a valid pair; When creation replaces the cleanup operation; Then exact request rejects.
    let a = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.request.binding.operation = a.owner.creation().binding.operation();
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Request);
}
#[test]
fn another_generation_rejected() {
    // Given a generation-two ticket; When substituted into generation-one cleanup; Then reject.
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("verify");
    adapter
        .respond(fake.execute(&request, Fault::None))
        .expect("legacy Synthetic cleanup");
    let replacement = adapter.replacement().expect("replacement");
    let a = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.request.binding.operation = replacement.binding().operation();
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Request);
}
#[test]
fn another_instance_rejected() {
    // Given another instance; When its identity replaces the cleanup binding; Then reject.
    let a = observation();
    let other = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.request.binding.instance = other.request().binding.instance.clone();
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Request);
}
macro_rules! rejects_drain {
    ($name:ident,$field:ident,$value:expr,$error:expr) => {
        #[test]
        fn $name() {
            // Given valid finalization; When one drain observation fails; Then no receipt or proof.
            let a = observation();
            let mut facts = quiet();
            facts.$field = $value;
            assert_eq!(
                FinalDrainObservation::synthetic(&a, facts).unwrap_err(),
                $error
            );
        }
    };
}
rejects_drain!(
    owner_release_before_drain_required,
    owner_release,
    Confirmation::Failed,
    DrainError::OwnerRelease
);
rejects_drain!(
    owner_release_unknown_rejected,
    owner_release,
    Confirmation::Unknown,
    DrainError::OwnerRelease
);
rejects_drain!(
    queue_nonquiet_rejected,
    queue_quiet,
    Confirmation::Failed,
    DrainError::Queue
);
rejects_drain!(
    stale_callback_rejected,
    queue_quiet,
    Confirmation::Unknown,
    DrainError::Queue
);
rejects_drain!(
    retired_owner_callback_rejected,
    outcome_known,
    Confirmation::Failed,
    DrainError::Unknown
);
rejects_drain!(
    callback_overflow_rejected,
    overflow_clear,
    Confirmation::Failed,
    DrainError::Overflow
);
rejects_drain!(
    callback_reentry_rejected,
    reentry_clear,
    Confirmation::Failed,
    DrainError::Reentry
);
rejects_drain!(
    drain_budget_exceeded_rejected,
    budget_complete,
    Confirmation::Failed,
    DrainError::Budget
);
rejects_drain!(
    drain_unknown_rejected,
    outcome_known,
    Confirmation::Unknown,
    DrainError::Unknown
);
rejects_drain!(
    creator_thread_mismatch_rejected,
    current_thread,
    8,
    DrainError::Thread
);
#[test]
fn finalization_failure_has_no_observation() {
    // Given failed native cleanup facts; When observed; Then no A receipt exists.
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("request");
    assert_eq!(
        fake.observe_cleanup(&request, Fault::Destroy).unwrap_err(),
        VerifyError::Destroy
    );
}
#[test]
fn finalization_owner_release_failure_has_no_observation() {
    // Given failed owner release; When observed; Then no A receipt exists.
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("request");
    assert_eq!(
        fake.observe_cleanup(&request, Fault::Release).unwrap_err(),
        VerifyError::OwnerRelease
    );
}
#[test]
fn duplicate_finalization_rejected() {
    // Given one A receipt; When another request attempts that owner; Then no second A.
    let (mut adapter, mut fake) = terminal();
    let request = adapter.verify_cleanup().expect("request");
    let _a = fake.observe_cleanup(&request, Fault::None).expect("first");
    let mut second = request;
    second.sequence += 1;
    assert!(fake.observe_cleanup(&second, Fault::None).is_err());
}
#[test]
fn final_verifier_rechecks_drain_facts() {
    // Given a corrupted internal receipt; When final verifier runs; Then no proof.
    let a = observation();
    let mut b = FinalDrainObservation::synthetic(&a, quiet()).expect("drain");
    b.facts.queue_quiet = Confirmation::Unknown;
    assert_eq!(verify_final_drain(a, b).unwrap_err(), DrainError::Queue);
}
