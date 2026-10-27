//! Shared setup pins Main once. No Main recreation is provided.
use crate::{main_caller::MainCallerGuard, main_events::MainEvents, main_lifetime};
use std::fmt;
use tauri::{AppHandle, Builder, Manager, Wry};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum InstallStage {
    Caller,
    Lifetime,
    Events,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum InstallProgress {
    Started(InstallStage),
    Completed(InstallStage),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum InstallError {
    Caller,
    Lifetime(main_lifetime::InstallError),
    Events,
}

impl fmt::Display for InstallError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Caller => "Main caller security installation failed",
            Self::Lifetime(_) => "Main lifetime security installation failed",
            Self::Events => "Main event security installation failed",
        })
    }
}

impl std::error::Error for InstallError {}

pub(crate) fn configure(builder: Builder<Wry>) -> Builder<Wry> {
    builder
        .manage(MainCallerGuard::default())
        .manage(main_lifetime::MainLifetime::default())
        .manage(MainEvents::default())
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("main-navigation")
                .on_navigation(|view, url| {
                    let allowed = main_lifetime::navigation(view, url);
                    if let Some(events) = view.try_state::<MainEvents>() {
                        events.invalidate_channel_for(view);
                    }
                    allowed
                })
                .build(),
        )
        .on_page_load(|view, payload| {
            main_lifetime::page_load(view, payload);
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                if let Some(events) = view.try_state::<MainEvents>() {
                    events.invalidate_channel_for(view);
                }
            }
        })
}

pub(crate) fn install(app: &AppHandle) -> Result<(), InstallError> {
    install_observed(app, |_| {})
}

pub(crate) fn install_observed(
    app: &AppHandle,
    mut observe: impl FnMut(InstallProgress),
) -> Result<(), InstallError> {
    install_steps(
        &mut observe,
        || app.state::<MainCallerGuard>().install(app).map_err(|_| ()),
        || main_lifetime::install(app),
        || app.state::<MainEvents>().install(app).map_err(|_| ()),
    )
}

fn install_steps(
    observe: &mut impl FnMut(InstallProgress),
    caller: impl FnOnce() -> Result<(), ()>,
    lifetime: impl FnOnce() -> Result<(), main_lifetime::InstallError>,
    events: impl FnOnce() -> Result<(), ()>,
) -> Result<(), InstallError> {
    observe(InstallProgress::Started(InstallStage::Caller));
    caller().map_err(|()| InstallError::Caller)?;
    observe(InstallProgress::Completed(InstallStage::Caller));
    observe(InstallProgress::Started(InstallStage::Lifetime));
    lifetime().map_err(InstallError::Lifetime)?;
    observe(InstallProgress::Completed(InstallStage::Lifetime));
    observe(InstallProgress::Started(InstallStage::Events));
    events().map_err(|()| InstallError::Events)?;
    observe(InstallProgress::Completed(InstallStage::Events));
    Ok(())
}

#[cfg(test)]
#[path = "main_security_tests.rs"]
mod tests;
