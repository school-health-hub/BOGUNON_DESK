use std::cell::Cell;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationResult {
    Pending,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RendererMessageFailure {
    Source,
    Payload,
    Contract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RendererSignal {
    WaitingForNavigation,
    WaitingForReady,
    Ready,
    NavigationFailed,
    MessageRejected(RendererMessageFailure),
}

pub struct RendererRuntimeState {
    navigation: Cell<NavigationResult>,
    ready: Cell<bool>,
    message_failure: Cell<Option<RendererMessageFailure>>,
}

impl RendererRuntimeState {
    pub const fn new() -> Self {
        Self {
            navigation: Cell::new(NavigationResult::Pending),
            ready: Cell::new(false),
            message_failure: Cell::new(None),
        }
    }

    pub fn finish_navigation(&self, result: NavigationResult) {
        if self.navigation.get() == NavigationResult::Pending {
            self.navigation.set(result);
        }
    }

    pub fn mark_ready(&self) -> bool {
        if self.ready.replace(true) {
            return false;
        }
        true
    }

    pub fn reject_message(&self, failure: RendererMessageFailure) {
        if self.message_failure.get().is_none() {
            self.message_failure.set(Some(failure));
        }
    }

    pub fn signal(&self) -> RendererSignal {
        if let Some(failure) = self.message_failure.get() {
            return RendererSignal::MessageRejected(failure);
        }
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
