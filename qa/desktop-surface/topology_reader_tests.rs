use crate::{
    observation::{topology_evidence::*, *},
    observation_fixture::Fake,
    observation_reader::Reader,
};

struct Traced {
    fake: Fake,
    trace: Trace,
}

impl ReadQueries for Traced {
    fn window(&mut self, id: WindowId) -> Result<ObservedWindow, QueryError> {
        let mut window = self.fake.window(id)?;
        window.identity.id = id;
        match id {
            WindowId(100) => {}
            WindowId(101) => window.owner = Some(self.fake.window.identity.clone()),
            WindowId(102) => window.parent = Parent::Child(self.fake.window.identity.clone()),
            _ => return Err(QueryError::InvalidValue("synthetic window")),
        }
        Ok(window)
    }
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError> {
        self.fake.identity(id)
    }
    fn topology(&mut self) -> Result<Topology, QueryError> {
        self.fake.topology()
    }
    fn topology_with_evidence(&mut self) -> (Result<Topology, QueryError>, Trace) {
        (self.topology(), self.trace.clone())
    }
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool {
        self.fake.dpi_equal(a, b)
    }
    fn expected_explorer(&self) -> &[u16] {
        self.fake.expected_explorer()
    }
}

#[test]
fn first_sample_trace_survives_unsupported_and_keeps_query_count() {
    let mut fake = Fake::default();
    fake.shell.workers[0].visible = false;
    let mut trace = Trace::default();
    trace.begin_enumeration();
    trace.record_host("WorkerW");
    trace.record_search(&Ok(Some(WindowId(13))));
    trace.record_tail(&Ok(&[WindowId(13)][..]));
    let mut reader = Reader(Traced {
        fake,
        trace: trace.clone(),
    });
    let (result, evidence) = reader.collect_with_evidence(WindowId(100));
    assert_eq!(result.unwrap_err(), QueryError::NoEligibleWorker);
    assert_eq!(evidence.topology, trace);
    assert_eq!(reader.0.fake.calls, 5);
    assert!(evidence.topology_recheck_passed);
}

#[test]
fn partial_trace_survives_query_error_without_becoming_unsupported() {
    let fake = Fake {
        fail_at: Some(2),
        ..Fake::default()
    };
    let mut trace = Trace::default();
    trace.begin_enumeration();
    trace.record_host("Progman");
    trace.record_search::<WindowId>(&Err(QueryError::Api("synthetic", 5)));
    let mut reader = Reader(Traced {
        fake,
        trace: trace.clone(),
    });
    let (result, evidence) = reader.collect_with_evidence(WindowId(100));
    assert!(matches!(result, Err(QueryError::Api(..))));
    assert_eq!(evidence.topology, trace);
    assert_eq!(evidence.eligible_workers, None);
    assert!(!evidence.shell_identity_passed);
    assert_eq!(reader.0.fake.calls, 2);
}

#[test]
fn identity_failure_before_topology_leaves_trace_unobserved() {
    let fake = Fake {
        fail_at: Some(1),
        ..Fake::default()
    };
    let (result, evidence) = Reader(fake).collect_with_evidence(WindowId(100));
    assert!(matches!(result, Err(QueryError::Api(..))));
    assert_eq!(evidence.topology, Trace::default());
}

#[test]
fn legacy_fake_does_not_invent_native_search_or_enumeration() {
    let (result, evidence) = Reader(Fake::default()).collect_with_evidence(WindowId(100));
    assert!(result.is_ok());
    assert_eq!(
        evidence.topology.following_search,
        FollowingSearch::NotObserved
    );
    assert_eq!(
        evidence.topology.enumeration_scope,
        EnumerationScope::NotObserved
    );
    assert_eq!(evidence.topology.following_tail_count, None);
}

#[test]
fn live_observation_forwards_trace_to_v2_without_native_calls() {
    let mut fake = Fake::default();
    fake.window.visible = false;
    fake.shell.workers[0].visible = false;
    fake.shell.workers[0].follows_host = false;
    let mut trace = Trace::default();
    trace.begin_enumeration();
    trace.record_host("Progman");
    trace.record_search::<WindowId>(&Ok(None));
    trace.record_tail(&Ok(&[]));
    let mut reader = Reader(Traced { fake, trace });
    let mut record = crate::evidence_record::Record::default();
    let finding = crate::live_observation::observe(
        &mut reader,
        &[WindowId(100), WindowId(101), WindowId(102)],
        &mut record,
    );
    assert_eq!(
        finding.report.capability,
        crate::outcome::Capability::Unsupported
    );
    assert_eq!(finding.report.window, crate::outcome::WindowResult::Pass);
    let value = serde_json::to_value(record).unwrap();
    assert_eq!(value["schema_version"], 2);
    assert_eq!(value["topology"]["host_kind"], "PROGMAN");
    assert_eq!(value["topology"]["following_search"], "NONE");
    assert_eq!(value["topology"]["following_tail_count"], 0);
    assert_eq!(value["collection"]["exclusions"]["hidden"], 1);
    assert_eq!(value["collection"]["exclusions"]["order"], 1);
}
