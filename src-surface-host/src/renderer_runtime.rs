use std::cell::Cell;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationResult {
    Pending,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RendererSignal {
    WaitingForNavigation,
    WaitingForReady,
    Ready,
    NavigationFailed,
}

pub struct RendererRuntimeState {
    navigation: Cell<NavigationResult>,
    ready: Cell<bool>,
}

impl RendererRuntimeState {
    pub const fn new() -> Self {
        Self {
            navigation: Cell::new(NavigationResult::Pending),
            ready: Cell::new(false),
        }
    }

    pub fn finish_navigation(&self, result: NavigationResult) {
        if self.navigation.get() == NavigationResult::Pending {
            self.navigation.set(result);
        }
    }

    pub fn mark_ready(&self) -> bool {
        if self.navigation.get() != NavigationResult::Succeeded || self.ready.replace(true) {
            return false;
        }
        true
    }

    pub fn signal(&self) -> RendererSignal {
        match (self.navigation.get(), self.ready.get()) {
            (NavigationResult::Pending, _) => RendererSignal::WaitingForNavigation,
            (NavigationResult::Failed, _) => RendererSignal::NavigationFailed,
            (NavigationResult::Succeeded, false) => RendererSignal::WaitingForReady,
            (NavigationResult::Succeeded, true) => RendererSignal::Ready,
        }
    }
}

impl Default for RendererRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
