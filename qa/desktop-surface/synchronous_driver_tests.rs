use super::super::tests::fixture::{fixture, Memory};
use super::*;
use crate::native_contract::{
    ownership_finalization::Confirmation, ownership_receipt::Synthetic, verifier::fake::Fault,
};
fn driver() -> Driver<Memory> {
    Driver::new(fixture())
}
fn execute(hook: fn(&mut Memory, &Request) -> Option<Response>) -> DriverReport<Synthetic> {
    let mut d = driver();
    d.host.backend.response_hook = Some(hook);
    d.run().unwrap()
}
fn response(request: &Request, outcome: Outcome) -> Option<Response> {
    Some(Response {
        request: request.clone(),
        outcome,
    })
}
fn failed(report: &DriverReport<Synthetic>, stage: Stage) {
    assert_eq!(report.lifecycle().unwrap_err().stage, stage);
    assert!(!report.succeeded());
    assert!(report.proof().is_none());
    assert!(report.failure_cleanup().is_some());
}
#[test]
fn normal_create_close_cleanup_requires_proof() {
    // Given an existing Synthetic Host; When driven once; Then A+B completes without C.
    let r = driver().run().unwrap();
    assert!(r.succeeded());
    assert!(r.proof().is_some());
    assert!(r.failure_cleanup().is_none());
}
#[test]
fn create_failure_runs_independent_cleanup() {
    // Given Native create failure; When driven; Then failure cleanup stays separate.
    let r = execute(|_, req| response(req, Outcome::CreateFailed));
    failed(&r, Stage::Create);
    assert_eq!(
        r.failure_cleanup().unwrap().as_ref().unwrap().cleanup,
        cleanup::Status::Succeeded
    );
}
#[test]
fn partial_create_retains_partial_resource_classification() {
    // Given the shared Fake partial-create path; When driven; Then cleanup observes Partial.
    let mut d = driver();
    d.host.backend.fault = Fault::PartialCreate;
    let r = d.run().unwrap();
    failed(&r, Stage::Create);
    assert_eq!(
        r.failure_cleanup()
            .unwrap()
            .as_ref()
            .unwrap()
            .observation
            .resources,
        cleanup::Resources::Partial
    );
}
#[test]
fn missing_create_completed_is_not_success() {
    // Given delayed captured creation; When driven synchronously; Then missing completion fails.
    let mut d = driver();
    d.host.backend.delay = true;
    failed(&d.run().unwrap(), Stage::CreateCompleted);
}
#[test]
fn close_failure_runs_cleanup() {
    // Given close failure after real model creation; When driven; Then close remains failed.
    let r = execute(|_, req| {
        if req.kind() == Kind::BeginCloseOwnSurface {
            response(req, Outcome::NativeOutcomeUnknown)
        } else {
            None
        }
    });
    failed(&r, Stage::Close);
}
#[test]
fn missing_close_completed_is_not_cleanup() {
    // Given close captured but delivery delayed; When driven; Then Absent is not inferred.
    let r = execute(|memory, req| {
        if req.kind() == Kind::BeginCloseOwnSurface {
            memory.delay = true;
        }
        None
    });
    failed(&r, Stage::CloseCompleted);
}
#[test]
fn callback_overflow_reaches_failure_cleanup() {
    // Given bounded callback overflow; When driven; Then cleanup is still attempted.
    let mut d = driver();
    d.host.backend.overflow = true;
    let r = d.run().unwrap();
    failed(&r, Stage::CreateDelivery);
    assert_eq!(r.lifecycle().unwrap_err().cause, Error::Overflow);
}
#[test]
fn duplicate_callback_rejected() {
    // Given duplicate captured notice; When driven; Then normal proof is denied.
    let mut d = driver();
    d.host.backend.drain_hook = Some(|m| {
        m.notices.push(m.notices[0].clone());
    });
    failed(&d.run().unwrap(), Stage::CreateDelivery);
}
#[test]
fn stale_callback_rejected() {
    // Given sequence zero; When driven; Then stale delivery fails.
    let mut d = driver();
    d.host.backend.drain_hook = Some(|m| {
        m.notices[0].sequence = 0;
    });
    failed(&d.run().unwrap(), Stage::CreateDelivery);
}
#[test]
fn identity_mismatch_rejected() {
    // Given another owner receipt; When driven; Then Host identity validation fails.
    let mut d = driver();
    d.host.backend.drain_hook = Some(|m| {
        let mut other = fixture();
        other.create().unwrap();
        m.notices[0].owner = other.backend.owner.take().unwrap();
    });
    failed(&d.run().unwrap(), Stage::CreateDelivery);
}
#[test]
fn native_outcome_unknown_is_not_no_resources() {
    // Given the shared Fake Unknown create; When driven; Then uncertainty is retained.
    let mut d = driver();
    d.host.backend.fault = Fault::Unknown;
    let r = d.run().unwrap();
    failed(&r, Stage::Create);
    assert_eq!(
        r.failure_cleanup()
            .unwrap()
            .as_ref()
            .unwrap()
            .observation
            .resources,
        cleanup::Resources::Unknown
    );
}
#[path = "synchronous_driver_failure_tests.rs"]
mod failure_tests;
