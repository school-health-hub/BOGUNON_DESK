use super::model::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Request {
    Started(OperationId),
    Joined(OperationId),
    Already,
    Unsupported,
    Busy,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Progress {
    Pending,
    Finished,
    Stale,
}
enum Phase {
    Snapshot,
    Apply(usize),
    VerifyAttach,
    Restore(usize),
    VerifyRestore,
}
struct Active {
    record: Record,
    phase: Phase,
    return_to_normal: bool,
    detach: bool,
}

pub(super) struct Machine {
    state: State,
    probe_supported: bool,
    sequence: u64,
    active: Option<Active>,
    attached: Option<Record>,
    history: Vec<Record>,
}

impl Default for Machine {
    fn default() -> Self {
        Self {
            state: State::NormalWindow,
            probe_supported: false,
            sequence: 0,
            active: None,
            attached: None,
            history: Vec::new(),
        }
    }
}

impl Machine {
    pub const fn state(&self) -> State {
        self.state
    }
    pub fn history(&self) -> &[Record] {
        &self.history
    }
    pub fn probe(&mut self, supported: bool) {
        self.probe_supported = supported;
        if matches!(self.state, State::NormalWindow | State::ProbeReady) {
            self.state = if supported {
                State::ProbeReady
            } else {
                State::NormalWindow
            };
        }
    }
    fn next_id(&mut self) -> Option<OperationId> {
        self.sequence = self.sequence.checked_add(1)?;
        Some(OperationId(self.sequence))
    }
    pub fn attach(&mut self) -> Request {
        if self.state == State::Failed {
            return Request::Failed;
        }
        if let Some(active) = &self.active {
            return if active.return_to_normal {
                Request::Busy
            } else {
                Request::Joined(active.record.id)
            };
        }
        if self.state == State::Attached {
            return Request::Already;
        }
        if !self.probe_supported {
            return Request::Unsupported;
        }
        let Some(id) = self.next_id() else {
            self.state = State::Failed;
            return Request::Failed;
        };
        self.active = Some(Active {
            record: Record::new(id),
            phase: Phase::Snapshot,
            return_to_normal: false,
            detach: false,
        });
        self.state = State::Attaching;
        Request::Started(id)
    }
    pub fn detach(&mut self) -> Request {
        if self.state == State::Failed {
            return Request::Failed;
        }
        if let Some(active) = &mut self.active {
            active.return_to_normal = true;
            self.state = State::Detaching;
            return Request::Joined(active.record.id);
        }
        let Some(mut record) = self.attached.clone() else {
            return Request::Already;
        };
        let Some(id) = self.next_id() else {
            self.state = State::Failed;
            return Request::Failed;
        };
        record.id = id;
        record.restored.clear();
        let count = record.attempted.len();
        self.active = Some(Active {
            record,
            phase: Phase::Restore(count),
            return_to_normal: true,
            detach: true,
        });
        self.state = State::Detaching;
        Request::Started(id)
    }
    /// A stale callback cannot even reach the adapter.
    pub fn advance(&mut self, id: OperationId, adapter: &mut impl Adapter) -> Progress {
        if self.active.as_ref().map(|a| a.record.id) != Some(id) {
            return Progress::Stale;
        }
        let Some(mut active) = self.active.take() else {
            return Progress::Stale;
        };
        if active.return_to_normal && matches!(active.phase, Phase::Apply(_) | Phase::VerifyAttach)
        {
            active.record.cause.get_or_insert(Failure::Cancelled);
            active.phase = Phase::Restore(active.record.attempted.len());
        }
        let terminal = match active.phase {
            Phase::Snapshot => match adapter.snapshot() {
                Ok(snapshot) => {
                    active.record.snapshot = Some(snapshot);
                    active.phase = Phase::Apply(0);
                    None
                }
                Err(error) => {
                    active.record.cause = Some(error);
                    Some(State::Failed)
                }
            },
            Phase::Apply(index) => {
                if let Some(snapshot) = &active.record.snapshot {
                    let result = adapter.validate_attach(snapshot).and_then(|()| {
                        active.record.attempted.push(STAGES[index]);
                        adapter.apply(STAGES[index], snapshot)
                    });
                    match result {
                        Ok(()) => {
                            active.phase = if index + 1 == STAGES.len() {
                                Phase::VerifyAttach
                            } else {
                                Phase::Apply(index + 1)
                            };
                        }
                        Err(error) => {
                            active.record.cause = Some(error);
                            active.phase = Phase::Restore(active.record.attempted.len());
                            self.state = State::Detaching;
                        }
                    }
                    None
                } else {
                    Some(State::Failed)
                }
            }
            Phase::VerifyAttach => {
                if let Some(snapshot) = &active.record.snapshot {
                    match adapter
                        .validate_attach(snapshot)
                        .and_then(|()| adapter.verify_attached(snapshot))
                    {
                        Ok(()) => Some(State::Attached),
                        Err(error) => {
                            active.record.cause = Some(error);
                            active.phase = Phase::Restore(active.record.attempted.len());
                            self.state = State::Detaching;
                            None
                        }
                    }
                } else {
                    Some(State::Failed)
                }
            }
            Phase::Restore(count) => {
                if count == 0 {
                    active.phase = Phase::VerifyRestore;
                    None
                } else if let Some(snapshot) = &active.record.snapshot {
                    let stage = active.record.attempted[count - 1];
                    match adapter.validate_restore(snapshot) {
                        Err(error) => {
                            active.record.rollback_errors.push(error);
                            Some(State::Failed)
                        }
                        Ok(()) => {
                            match adapter.restore(stage, snapshot) {
                                Ok(()) => active.record.restored.push(stage),
                                Err(error) => active.record.rollback_errors.push(error),
                            }
                            active.phase = Phase::Restore(count - 1);
                            None
                        }
                    }
                } else {
                    Some(State::Failed)
                }
            }
            Phase::VerifyRestore => {
                if let Some(snapshot) = &active.record.snapshot {
                    let result = adapter
                        .validate_restore(snapshot)
                        .and_then(|()| adapter.verify_restored(snapshot));
                    match result {
                        Ok(()) if active.record.rollback_errors.is_empty() => {
                            active.record.verified_restored = true;
                            Some(if active.detach {
                                State::NormalWindow
                            } else {
                                State::Fallback
                            })
                        }
                        Ok(()) => Some(State::Failed),
                        Err(error) => {
                            active.record.rollback_errors.push(error);
                            Some(State::Failed)
                        }
                    }
                } else {
                    Some(State::Failed)
                }
            }
        };
        if let Some(state) = terminal {
            self.state = state;
            if state == State::Attached {
                self.attached = Some(active.record.clone());
            } else {
                self.attached = None;
            }
            self.history.push(active.record);
            Progress::Finished
        } else {
            self.active = Some(active);
            Progress::Pending
        }
    }
}
