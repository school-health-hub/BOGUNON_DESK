use crate::{
    evidence_record::Record,
    live_observation,
    observation::*,
    observation_fixture::Fake,
    observation_reader::Reader,
    outcome::{Capability, WindowResult},
};

struct OwnWindows {
    fake: Fake,
    windows: [ObservedWindow; 3],
    topologies: usize,
    change_after_collect: bool,
}
impl OwnWindows {
    fn new() -> Self {
        let mut fake = Fake::default();
        fake.window.visible = false;
        let root = fake.window.clone();
        let mut owned = root.clone();
        owned.identity.id = WindowId(101);
        owned.owner = Some(root.identity.clone());
        let mut child = root.clone();
        child.identity.id = WindowId(102);
        child.parent = Parent::Child(root.identity.clone());
        Self {
            fake,
            windows: [root, owned, child],
            topologies: 0,
            change_after_collect: false,
        }
    }
}
impl ReadQueries for OwnWindows {
    fn window(&mut self, id: WindowId) -> Result<ObservedWindow, QueryError> {
        self.windows
            .iter()
            .find(|w| w.identity.id == id)
            .cloned()
            .ok_or(QueryError::InvalidValue("synthetic window"))
    }
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError> {
        self.fake.identity(id)
    }
    fn topology(&mut self) -> Result<Topology, QueryError> {
        self.topologies += 1;
        let mut result = self.fake.shell.clone();
        if self.change_after_collect && self.topologies >= 3 {
            result.host.thread += 1;
        }
        Ok(result)
    }
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool {
        self.fake.dpi_equal(a, b)
    }
    fn expected_explorer(&self) -> &[u16] {
        self.fake.expected_explorer()
    }
}
fn run(fake: OwnWindows) -> (crate::diagnostic_output::Finding, serde_json::Value, usize) {
    let mut reader = Reader(fake);
    let mut record = Record::default();
    let finding = live_observation::observe(
        &mut reader,
        &[WindowId(100), WindowId(101), WindowId(102)],
        &mut record,
    );
    (
        finding,
        serde_json::to_value(record).expect("fixed evidence"),
        reader.0.topologies,
    )
}
#[test]
fn live_observation_uses_existing_collection_with_evidence() {
    let (finding, value, _) = run(OwnWindows::new());
    assert_eq!(finding.report.window, WindowResult::Pass);
    assert_eq!(finding.report.capability, Capability::Supported);
    assert_eq!(value["collection"]["workers_enumerated"], 1);
    assert_eq!(value["collection"]["eligible_workers"], 1);
    assert_eq!(value["post_collection_check"], "PASSED");
    assert_eq!(value["own_window_check"], "PASSED");
}
#[test]
fn zero_workers_preserves_unsupported_without_claiming_post_check() {
    let mut fake = OwnWindows::new();
    fake.fake.shell.workers.clear();
    let (finding, value, _) = run(fake);
    assert_eq!(finding.report.capability, Capability::Unsupported);
    assert_eq!(value["collection"]["reason"], "NO_WORKERS_ENUMERATED");
    assert_eq!(value["post_collection_check"], "NOT_OBSERVED");
    assert_eq!(value["final_query_error"], "NO_ELIGIBLE_WORKER");
}
#[test]
fn later_topology_failure_is_not_hidden_by_earlier_collection_success() {
    let mut fake = OwnWindows::new();
    fake.change_after_collect = true;
    let (finding, value, _) = run(fake);
    assert_eq!(finding.report.capability, Capability::Fail);
    assert_eq!(value["collection"]["reason"], "ELIGIBLE_WORKER_FOUND");
    assert_eq!(value["post_collection_check"], "FAILED");
    assert_eq!(value["final_query_error"], "TOPOLOGY_CHANGED");
}
#[test]
fn invalid_own_window_relation_blocks_shell_collection() {
    let mut fake = OwnWindows::new();
    fake.windows[1].owner = None;
    let (finding, value, queries) = run(fake);
    assert_eq!(finding.report.window, WindowResult::Fail);
    assert_eq!(queries, 0);
    assert!(value["collection"].is_null());
}
#[test]
fn serialization_cannot_leak_query_error_payloads_or_identity_fields() {
    let mut record = Record::default();
    record.query_error(&QueryError::Api(
        "PRIVATE_PATH HWND=SECRET USERNAME",
        123456,
    ));
    let value = serde_json::to_value(record).expect("fixed schema");
    assert_eq!(value.as_object().expect("object").len(), 6);
    assert_eq!(value["final_query_error"], "API");
    let text = value.to_string();
    for marker in [
        "PRIVATE", "HWND", "USERNAME", "123456", "pid", "path", "title",
    ] {
        assert!(!text.contains(marker));
    }
}
