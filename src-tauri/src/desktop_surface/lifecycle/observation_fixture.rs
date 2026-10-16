use super::{observation::*, observation_reader::Lease};
use std::{cell::Cell, rc::Rc};

fn identity(id: usize, class: &str, process: &ProcessIdentity) -> WindowIdentity {
    WindowIdentity {
        id: WindowId(id),
        process: process.clone(),
        thread: 42,
        class: class.into(),
    }
}
pub(super) struct Fake {
    pub window: ObservedWindow,
    pub shell: Topology,
    pub expected: Vec<u16>,
    pub calls: usize,
    pub fail_at: Option<usize>,
    pub changed_identity: bool,
    pub changed_topology: bool,
    pub closes: Rc<Cell<usize>>,
}
impl Default for Fake {
    fn default() -> Self {
        let expected: Vec<u16> = "C:\\Windows\\explorer.exe".encode_utf16().collect();
        let explorer = ProcessIdentity {
            pid: 10,
            created: 100,
            session: 2,
            image: expected.clone(),
        };
        let main_process = ProcessIdentity {
            pid: 20,
            created: 200,
            session: 2,
            image: "C:\\QA\\unit.exe".encode_utf16().collect(),
        };
        let progman = identity(10, "Progman", &explorer);
        let host = identity(11, "WorkerW", &explorer);
        let candidate = identity(13, "WorkerW", &explorer);
        Self {
            window: ObservedWindow {
                identity: identity(100, "SyntheticMain", &main_process),
                parent: Parent::DesktopRoot(WindowId(1)),
                owner: None,
                style: 0,
                extended_style: 0,
                placement: Placement {
                    flags: 0,
                    show: 1,
                    normal: PlacementRect(0, 0, 800, 600),
                    minimized: (-1, -1),
                    maximized: (-1, -1),
                    space: PlacementSpace::Workspace,
                },
                screen: ScreenRect(-900, 10, -100, 610),
                client: ClientRect(0, 0, 780, 560),
                visible: true,
                minimized: false,
                maximized: false,
                monitor: Monitor {
                    id: 1,
                    bounds: ScreenRect(-1920, 0, 0, 1080),
                    work: ScreenRect(-1920, 0, 0, 1040),
                },
                dpi: 144,
                context: DpiContext(1),
                caller_context: DpiContext(257),
            },
            shell: Topology {
                shell: progman.clone(),
                progman,
                host: host.clone(),
                def_view: identity(12, "SHELLDLL_DefView", &explorer),
                def_view_parent: host.id,
                workers: vec![Worker {
                    identity: candidate,
                    parent: Parent::DesktopRoot(WindowId(1)),
                    visible: true,
                    usable: true,
                    has_def_view: false,
                    follows_host: true,
                }],
            },
            expected,
            calls: 0,
            fail_at: None,
            changed_identity: false,
            changed_topology: false,
            closes: Rc::new(Cell::new(0)),
        }
    }
}
impl Fake {
    fn query(&mut self) -> Result<(), QueryError> {
        self.calls += 1;
        let count = self.closes.clone();
        let _lease = Lease::new(self.calls, move |_| count.set(count.get() + 1));
        if self.fail_at == Some(self.calls) {
            Err(QueryError::Api("synthetic query", 5))
        } else {
            Ok(())
        }
    }
}
impl ReadQueries for Fake {
    fn window(&mut self, _: WindowId) -> Result<ObservedWindow, QueryError> {
        self.query()?;
        Ok(self.window.clone())
    }
    fn identity(&mut self, id: WindowId) -> Result<WindowIdentity, QueryError> {
        self.query()?;
        let mut identity = self.window.identity.clone();
        identity.id = id;
        if self.changed_identity && self.calls >= 4 {
            identity.process.created += 1;
        }
        Ok(identity)
    }
    fn topology(&mut self) -> Result<Topology, QueryError> {
        self.query()?;
        let mut shell = self.shell.clone();
        if self.changed_topology && self.calls >= 5 {
            shell.workers[0].identity.thread += 1;
        }
        Ok(shell)
    }
    fn dpi_equal(&self, a: DpiContext, b: DpiContext) -> bool {
        (a.0 & 255) == (b.0 & 255)
    }
    fn expected_explorer(&self) -> &[u16] {
        &self.expected
    }
}
