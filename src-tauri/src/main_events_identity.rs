//! Pure admission policy for the setup-created Main webview and window.
//!
//! The parent pins one pair of Arc identities for a single setup lifetime. These
//! tokens are not a general window replacement registry: a new resource cannot
//! inherit authority from a label or a reused numeric resource ID.

use std::sync::Arc;

#[derive(Debug)]
pub(super) struct Identity;

#[derive(Clone)]
pub(super) struct Lease {
    webview: Arc<Identity>,
    window: Arc<Identity>,
}

pub(super) struct Observed {
    pub(super) webview: Option<Arc<Identity>>,
    pub(super) window: Option<Arc<Identity>>,
    pub(super) caller_window: Option<Arc<Identity>>,
    pub(super) revoked: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Event {
    Close { close_to_tray: bool, quitting: bool },
    Drop { purchase_active: bool },
    Destroyed,
    Other,
    FocusOther,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Action {
    HideMain,
    AnalyzeDrop,
    ForwardDrop,
    RetireMain,
    Ignore,
}

impl Lease {
    pub(super) const fn new(webview: Arc<Identity>, window: Arc<Identity>) -> Self {
        Self { webview, window }
    }

    pub(super) fn owns_window(&self, window: &Arc<Identity>) -> bool {
        Arc::ptr_eq(&self.window, window)
    }

    pub(super) fn authorize(&self, observed: &Observed) -> bool {
        !observed.revoked
            && observed
                .webview
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(current, &self.webview))
            && observed
                .window
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(current, &self.window))
    }

    pub(super) fn authorize_window(&self, observed: &Observed) -> bool {
        self.authorize(observed)
            && observed
                .caller_window
                .as_ref()
                .is_some_and(|caller| Arc::ptr_eq(caller, &self.window))
    }

    pub(super) fn dispatch(
        &self,
        observed: &Observed,
        event: Event,
        effect: impl FnOnce(Action),
    ) -> bool {
        if !self.authorize_window(observed) {
            return false;
        }
        let action = event.action();
        if action == Action::Ignore {
            return false;
        }
        effect(action);
        true
    }
}

impl Event {
    const fn action(self) -> Action {
        match self {
            Self::Close {
                close_to_tray: true,
                quitting: false,
            } => Action::HideMain,
            Self::Close { .. } | Self::Other | Self::FocusOther => Action::Ignore,
            Self::Drop {
                purchase_active: true,
            } => Action::AnalyzeDrop,
            Self::Drop {
                purchase_active: false,
            } => Action::ForwardDrop,
            Self::Destroyed => Action::RetireMain,
        }
    }
}

#[cfg(test)]
#[path = "main_events_identity_tests.rs"]
mod tests;
