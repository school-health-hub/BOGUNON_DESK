//! Shared setup pins Main once. No Main recreation is provided.
use crate::{main_caller::MainCallerGuard, main_events::MainEvents, main_lifetime};
use tauri::{AppHandle, Builder, Manager, Wry};

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

pub(crate) fn install(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.state::<MainCallerGuard>().install(app)?;
    main_lifetime::install(app)?;
    app.state::<MainEvents>().install(app)?;
    Ok(())
}
