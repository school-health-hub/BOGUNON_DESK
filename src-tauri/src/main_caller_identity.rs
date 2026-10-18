//! Private resource identities, not labels or JS-supplied credentials, bind Main.
use std::{future::Future, sync::Arc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum Error {
    NotMain,
    IdentityMismatch,
    MainUnavailable,
    Unregistered,
    AlreadyRegistered,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Main caller authorization failed")
    }
}
impl std::error::Error for Error {}

/// Existing errors keep their wire representation; caller rejection is typed.
#[derive(Debug, serde::Serialize)]
#[serde(untagged)]
pub(crate) enum CommandError<E> {
    Caller { caller_guard: Error },
    Existing(E),
}
impl<E> CommandError<E> {
    pub(super) const fn caller(error: Error) -> Self {
        Self::Caller {
            caller_guard: error,
        }
    }
}

pub(super) struct Identity;
pub(super) struct Pinned {
    pub(super) webview: Arc<Identity>,
    pub(super) window: Arc<Identity>,
}
pub(super) struct Observed<'a> {
    pub(super) webview_label: &'a str,
    pub(super) window_label: &'a str,
    pub(super) caller_webview: Option<Arc<Identity>>,
    pub(super) caller_window: Option<Arc<Identity>>,
    pub(super) registered_webview: Option<Arc<Identity>>,
    pub(super) registered_window: Option<Arc<Identity>>,
}
pub(super) struct Permit(());
impl Pinned {
    pub(super) fn authorize(&self, observed: Observed<'_>) -> Result<Permit, Error> {
        if observed.webview_label != "main" || observed.window_label != "main" {
            return Err(Error::NotMain);
        }
        for (actual, expected) in [
            (observed.registered_webview.as_ref(), &self.webview),
            (observed.registered_window.as_ref(), &self.window),
        ] {
            if !actual.is_some_and(|actual| Arc::ptr_eq(actual, expected)) {
                return Err(Error::MainUnavailable);
            }
        }
        for (actual, expected) in [
            (observed.caller_webview.as_ref(), &self.webview),
            (observed.caller_window.as_ref(), &self.window),
        ] {
            if !actual.is_some_and(|actual| Arc::ptr_eq(actual, expected)) {
                return Err(Error::IdentityMismatch);
            }
        }
        Ok(Permit(()))
    }
}
impl Permit {
    pub(super) fn run<T, E>(
        self,
        operation: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, CommandError<E>> {
        operation().map_err(CommandError::Existing)
    }
    pub(super) async fn run_async<T, E, F: Future<Output = Result<T, E>>>(
        self,
        operation: impl FnOnce() -> F,
    ) -> Result<T, CommandError<E>> {
        operation().await.map_err(CommandError::Existing)
    }
}

pub(super) fn dispatch<T, E>(
    authorization: Result<Permit, Error>,
    operation: impl FnOnce() -> Result<T, E>,
) -> Result<T, CommandError<E>> {
    authorization.map_err(CommandError::caller)?.run(operation)
}
pub(super) async fn dispatch_async<T, E, F: Future<Output = Result<T, E>>>(
    authorization: Result<Permit, Error>,
    operation: impl FnOnce() -> F,
) -> Result<T, CommandError<E>> {
    authorization
        .map_err(CommandError::caller)?
        .run_async(operation)
        .await
}

#[cfg(test)]
#[path = "main_caller_identity_tests.rs"]
mod tests;
