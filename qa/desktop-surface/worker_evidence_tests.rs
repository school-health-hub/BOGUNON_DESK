use crate::{
    observation::*,
    observation_fixture::Fake,
    observation_reader::{evidence::Reason, Reader},
    outcome::{Capability, Report},
};

#[test]
fn no_workers_is_distinct_from_rejected_workers() {
    // Given an authenticated synthetic shell with no WorkerW.
    let mut fake = Fake::default();
    fake.shell.workers.clear();
    // When the existing collection is diagnosed.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then absence is explicit, after all required rechecks.
    assert_eq!(result.unwrap_err(), QueryError::NoEligibleWorker);
    assert_eq!(evidence.reason, Reason::NoWorkersEnumerated);
    assert_eq!(evidence.workers_enumerated, Some(0));
    assert_eq!(evidence.eligible_workers, Some(0));
    assert!(evidence.shell_identity_passed && evidence.dpi_passed);
    assert!(evidence.main_identity_recheck_passed && evidence.topology_recheck_passed);
}

#[test]
fn existing_but_hidden_worker_is_no_eligible_worker() {
    let mut fake = Fake::default();
    fake.shell.workers[0].visible = false;
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::NoEligibleWorker);
    assert_eq!(evidence.reason, Reason::NoEligibleWorker);
    assert_eq!(evidence.workers_enumerated, Some(1));
    assert_eq!(evidence.eligible_workers, Some(0));
    assert_eq!(evidence.exclusions.unwrap().hidden, 1);
}

#[test]
fn one_eligible_worker_is_not_an_attach_authorization() {
    let (result, evidence) = Reader(Fake::default()).collect_with_evidence(WindowId(100));
    assert!(result.is_ok());
    assert_eq!(evidence.reason, Reason::EligibleWorkerFound);
    assert_eq!(evidence.eligible_workers, Some(1));
}

#[test]
fn multiple_eligible_workers_remain_failure() {
    let mut fake = Fake::default();
    let mut second = fake.shell.workers[0].clone();
    second.identity.id = WindowId(14);
    fake.shell.workers.push(second);
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::AmbiguousWorker);
    assert_eq!(evidence.reason, Reason::AmbiguousWorker);
    assert_eq!(evidence.eligible_workers, Some(2));
    assert!(!evidence.dpi_passed && !evidence.topology_recheck_passed);
}

#[test]
fn shell_failure_does_not_claim_candidate_authentication() {
    let mut fake = Fake::default();
    fake.shell.shell.process.created += 1;
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::ShellIdentity);
    assert_eq!(evidence.reason, Reason::ShellIdentityFailed);
    assert!(!evidence.shell_identity_passed);
    assert_eq!(evidence.workers_enumerated, Some(1));
    assert_eq!(evidence.eligible_workers, None);
    assert_eq!(evidence.exclusions, None);
}

#[test]
fn topology_change_overrides_candidate_count() {
    let fake = Fake {
        changed_topology: true,
        ..Fake::default()
    };
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::TopologyChanged);
    assert_eq!(evidence.reason, Reason::TopologyChanged);
    assert_eq!(evidence.eligible_workers, Some(1));
    assert!(!evidence.topology_recheck_passed);
}

#[test]
fn dpi_failure_is_unknown_reason_with_existing_error_preserved() {
    let mut fake = Fake::default();
    fake.window.caller_context = DpiContext(2);
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::DpiMismatch);
    assert_eq!(evidence.reason, Reason::Unknown);
    assert!(!evidence.dpi_passed && !evidence.main_identity_recheck_passed);
}

#[test]
fn main_identity_failure_never_becomes_no_eligible_worker() {
    let fake = Fake {
        changed_identity: true,
        ..Fake::default()
    };
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::IdentityChanged);
    assert_eq!(evidence.reason, Reason::Unknown);
    assert!(!evidence.main_identity_recheck_passed && !evidence.topology_recheck_passed);
}

#[test]
fn multiple_rejections_use_overlapping_counts_not_first_failure() {
    let mut fake = Fake::default();
    let worker = &mut fake.shell.workers[0];
    worker.visible = false;
    worker.usable = false;
    worker.has_def_view = true;
    worker.follows_host = false;
    let (_, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    let rejected = evidence.exclusions.unwrap();
    assert_eq!(
        (
            rejected.hidden,
            rejected.bounds,
            rejected.def_view,
            rejected.order
        ),
        (1, 1, 1, 1)
    );
    assert_eq!(evidence.eligible_workers, Some(0));
}

#[test]
fn each_existing_predicate_still_rejects_individually() {
    for case in 0..8 {
        let mut fake = Fake::default();
        let worker = &mut fake.shell.workers[0];
        match case {
            0 => worker.identity.class = "Other".into(),
            1 => worker.identity.process.created += 1,
            2 => worker.parent = Parent::Child(fake.shell.host.clone()),
            3 => worker.visible = false,
            4 => worker.usable = false,
            5 => worker.has_def_view = true,
            6 => worker.follows_host = false,
            7 => worker.identity.id = fake.shell.host.id,
            _ => unreachable!(),
        }
        let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
        assert_eq!(result.unwrap_err(), QueryError::NoEligibleWorker);
        let counts = evidence.exclusions.unwrap();
        let values = [
            counts.class,
            counts.process,
            counts.parent,
            counts.hidden,
            counts.bounds,
            counts.def_view,
            counts.order,
            counts.host,
        ];
        assert_eq!(values[case], 1);
        assert_eq!(values.iter().sum::<usize>(), 1);
    }
}

#[test]
fn api_failure_records_unknown_instead_of_inventing_empty_topology() {
    let fake = Fake {
        fail_at: Some(2),
        ..Fake::default()
    };
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert!(matches!(result, Err(QueryError::Api(..))));
    assert_eq!(evidence.reason, Reason::Unknown);
    assert_eq!(evidence.workers_enumerated, None);
    assert_eq!(evidence.eligible_workers, None);
}

#[test]
fn diagnostics_preserve_existing_results_and_query_counts() {
    for case in 0..4 {
        let configure = || {
            let mut fake = Fake::default();
            match case {
                0 => fake.shell.workers.clear(),
                1 => fake.shell.workers[0].visible = false,
                2 => fake.changed_topology = true,
                3 => {}
                _ => unreachable!(),
            }
            fake
        };
        let mut old = Reader(configure());
        let mut diagnostic = Reader(configure());
        let a = old.collect(WindowId(100)).map(|_| ());
        let (b, _) = diagnostic.collect_with_evidence(WindowId(100));
        assert_eq!(a, b.map(|_| ()));
        assert_eq!(old.0.calls, diagnostic.0.calls);
        assert_eq!(diagnostic.0.calls, 5);
        assert_eq!(diagnostic.0.closes.get(), 5);
        let report = Report::finish(Ok(()), a, Ok(()));
        assert_eq!(
            report.capability,
            match case {
                0 | 1 => Capability::Unsupported,
                2 => Capability::Fail,
                3 => Capability::Supported,
                _ => unreachable!(),
            }
        );
    }
}

#[test]
fn evidence_writer_contains_only_fixed_schema_and_no_raw_identity() {
    let mut fake = Fake::default();
    fake.window.identity.class = "SECRET_WINDOW_TITLE".into();
    fake.window.identity.process.image = "PRIVATE_USER_PATH".encode_utf16().collect();
    let (_, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    let mut bytes = Vec::new();
    evidence.write_json(&mut bytes).unwrap();
    let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(value["reason"], "ELIGIBLE_WORKER_FOUND");
    let text = String::from_utf8(bytes).unwrap();
    for secret in [
        "SECRET_WINDOW_TITLE",
        "PRIVATE_USER_PATH",
        "SyntheticMain",
        "pid",
        "hwnd",
        "image",
    ] {
        assert!(!text.contains(secret));
    }
    assert_eq!(value.as_object().unwrap().len(), 9);
}

#[test]
fn evidence_writer_error_is_not_silently_accepted() {
    struct Broken;
    impl std::io::Write for Broken {
        fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
            Err(std::io::ErrorKind::Other.into())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let (_, evidence) = Reader(Fake::default()).collect_with_evidence(WindowId(100));
    assert!(evidence.write_json(&mut Broken).is_err());
}
