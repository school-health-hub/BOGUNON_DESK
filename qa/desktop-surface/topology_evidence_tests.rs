use crate::{
    observation::{topology_evidence::*, QueryError, WindowId},
    read_only_topology::following_workers,
};

#[test]
fn progman_host_is_recorded_without_identity_payload() {
    let mut trace = Trace::default();
    trace.record_host("Progman");
    assert_eq!(trace.host_kind, HostKind::Progman);
}

#[test]
fn worker_host_is_recorded_without_identity_payload() {
    let mut trace = Trace::default();
    trace.record_host("WorkerW");
    assert_eq!(trace.host_kind, HostKind::Workerw);
}

#[test]
fn found_search_is_distinct_from_not_observed() {
    let mut trace = Trace::default();
    trace.record_search(&Ok(Some(WindowId(7))));
    assert_eq!(trace.following_search, FollowingSearch::Found);
    assert_eq!(trace.following_tail_count, None);
}

#[test]
fn no_search_match_records_empty_tail_only_after_projection() {
    let mut trace = Trace::default();
    trace.record_search::<WindowId>(&Ok(None));
    assert_eq!(trace.following_search, FollowingSearch::None);
    assert_eq!(trace.following_tail_count, None);
    trace.record_tail(&following_workers(&[], None));
    assert_eq!(trace.following_tail_count, Some(0));
}

#[test]
fn search_error_retains_no_raw_error_or_invented_tail() {
    let mut trace = Trace::default();
    trace.record_search::<WindowId>(&Err(QueryError::Api("PRIVATE_PATH HWND PID", 9981)));
    assert_eq!(trace.following_search, FollowingSearch::Error);
    assert_eq!(trace.following_tail_count, None);
    let text = serde_json::to_string(&trace).unwrap();
    assert!(!text.contains("PRIVATE") && !text.contains("9981"));
}

#[test]
fn unexecuted_search_is_not_claimed_as_none_or_zero() {
    let trace = Trace::default();
    assert_eq!(trace.host_kind, HostKind::Unknown);
    assert_eq!(trace.following_search, FollowingSearch::NotObserved);
    assert_eq!(trace.following_tail_count, None);
    assert_eq!(trace.enumeration_scope, EnumerationScope::NotObserved);
}

fn tail_count(first: WindowId, count: usize) {
    let order = [WindowId(1), WindowId(2), WindowId(3)];
    let mut trace = Trace::default();
    trace.record_search(&Ok(Some(first)));
    trace.record_tail(&following_workers(&order, Some(first)));
    assert_eq!(trace.following_tail_count, Some(count));
}

#[test]
fn first_tail_count_includes_first_worker() {
    tail_count(WindowId(1), 3);
}

#[test]
fn middle_tail_count_includes_middle_worker() {
    tail_count(WindowId(2), 2);
}

#[test]
fn last_tail_count_includes_last_worker() {
    tail_count(WindowId(3), 1);
}

#[test]
fn differing_search_scopes_are_explicit_not_declared_equivalent() {
    let mut trace = Trace::default();
    trace.begin_enumeration();
    let value = serde_json::to_value(trace).unwrap();
    assert_eq!(
        value["enumeration_scope"],
        "NULL_PARENT_INITIAL_NULL_AFTER_THEN_PREVIOUS_WORKER"
    );
    let source =
        include_str!("../../src-tauri/src/desktop_surface/lifecycle/read_only_topology.rs");
    assert!(source.contains("let mut after = None;"));
    assert!(source.contains("find(None, after, w!(\"WorkerW\"))?"));
    assert!(source.contains("after = Some(worker);"));
    assert!(source.contains("find(None, Some(*host), w!(\"WorkerW\"))"));
}

#[test]
fn missing_following_in_prior_enumeration_is_not_zero_tail() {
    let mut trace = Trace::default();
    trace.record_search(&Ok(Some(WindowId(9))));
    let result = following_workers(&[WindowId(1)], Some(WindowId(9)));
    trace.record_tail(&result);
    assert_eq!(result, Err(QueryError::TopologyChanged));
    assert_eq!(trace.following_search, FollowingSearch::Found);
    assert_eq!(trace.following_tail_count, None);
}

#[test]
fn visibility_is_not_serialized_as_unobserved_ws_visible_style() {
    let text = serde_json::to_string(&Trace::default()).unwrap();
    assert!(!text.contains("visibility_style_count") && !text.contains("WS_VISIBLE"));
}
