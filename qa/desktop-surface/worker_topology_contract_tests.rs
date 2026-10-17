//! Pure contracts only: no native topology queries or copied search algorithm.
use crate::{
    observation::*,
    observation_fixture::Fake,
    observation_reader::{evidence::Reason, Reader},
    outcome::{Capability, Report},
    read_only_topology::following_workers,
};

const ORDER: [WindowId; 3] = [WindowId(11), WindowId(13), WindowId(14)];

fn assert_tail(first: Option<WindowId>, expected: &[WindowId]) {
    // Given a synthetic native enumeration order and search return value.
    // When the exact native adapter's pure projection runs.
    let actual = following_workers(&ORDER, first).unwrap();
    // Then the returned first worker is included, without discarding ambiguity.
    assert_eq!(actual, expected);
}

#[test]
fn no_following_search_result_has_empty_tail() {
    assert_tail(None, &[]);
}

#[test]
fn first_worker_is_included_in_following_tail() {
    assert_tail(Some(ORDER[0]), &ORDER);
}

#[test]
fn middle_worker_is_included_in_following_tail() {
    assert_tail(Some(ORDER[1]), &ORDER[1..]);
}

#[test]
fn last_worker_is_included_in_following_tail() {
    assert_tail(Some(ORDER[2]), &ORDER[2..]);
}

#[test]
fn following_worker_missing_from_enumeration_is_topology_failure() {
    // Given a returned worker absent from the earlier enumeration.
    let first = Some(WindowId(99));
    // When the real projection compares the samples.
    let result = following_workers(&ORDER, first);
    // Then it cannot invent a tail or classify this as unsupported.
    assert_eq!(result, Err(QueryError::TopologyChanged));
}

#[test]
fn progman_def_view_host_accepts_following_worker() {
    // Given DefView directly under authenticated Progman.
    let mut fake = Fake::default();
    fake.shell.host = fake.shell.progman.clone();
    fake.shell.def_view_parent = fake.shell.host.id;
    let candidate = fake.shell.workers[0].identity.clone();
    let order = [candidate.id];
    fake.shell.workers[0].follows_host = following_workers(&order, Some(candidate.id))
        .unwrap()
        .contains(&candidate.id);
    // When the unchanged Reader validates this synthetic topology.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then the Progman host is accepted and the candidate is preserved.
    let snapshot = result.unwrap();
    assert_eq!(snapshot.topology.host.class, "Progman");
    assert_eq!(snapshot.worker, candidate);
    assert_eq!(evidence.eligible_workers, Some(1));
    assert_eq!(evidence.exclusions.unwrap().host, 0);
}

#[test]
fn worker_def_view_host_is_excluded_but_following_worker_is_accepted() {
    // Given a WorkerW host included in enumeration before its candidate.
    let mut fake = Fake::default();
    let candidate = fake.shell.workers[0].identity.clone();
    let mut host = fake.shell.workers[0].clone();
    host.identity = fake.shell.host.clone();
    host.has_def_view = true;
    fake.shell.workers.insert(0, host);
    let order = [fake.shell.host.id, candidate.id];
    let tail = following_workers(&order, Some(candidate.id)).unwrap();
    for worker in &mut fake.shell.workers {
        worker.follows_host = tail.contains(&worker.identity.id);
    }
    // When actual validation and selection run, not a copied selector.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then only the worker after the host is eligible.
    assert_eq!(result.unwrap().worker, candidate);
    assert_eq!(evidence.eligible_workers, Some(1));
    let excluded = evidence.exclusions.unwrap();
    assert_eq!(
        (excluded.host, excluded.def_view, excluded.order),
        (1, 1, 1)
    );
}

fn assert_rejected(visible: bool, follows_host: bool) {
    // Given only the specified visibility/order predicates are changed.
    let mut fake = Fake::default();
    fake.shell.workers[0].visible = visible;
    fake.shell.workers[0].follows_host = follows_host;
    // When the actual Reader counts and selects candidates.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then selection and overlapping counts agree, with all rechecks retained.
    let error = result.unwrap_err();
    assert_eq!(error, QueryError::NoEligibleWorker);
    assert_eq!(evidence.reason, Reason::NoEligibleWorker);
    assert_eq!(evidence.eligible_workers, Some(0));
    assert!(evidence.shell_identity_passed && evidence.dpi_passed);
    assert!(evidence.main_identity_recheck_passed && evidence.topology_recheck_passed);
    let counts = evidence.exclusions.unwrap();
    assert_eq!(counts.hidden, usize::from(!visible));
    assert_eq!(counts.order, usize::from(!follows_host));
    assert_eq!(
        (
            counts.class,
            counts.process,
            counts.parent,
            counts.bounds,
            counts.def_view,
            counts.host
        ),
        (0, 0, 0, 0, 0, 0)
    );
    assert_eq!(
        Report::finish(Ok(()), Err(error), Ok(())).capability,
        Capability::Unsupported
    );
}

#[test]
fn visibility_alone_rejects_candidate() {
    assert_rejected(false, true);
}

#[test]
fn follows_host_alone_rejects_candidate() {
    assert_rejected(true, false);
}

#[test]
fn visibility_and_follows_host_rejections_overlap() {
    assert_rejected(false, false);
}

#[test]
fn one_eligible_candidate_count_matches_selected_identity() {
    // Given one eligible synthetic candidate.
    let fake = Fake::default();
    let candidate = fake.shell.workers[0].identity.clone();
    // When the real Reader selects it.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then evidence and selection refer to the same one-candidate contract.
    assert_eq!(result.unwrap().worker, candidate);
    assert_eq!(evidence.eligible_workers, Some(1));
    assert_eq!(evidence.reason, Reason::EligibleWorkerFound);
}

#[test]
fn multiple_following_eligible_candidates_are_ambiguous() {
    // Given two eligible workers retained by the real inclusive projection.
    let mut fake = Fake::default();
    let mut second = fake.shell.workers[0].clone();
    second.identity.id = WindowId(14);
    fake.shell.workers.push(second);
    let order = [WindowId(13), WindowId(14)];
    let tail = following_workers(&order, Some(order[0])).unwrap();
    for worker in &mut fake.shell.workers {
        worker.follows_host = tail.contains(&worker.identity.id);
    }
    // When the actual Reader selects from the projected candidates.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then neither projection nor selection hides the second candidate.
    let error = result.unwrap_err();
    assert_eq!(error, QueryError::AmbiguousWorker);
    assert_eq!(evidence.eligible_workers, Some(2));
    assert_eq!(evidence.reason, Reason::AmbiguousWorker);
    assert_eq!(
        Report::finish(Ok(()), Err(error), Ok(())).capability,
        Capability::Fail
    );
}

#[test]
fn unequal_topology_samples_override_eligible_count() {
    // Given an eligible first sample and changed synthetic second sample.
    let fake = Fake {
        changed_topology: true,
        ..Fake::default()
    };
    // When the existing double-sample collection runs.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then an initial candidate does not turn instability into success.
    let error = result.unwrap_err();
    assert_eq!(error, QueryError::TopologyChanged);
    assert_eq!(evidence.eligible_workers, Some(1));
    assert_eq!(evidence.reason, Reason::TopologyChanged);
    assert!(!evidence.topology_recheck_passed);
    assert_eq!(
        Report::finish(Ok(()), Err(error), Ok(())).capability,
        Capability::Fail
    );
}

#[test]
fn zero_enumerated_workers_is_unsupported_after_all_rechecks() {
    // Given a stable authenticated topology with no workers.
    let mut fake = Fake::default();
    fake.shell.workers.clear();
    // When the actual Reader collects it.
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    // Then absence remains distinct from rejected workers and from failures.
    let error = result.unwrap_err();
    assert_eq!(error, QueryError::NoEligibleWorker);
    assert_eq!(evidence.workers_enumerated, Some(0));
    assert_eq!(evidence.eligible_workers, Some(0));
    assert_eq!(evidence.reason, Reason::NoWorkersEnumerated);
    assert!(evidence.shell_identity_passed && evidence.dpi_passed);
    assert!(evidence.main_identity_recheck_passed && evidence.topology_recheck_passed);
    assert_eq!(
        Report::finish(Ok(()), Err(error), Ok(())).capability,
        Capability::Unsupported
    );
}
