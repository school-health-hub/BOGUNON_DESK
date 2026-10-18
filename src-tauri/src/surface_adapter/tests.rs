use super::model::*;
use crate::surface_broker::State;
fn ready() -> Gate {
    Gate {
        main: true,
        isolation: true,
        acl: true,
        assets: true,
        explorer_disabled: true,
    }
}
#[test]
fn disabled_adapter_rejects_before_creation() {
    let mut model = Model::default();
    let request = model.request(1);
    assert_eq!(model.begin(&request, ready()), Err(Error::Disabled));
}
#[test]
fn synthetic_gate_requires_every_prerequisite() {
    for field in 0..5 {
        let mut model = Model::synthetic_enabled();
        let mut gate = ready();
        match field {
            0 => gate.main = false,
            1 => gate.isolation = false,
            2 => gate.acl = false,
            3 => gate.assets = false,
            4 => gate.explorer_disabled = false,
            _ => unreachable!(),
        }
        assert!(model.begin(&model.request(1), gate).is_err());
        assert_eq!(model.phase(), Phase::Dormant);
    }
}
#[test]
fn duplicate_and_foreign_creation_requests_are_rejected() {
    let mut model = Model::synthetic_enabled();
    let other = Model::synthetic_enabled();
    assert_eq!(
        model.begin(&other.request(1), ready()),
        Err(Error::Identity)
    );
    model.begin(&model.request(1), ready()).unwrap();
    assert_eq!(model.begin(&model.request(2), ready()), Err(Error::Closed));
}
#[test]
fn destroy_and_missing_never_confirm_webview_cleanup() {
    for observation in [Observation::Destroyed, Observation::ResourceMissing] {
        let mut model = Model::synthetic_enabled();
        let request = model.request(1);
        model.begin(&request, ready()).unwrap();
        model.created(&request).unwrap();
        model.observe(&request, observation).unwrap();
        assert_eq!(model.cleanup(), Cleanup::Unknown);
        assert_eq!(model.registry_state(), State::CleanupUnknown);
        assert!(!model.replacement_allowed());
        assert!(model.begin(&model.request(2), ready()).is_err());
    }
}
#[test]
fn close_closes_admission_without_confirming_cleanup() {
    let mut model = Model::synthetic_enabled();
    let request = model.request(1);
    model.begin(&request, ready()).unwrap();
    model.created(&request).unwrap();
    model
        .observe(&request, Observation::CloseRequested)
        .unwrap();
    assert_eq!(model.phase(), Phase::Closing);
    assert!(!model.delivery_allowed(&request));
    assert_eq!(model.registry_state(), State::Retiring);
}
#[test]
fn stale_loss_does_not_retire_another_surface() {
    let mut model = Model::synthetic_enabled();
    let request = model.request(1);
    model.begin(&request, ready()).unwrap();
    model.created(&request).unwrap();
    let other = Model::synthetic_enabled();
    assert_eq!(
        model.observe(&other.request(1), Observation::Destroyed),
        Err(Error::Identity)
    );
    assert!(model.delivery_allowed(&request));
}
#[test]
fn partial_create_and_navigation_failure_are_unknown() {
    for observation in [Observation::CreateFailed, Observation::NavigationDenied] {
        let mut model = Model::synthetic_enabled();
        let request = model.request(1);
        model.begin(&request, ready()).unwrap();
        model.observe(&request, observation).unwrap();
        assert_eq!(model.cleanup(), Cleanup::Unknown);
        assert!(!model.replacement_allowed());
    }
}
#[test]
fn actual_adapter_default_status_is_inert() {
    let adapter = super::Adapter::default();
    assert!(!adapter.enabled());
    assert_eq!(adapter.status().unwrap().phase, Phase::Dormant);
    assert!(!adapter.status().unwrap().replacement_allowed);
}
#[test]
fn terminal_sequence_exhaustion_fails_closed() {
    let mut model = Model::synthetic_enabled();
    assert!(model.begin(&model.request(u64::MAX), ready()).is_err());
    assert_eq!(model.registry_state(), State::CleanupUnknown);
    assert!(!model.replacement_allowed());
}
#[test]
fn close_during_creation_rejects_late_created_result() {
    let mut model = Model::synthetic_enabled();
    let request = model.request(1);
    model.begin(&request, ready()).unwrap();
    model
        .observe(&request, Observation::CloseRequested)
        .unwrap();
    assert_eq!(model.created(&request), Err(Error::Closed));
    assert!(!model.delivery_allowed(&request));
}
#[test]
fn accepted_monotonic_sequence_remains_bound_through_cleanup() {
    let mut model = Model::synthetic_enabled();
    let request = model.request(2);
    model.begin(&request, ready()).unwrap();
    model.created(&request).unwrap();
    assert!(model.delivery_allowed(&request));
    assert_eq!(
        model.observe(&model.request(1), Observation::Destroyed),
        Err(Error::Identity)
    );
    model.observe(&request, Observation::Destroyed).unwrap();
    assert_eq!(model.cleanup(), Cleanup::Unknown);
}
