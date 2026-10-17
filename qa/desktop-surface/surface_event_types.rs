use std::sync::Arc;

use crate::disposable_surface::{Error, Ticket};

#[derive(Debug, PartialEq, Eq)]
pub struct MainState {
    revision: u64,
    open_tasks: u32,
    unsaved_note: String,
}
impl MainState {
    pub fn new(revision: u64, open_tasks: u32, unsaved_note: String) -> Self {
        Self {
            revision,
            open_tasks,
            unsaved_note,
        }
    }
    pub const fn projection(&self) -> Projection {
        Projection {
            revision: self.revision,
            open_tasks: self.open_tasks,
        }
    }
    pub fn unsaved_note(&self) -> &str {
        &self.unsaved_note
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Projection {
    revision: u64,
    open_tasks: u32,
}
impl Projection {
    pub const fn revision(&self) -> u64 {
        self.revision
    }
    pub const fn open_tasks(&self) -> u32 {
        self.open_tasks
    }
}

// Retained tokens keep their allocation alive; pointer reuse cannot alias a live callback.
// This is an in-process identity, not an IPC credential or a persisted identifier.
#[derive(Debug, Clone)]
pub struct InstanceId(Arc<()>);
impl InstanceId {
    pub(super) fn fresh() -> Self {
        Self(Arc::new(()))
    }
}
impl PartialEq for InstanceId {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}
impl Eq for InstanceId {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Binding {
    pub(super) instance: InstanceId,
    pub(super) operation: Ticket,
}
impl Binding {
    pub const fn operation(&self) -> Ticket {
        self.operation
    }
    pub fn instance(&self) -> &InstanceId {
        &self.instance
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    OpenMain,
    RefreshProjection,
}

#[derive(Debug, Clone)]
pub struct Event {
    pub binding: Binding,
    pub sequence: u64,
    pub action: Action,
}

#[derive(Debug, PartialEq, Eq)]
pub struct CommandRequest {
    pub(super) binding: Binding,
    pub(super) sequence: u64,
    pub(super) action: Action,
    pub(super) revision: u64,
}
impl CommandRequest {
    pub fn binding(&self) -> &Binding {
        &self.binding
    }
    pub const fn sequence(&self) -> u64 {
        self.sequence
    }
    pub const fn action(&self) -> Action {
        self.action
    }
    pub const fn revision(&self) -> u64 {
        self.revision
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouteError {
    Instance,
    Operation,
    Inactive,
    Sequence,
    SequenceExhausted,
    Lifecycle(Error),
}
