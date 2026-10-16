use crate::{observation::*, observation_fixture::Fake, observation_reader::Reader};

struct EmptyChanging(Fake);
impl ReadQueries for EmptyChanging {
    fn window(&mut self, id: WindowId) -> Result<ObservedWindow, QueryError> {
        self.0.window(id)
    }
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError> {
        self.0.identity(id)
    }
    fn topology(&mut self) -> Result<Topology, QueryError> {
        let mut topology = self.0.topology()?;
        if self.0.calls >= 5 {
            topology.host.thread += 1;
        }
        Ok(topology)
    }
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool {
        self.0.dpi_equal(a, b)
    }
    fn expected_explorer(&self) -> &[u16] {
        self.0.expected_explorer()
    }
}
#[test]
fn zero_candidates_with_changing_topology_is_failure_not_unsupported() {
    let mut fake = Fake::default();
    fake.shell.workers.clear();
    assert!(matches!(
        Reader(EmptyChanging(fake)).collect(WindowId(100)),
        Err(QueryError::TopologyChanged)
    ));
}
#[test]
fn zero_candidates_with_changed_main_identity_is_failure_not_unsupported() {
    let mut fake = Fake {
        changed_identity: true,
        ..Fake::default()
    };
    fake.shell.workers.clear();
    assert!(matches!(
        Reader(fake).collect(WindowId(100)),
        Err(QueryError::IdentityChanged)
    ));
}
#[test]
fn previously_observed_worker_disappearing_is_topology_failure() {
    let mut reader = Reader(Fake::default());
    let snapshot = reader.collect(WindowId(100)).unwrap();
    reader.0.shell.workers.clear();
    assert_eq!(
        reader.topology_consistent(&snapshot),
        Err(QueryError::TopologyChanged)
    );
}
