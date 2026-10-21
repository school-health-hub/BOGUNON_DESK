use super::{BusinessEvent, Envelope, Identity, MainEvents, MainLease, Observed, UNAVAILABLE};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, Webview, WebviewWindow};

impl MainLease {
    pub(crate) fn current(&self, app: &AppHandle) -> bool {
        app.try_state::<MainEvents>().is_some_and(|state| {
            crate::main_lifetime::channel_matches(app, &self.2, self.1)
                && self.0.authorize(&state.observe(app, None))
                && state
                    .channel
                    .lock()
                    .is_ok_and(|channel| channel.matches(self.1))
        })
    }
    pub(crate) fn main(&self, app: &AppHandle) -> Result<WebviewWindow, String> {
        let main = app.get_webview_window("main").ok_or(UNAVAILABLE)?;
        let state = app.try_state::<MainEvents>().ok_or(UNAVAILABLE)?;
        let registered = state.registration.get().ok_or(UNAVAILABLE)?;
        let view: &Webview = main.as_ref();
        let webview = view
            .resources_table()
            .get::<Identity>(registered.webview)
            .ok();
        let window = view
            .window()
            .resources_table()
            .get::<Identity>(registered.window)
            .ok();
        let observed = Observed {
            webview,
            window,
            caller_window: None,
            revoked: state.retired.load(Ordering::SeqCst),
        };
        if !crate::main_lifetime::current(app, &self.2)
            || !self.0.authorize(&observed)
            || !crate::main_caller::is_registered_main(view)
        {
            return Err(UNAVAILABLE.into());
        }
        Ok(main)
    }
    pub(crate) fn emit<S: serde::Serialize>(
        &self,
        app: &AppHandle,
        event: BusinessEvent,
        payload: S,
    ) -> Result<(), String> {
        let payload =
            serde_json::to_value(payload).map_err(|_| "Main event serialization failed")?;
        let state = app.try_state::<MainEvents>().ok_or(UNAVAILABLE)?;
        let mut channel = state.channel.lock().map_err(|_| UNAVAILABLE)?;
        self.main(app)?;
        let result = channel
            .deliver(self.1, |destination, transfer| {
                Envelope {
                    event: event.name(),
                    payload,
                }
                .send_frames(destination, transfer, || {
                    crate::main_lifetime::channel_matches(app, &self.2, self.1)
                })
            })
            .map_err(|_| UNAVAILABLE.to_owned());
        if result.is_err() {
            crate::main_lifetime::set_channel(app, &self.2, None);
        }
        result
    }
}
