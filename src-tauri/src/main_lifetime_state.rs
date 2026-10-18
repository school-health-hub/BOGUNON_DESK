use std::sync::Arc;
#[path = "main_projection_state.rs"]
mod projection;
pub(super) use projection::{
    ApprovedProjection, ProjectionError, ProjectionRevocation, PublisherLease,
};
#[derive(Clone)]
pub(super) struct Generation {
    instance: Arc<()>,
    generation: u64,
}
pub(super) struct Lifetime {
    instance: Arc<()>,
    generation: u64,
    retired: bool,
    projection: projection::ProjectionState,
    pending: Option<String>,
    channel: Option<u64>,
    awaiting_start: bool,
}
impl Lifetime {
    pub(super) fn new() -> Self {
        Self {
            instance: Arc::new(()),
            generation: 1,
            retired: false,
            projection: projection::ProjectionState::new(),
            pending: None,
            channel: None,
            awaiting_start: false,
        }
    }
    pub(super) fn snapshot(&self) -> Option<Generation> {
        self.admitted().then(|| Generation {
            instance: Arc::clone(&self.instance),
            generation: self.generation,
        })
    }
    pub(super) fn admitted(&self) -> bool {
        // Trusted Started precedes frontend bootstrap; Finished is not an IPC readiness barrier.
        !self.retired && !self.awaiting_start
    }
    pub(super) fn current(&self, lease: &Generation) -> bool {
        self.admitted()
            && Arc::ptr_eq(&self.instance, &lease.instance)
            && self.generation == lease.generation
    }
    pub(super) fn retire(&mut self) {
        self.revoke_projection(ProjectionRevocation::Retired);
        self.retired = true;
        self.channel = None;
        self.pending = None;
    }
    pub(super) fn requested(&mut self, url: String) -> bool {
        if self.retired || self.pending.is_some() {
            self.retire();
            return false;
        }
        self.started(url);
        self.awaiting_start = !self.retired;
        !self.retired
    }
    pub(super) fn started(&mut self, url: String) {
        if self.awaiting_start && self.pending.as_deref() == Some(url.as_str()) {
            self.awaiting_start = false;
            return;
        }
        self.revoke_projection(ProjectionRevocation::Navigation);
        self.channel = None;
        if self.retired {
            return;
        }
        if self.pending.is_some() {
            self.retire();
            return;
        }
        match self.generation.checked_add(1) {
            Some(next) => {
                self.generation = next;
                self.pending = Some(url);
            }
            None => self.retire(),
        }
    }
    pub(super) fn finished(&mut self, url: &str) {
        if self
            .pending
            .as_deref()
            .is_some_and(|pending| pending != url)
        {
            self.retire();
            return;
        }
        if !self.retired && !self.awaiting_start && self.pending.as_deref() == Some(url) {
            self.pending = None;
        }
    }
    pub(super) fn set_channel(&mut self, lease: &Generation, epoch: Option<u64>) -> bool {
        if !self.current(lease) {
            return false;
        }
        self.channel = epoch;
        true
    }
    pub(super) fn channel_matches(&self, lease: &Generation, epoch: Option<u64>) -> bool {
        self.current(lease) && self.channel == epoch
    }
}

#[cfg(test)]
#[path = "main_lifetime_tests.rs"]
mod tests;
