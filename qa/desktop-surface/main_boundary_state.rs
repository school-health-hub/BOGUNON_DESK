use crate::surface_event_types::{MainState, Projection};

/// Synthetic Main-owned state. Never given to a Surface or native adapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Authoritative {
    work_data: String,
    unsaved_input: String,
    authenticated: bool,
    permission: bool,
    settings: String,
    progress: u32,
    open_tasks: u32,
}
impl Authoritative {
    pub fn synthetic() -> Self {
        Self {
            work_data: String::from("synthetic-private-work"),
            unsaved_input: String::from("synthetic-unsaved-input"),
            authenticated: true,
            permission: true,
            settings: String::from("synthetic-user-settings"),
            progress: 3,
            open_tasks: 2,
        }
    }
    pub(super) fn projection(&self) -> Projection {
        MainState::new(1, self.open_tasks, String::new()).projection()
    }
    pub(super) const fn authorized(&self) -> bool {
        self.authenticated && self.permission
    }
    pub(super) fn set_permission(&mut self, permission: bool) {
        self.permission = permission;
    }
    pub(super) fn set_authenticated(&mut self, authenticated: bool) {
        self.authenticated = authenticated;
    }
}
