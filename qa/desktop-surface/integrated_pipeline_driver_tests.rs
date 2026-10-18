use super::super::{synchronous_driver::Driver, tests::fixture::fixture};
use crate::{
    integrated_runner::{
        evidence::UnixSeconds,
        gate_tests::Fixture,
        pipeline::run_synthetic,
        result::{Cleanup, Lifecycle, Proof},
    },
    native_contract::failure_cleanup::Fact,
};

#[test]
fn real_synthetic_driver_runs_through_complete_pipeline() {
    let f = Fixture::new();
    let report = run_synthetic(
        f.input(),
        UnixSeconds::new(1),
        &mut Vec::new(),
        &mut Vec::new(),
        |attempt| attempt.execute_synthetic(Driver::new(fixture())),
    );
    assert_eq!(report.completed().exit_code(), 0);
    assert_eq!(report.completed().result().proof(), Proof::VerifiedAB);
}
#[test]
fn actual_driver_lifecycle_failure_and_cleanup_are_preserved() {
    for (fault, unknown, expected, exit) in [
        (None, false, Cleanup::Succeeded, 3),
        (Some(Fact::Destroy), false, Cleanup::Failed, 5),
        (Some(Fact::Residual), true, Cleanup::Unknown, 5),
    ] {
        let f = Fixture::new();
        let mut host = fixture();
        host.backend.delay = true;
        host.backend.cleanup_fault = fault;
        host.backend.cleanup_unknown = unknown;
        let report = run_synthetic(
            f.input(),
            UnixSeconds::new(1),
            &mut Vec::new(),
            &mut Vec::new(),
            |attempt| attempt.execute_synthetic(Driver::new(host)),
        );
        assert_eq!(report.completed().exit_code(), exit);
        assert!(matches!(
            report.completed().result().lifecycle(),
            Lifecycle::Failed(_)
        ));
        assert_eq!(report.completed().result().cleanup(), expected);
    }
}
