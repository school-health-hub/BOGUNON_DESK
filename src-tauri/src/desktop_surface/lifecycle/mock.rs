use super::model::*;

pub(super) fn snapshot() -> Snapshot {
    let process = ProcessIdentity {
        pid: 1,
        creation_time: 10,
        verified_image: 20,
    };
    let main = WindowIdentity {
        handle: 100,
        process,
        thread: 2,
        generation: 3,
    };
    let explorer = ProcessIdentity {
        pid: 4,
        creation_time: 40,
        verified_image: 50,
    };
    let worker = WindowIdentity {
        handle: 200,
        process: explorer,
        thread: 5,
        generation: 6,
    };
    Snapshot {
        window: WindowSnapshot {
            main,
            parent: None,
            owner: Some(main),
            style: 11,
            extended_style: 12,
            placement: Placement {
                flags: 0,
                show_command: 1,
                normal: Rect(1, 2, 800, 600),
                minimized_position: (-1, -1),
                maximized_position: (-1, -1),
            },
            bounds: Rect(1, 2, 800, 600),
            visible: true,
            minimized: false,
            maximized: false,
            monitor: 1,
            dpi: 144,
            dpi_context: 2,
            z_order_anchor: Some(main),
        },
        explorer,
        progman: worker,
        def_view_host: worker,
        worker,
    }
}

pub(super) struct Mock {
    pub original: Snapshot,
    pub current: WindowSnapshot,
    pub explorer: ProcessIdentity,
    pub worker: WindowIdentity,
    pub worker_valid: bool,
    pub frame_updated: bool,
    pub snapshot_failure: bool,
    pub attach_failure: Option<Failure>,
    pub main_valid: bool,
    pub fail_apply: Option<Stage>,
    pub fail_restore: Option<Stage>,
    pub fail_verify_attach: bool,
    pub fail_verify_restore: bool,
    pub calls: Vec<(bool, Stage)>,
    pub reads: usize,
}

impl Default for Mock {
    fn default() -> Self {
        let original = snapshot();
        Self {
            current: original.window.clone(),
            explorer: original.explorer,
            worker: original.worker,
            worker_valid: true,
            frame_updated: false,
            original,
            snapshot_failure: false,
            attach_failure: None,
            main_valid: true,
            fail_apply: None,
            fail_restore: None,
            fail_verify_attach: false,
            fail_verify_restore: false,
            calls: Vec::new(),
            reads: 0,
        }
    }
}

impl Adapter for Mock {
    fn snapshot(&mut self) -> Result<Snapshot, Failure> {
        self.reads += 1;
        if self.snapshot_failure {
            Err(Failure::Snapshot)
        } else {
            Ok(self.original.clone())
        }
    }
    fn validate_attach(&mut self, snapshot: &Snapshot) -> Result<(), Failure> {
        self.reads += 1;
        if !self.main_valid || self.current.main != snapshot.window.main {
            Err(Failure::MainIdentity)
        } else if self.explorer != snapshot.explorer {
            Err(Failure::ExplorerIdentity)
        } else if !self.worker_valid
            || self.worker != snapshot.worker
            || self.worker.process != self.explorer
        {
            Err(Failure::WorkerInvalid)
        } else if self.current.dpi != snapshot.window.dpi
            || self.current.dpi_context != snapshot.window.dpi_context
        {
            Err(Failure::DpiMismatch)
        } else if let Some(error) = self.attach_failure {
            Err(error)
        } else {
            Ok(())
        }
    }
    fn validate_restore(&mut self, snapshot: &Snapshot) -> Result<(), Failure> {
        self.reads += 1;
        if self.main_valid && self.current.main == snapshot.window.main {
            Ok(())
        } else {
            Err(Failure::MainIdentity)
        }
    }
    fn apply(&mut self, stage: Stage, snapshot: &Snapshot) -> Result<(), Failure> {
        self.calls.push((false, stage));
        match stage {
            Stage::Hide => self.current.visible = false,
            Stage::Styles => {
                self.current.style = 91;
                self.current.extended_style = 92;
            }
            Stage::Parent => {
                self.current.parent = Some(snapshot.worker);
                self.current.owner = None;
            }
            Stage::Frame => self.frame_updated = true,
            Stage::Placement => {
                self.current.bounds = Rect(0, 0, 1920, 1080);
                self.current.placement.normal = self.current.bounds;
            }
            Stage::Show => {
                self.current.visible = true;
                self.current.z_order_anchor = None;
            }
        }
        if self.fail_apply == Some(stage) {
            Err(Failure::Mutation(stage))
        } else {
            Ok(())
        }
    }
    fn restore(&mut self, stage: Stage, snapshot: &Snapshot) -> Result<(), Failure> {
        self.calls.push((true, stage));
        if self.fail_restore == Some(stage) {
            return Err(Failure::Restore(stage));
        }
        let original = &snapshot.window;
        match stage {
            Stage::Hide => self.current.visible = original.visible,
            Stage::Styles => {
                self.current.style = original.style;
                self.current.extended_style = original.extended_style;
            }
            Stage::Parent => {
                self.current.parent = original.parent;
                self.current.owner = original.owner;
            }
            Stage::Frame => self.frame_updated = false,
            Stage::Placement => {
                self.current.bounds = original.bounds;
                self.current.placement = original.placement;
            }
            Stage::Show => {
                self.current.visible = original.visible;
                self.current.minimized = original.minimized;
                self.current.maximized = original.maximized;
                self.current.z_order_anchor = original.z_order_anchor;
            }
        }
        Ok(())
    }
    fn verify_attached(&mut self, snapshot: &Snapshot) -> Result<(), Failure> {
        if self.fail_verify_attach
            || self.current.parent != Some(snapshot.worker)
            || self.current.owner.is_some()
            || self.current.style != 91
            || self.current.extended_style != 92
            || !self.current.visible
            || !self.frame_updated
            || self.current.bounds != Rect(0, 0, 1920, 1080)
        {
            Err(Failure::Verification)
        } else {
            Ok(())
        }
    }
    fn verify_restored(&mut self, snapshot: &Snapshot) -> Result<(), Failure> {
        if self.fail_verify_restore || self.current != snapshot.window || self.frame_updated {
            Err(Failure::Verification)
        } else {
            Ok(())
        }
    }
}
