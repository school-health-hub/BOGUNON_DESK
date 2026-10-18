//! Main-local delivery for locked Tauri 2.11.5. No manager event broadcast.
//! A lease is the single setup lifetime, not a recreation/navigation registry.
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, OnceLock,
};
use tauri::{AppHandle, Manager, Resource, ResourceId, Webview, WebviewWindow, Window};

#[path = "main_events_identity.rs"]
mod identity;
pub(crate) use identity::{Action, Event as WindowInput};
use identity::{Identity, Lease, Observed};

impl Resource for Identity {}
struct Registration {
    lease: Lease,
    webview: ResourceId,
    window: ResourceId,
}
#[derive(Default)]
pub(crate) struct MainEvents {
    registration: OnceLock<Registration>,
    retired: AtomicBool,
}
#[derive(Clone)]
pub(crate) struct MainLease(Lease);

#[derive(Clone, Copy)]
pub(crate) enum BusinessEvent {
    Navigate,
    Notice,
    FileDrop,
    AnalysisStart,
    Analysis,
    AnalysisError,
}
impl BusinessEvent {
    const fn name(self) -> &'static str {
        match self {
            Self::Navigate => "desktop:navigate",
            Self::Notice => "desktop:notice",
            Self::FileDrop => "desktop:file-drop",
            Self::AnalysisStart => "purchase:analysis-start",
            Self::Analysis => "purchase:analysis",
            Self::AnalysisError => "purchase:analysis-error",
        }
    }
}
const UNAVAILABLE: &str = "Main event destination unavailable";

impl MainEvents {
    pub(crate) fn install(&self, app: &AppHandle) -> Result<(), String> {
        if !audited_framework() || self.registration.get().is_some() {
            return Err(UNAVAILABLE.into());
        }
        let main = app.get_webview_window("main").ok_or(UNAVAILABLE)?;
        let view: &Webview = main.as_ref();
        crate::main_caller::run(view, || {
            let webview = Arc::new(Identity);
            let window = Arc::new(Identity);
            let webview_id = view.resources_table().add_arc(Arc::clone(&webview));
            let window_id = view.window().resources_table().add_arc(Arc::clone(&window));
            self.registration
                .set(Registration {
                    lease: Lease::new(webview, window),
                    webview: webview_id,
                    window: window_id,
                })
                .map_err(|_| UNAVAILABLE.to_owned())
        })
        .map_err(|_| UNAVAILABLE.to_owned())
    }
    fn observe(&self, app: &AppHandle, caller: Option<&Window>) -> Observed {
        let mut result = Observed {
            webview: None,
            window: None,
            caller_window: None,
            revoked: self.retired.load(Ordering::SeqCst),
        };
        if let (Some(registered), Some(main)) =
            (self.registration.get(), app.get_webview_window("main"))
        {
            let view: &Webview = main.as_ref();
            if crate::main_caller::run(view, || Ok::<_, String>(())).is_ok() {
                result.webview = view
                    .resources_table()
                    .get::<Identity>(registered.webview)
                    .ok();
                result.window = view
                    .window()
                    .resources_table()
                    .get::<Identity>(registered.window)
                    .ok();
            }
            result.caller_window = caller.and_then(|window| {
                window
                    .resources_table()
                    .get::<Identity>(registered.window)
                    .ok()
            });
        }
        result
    }
    pub(crate) fn capture(&self, app: &AppHandle) -> Result<MainLease, String> {
        let registered = self.registration.get().ok_or(UNAVAILABLE)?;
        if !registered.lease.authorize(&self.observe(app, None)) {
            return Err(UNAVAILABLE.into());
        }
        Ok(MainLease(registered.lease.clone()))
    }
    pub(crate) fn window_action(&self, window: &Window, input: WindowInput) -> Action {
        let Some(registered) = self.registration.get() else {
            return Action::Ignore;
        };
        let mut action = Action::Ignore;
        registered.lease.dispatch(
            &self.observe(window.app_handle(), Some(window)),
            input,
            |result| action = result,
        );
        action
    }
    pub(crate) fn is_main_window(&self, window: &Window) -> bool {
        self.registration.get().is_some_and(|registered| {
            registered
                .lease
                .authorize_window(&self.observe(window.app_handle(), Some(window)))
        })
    }
    pub(crate) fn retire_window(&self, window: &Window) {
        let Some(registered) = self.registration.get() else {
            return;
        };
        let token = window
            .resources_table()
            .get::<Identity>(registered.window)
            .ok();
        if token
            .as_ref()
            .is_some_and(|token| registered.lease.owns_window(token))
        {
            self.retired.store(true, Ordering::SeqCst);
        }
    }
}
impl MainLease {
    pub(crate) fn current(&self, app: &AppHandle) -> bool {
        app.try_state::<MainEvents>()
            .is_some_and(|state| self.0.authorize(&state.observe(app, None)))
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
        if !self.0.authorize(&observed)
            || crate::main_caller::run(view, || Ok::<_, String>(())).is_err()
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
        let main = self.main(app)?;
        let data = serde_json::to_string(&Envelope {
            event: event.name(),
            payload,
        })
        .map_err(|_| "Main event serialization failed")?;
        let script = format!("({})({});", include_str!("main_events_delivery.js"), data);
        // Recheck after serialization. eval schedules only this validated handle; it is not a receipt.
        if !self.current(app) {
            return Err(UNAVAILABLE.into());
        }
        main.eval(script)
            .map_err(|_| "Main event scheduling failed".to_owned())
    }
}
pub(crate) fn capture(app: &AppHandle) -> Result<MainLease, String> {
    app.try_state::<MainEvents>()
        .ok_or(UNAVAILABLE)?
        .capture(app)
}
pub(crate) fn emit<S: serde::Serialize>(
    app: &AppHandle,
    event: BusinessEvent,
    payload: S,
) -> Result<(), String> {
    capture(app)?.emit(app, event, payload)
}

#[derive(serde::Serialize)]
struct Envelope<S> {
    event: &'static str,
    payload: S,
}

fn audited_framework() -> bool {
    let mut lines = include_str!("../Cargo.lock").lines();
    lines.any(|line| line == "name = \"tauri\"") && lines.next() == Some("version = \"2.11.5\"")
}
