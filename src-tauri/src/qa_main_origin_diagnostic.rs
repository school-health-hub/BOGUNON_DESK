//! Fixed observations only. No URL, authority, path or error text is retained.
use serde::Serialize;
use tauri::Url;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MainOriginState {
    MainWebviewMissing,
    UrlUnavailable,
    InitialNavigationPending,
    ExpectedOrigin,
    UnexpectedOrigin,
    UrlParseFailed,
}

pub(crate) fn origin_reading(url: &Url, allowed: bool) -> MainOriginState {
    if allowed {
        MainOriginState::ExpectedOrigin
    } else if url.as_str() == "about:blank" {
        // A bootstrap marker, not proof that navigation will complete.
        MainOriginState::InitialNavigationPending
    } else {
        MainOriginState::UnexpectedOrigin
    }
}

#[cfg(test)]
#[path = "qa_main_origin_diagnostic_tests.rs"]
mod tests;
