use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Manager, Resource, ResourceId, Runtime, Url, Webview, Window};
#[path = "main_lifetime_state.rs"]
mod state;
use state::{Generation, Lifetime};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum InstallError {
    StateMissing,
    MainConfigMissing,
    AppUrlInvalid,
    MainWebviewMissing,
    WebviewUrlUnavailable,
    OriginMismatch,
    StateUnavailable,
    AlreadyInstalled,
    ResourceRegistrationFailed,
}
struct Identity;
impl Resource for Identity {}
struct Registration {
    webview: Arc<Identity>,
    window: Arc<Identity>,
    view_id: ResourceId,
    window_id: ResourceId,
}
#[derive(Default)]
pub(crate) struct MainLifetime {
    registration: OnceLock<Registration>,
    state: Mutex<Option<Lifetime>>,
}
#[derive(Clone)]
pub(crate) struct Lease(Generation);
const UNAVAILABLE: &str = "Main lifetime unavailable";
#[path = "main_lifetime_origin.rs"]
mod origin;
fn local<R: Runtime>(app: &AppHandle<R>, url: &Url) -> bool {
    if tauri::is_dev() {
        return app
            .config()
            .build
            .dev_url
            .as_ref()
            .is_some_and(|expected| origin::matches_origin(url, expected));
    }
    let https = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .is_some_and(|window| window.use_https_scheme);
    let expected = if https {
        "https://tauri.localhost"
    } else {
        "http://tauri.localhost"
    };
    Url::parse(expected).is_ok_and(|expected| origin::matches_origin(url, &expected))
}
impl MainLifetime {
    fn owns<R: Runtime>(&self, view: &Webview<R>) -> bool {
        let Some(reg) = self.registration.get() else {
            return false;
        };
        view.label() == "main"
            && view.window().label() == "main"
            && view
                .resources_table()
                .get::<Identity>(reg.view_id)
                .is_ok_and(|id| Arc::ptr_eq(&id, &reg.webview))
            && view
                .window()
                .resources_table()
                .get::<Identity>(reg.window_id)
                .is_ok_and(|id| Arc::ptr_eq(&id, &reg.window))
    }
    fn valid<R: Runtime>(&self, app: &AppHandle<R>) -> bool {
        app.get_webview_window("main").is_some_and(|main| {
            let view: &Webview<R> = main.as_ref();
            self.owns(view)
        })
    }
}
pub(crate) fn install<R: Runtime>(app: &AppHandle<R>) -> Result<(), InstallError> {
    let registry = app
        .try_state::<MainLifetime>()
        .ok_or(InstallError::StateMissing)?;
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or(InstallError::MainConfigMissing)?;
    if !matches!(&config.url, tauri::WebviewUrl::App(_)) {
        return Err(InstallError::AppUrlInvalid);
    }
    let main = app
        .get_webview_window("main")
        .ok_or(InstallError::MainWebviewMissing)?;
    let view: &Webview<R> = main.as_ref();
    let current_url = view
        .url()
        .map_err(|_| InstallError::WebviewUrlUnavailable)?;
    if !local(app, &current_url) {
        return Err(InstallError::OriginMismatch);
    }
    let mut state = registry
        .state
        .lock()
        .map_err(|_| InstallError::StateUnavailable)?;
    if registry.registration.get().is_some() || state.is_some() {
        return Err(InstallError::AlreadyInstalled);
    }
    let webview = Arc::new(Identity);
    let window = Arc::new(Identity);
    let view_id = view.resources_table().add_arc(Arc::clone(&webview));
    let window_id = view.window().resources_table().add_arc(Arc::clone(&window));
    registry
        .registration
        .set(Registration {
            webview,
            window,
            view_id,
            window_id,
        })
        .map_err(|_| InstallError::ResourceRegistrationFailed)?;
    *state = Some(Lifetime::new());
    Ok(())
}
pub(crate) fn snapshot<R: Runtime>(app: &AppHandle<R>) -> Result<Lease, String> {
    let registry = app.try_state::<MainLifetime>().ok_or(UNAVAILABLE)?;
    let state = registry.state.lock().map_err(|_| UNAVAILABLE)?;
    if !registry.valid(app) {
        return Err(UNAVAILABLE.into());
    }
    state
        .as_ref()
        .and_then(Lifetime::snapshot)
        .map(Lease)
        .ok_or_else(|| UNAVAILABLE.into())
}
pub(crate) fn admit<R: Runtime>(app: &AppHandle<R>) -> bool {
    snapshot(app).is_ok()
}
pub(crate) fn current<R: Runtime>(app: &AppHandle<R>, lease: &Lease) -> bool {
    app.try_state::<MainLifetime>().is_some_and(|registry| {
        registry.state.lock().is_ok_and(|state| {
            registry.valid(app) && state.as_ref().is_some_and(|state| state.current(&lease.0))
        })
    })
}
pub(crate) fn set_channel<R: Runtime>(
    app: &AppHandle<R>,
    lease: &Lease,
    epoch: Option<u64>,
) -> bool {
    app.try_state::<MainLifetime>().is_some_and(|registry| {
        registry.state.lock().is_ok_and(|mut state| {
            registry.valid(app)
                && state
                    .as_mut()
                    .is_some_and(|state| state.set_channel(&lease.0, epoch))
        })
    })
}
pub(crate) fn channel_matches<R: Runtime>(
    app: &AppHandle<R>,
    lease: &Lease,
    epoch: Option<u64>,
) -> bool {
    app.try_state::<MainLifetime>().is_some_and(|registry| {
        registry.state.lock().is_ok_and(|state| {
            registry.valid(app)
                && state
                    .as_ref()
                    .is_some_and(|state| state.channel_matches(&lease.0, epoch))
        })
    })
}
pub(crate) fn navigation<R: Runtime>(view: &Webview<R>, url: &Url) -> bool {
    let allowed = local(view.app_handle(), url);
    let Some(registry) = view.try_state::<MainLifetime>() else {
        return allowed;
    };
    if registry.registration.get().is_none() {
        return allowed;
    }
    if !registry.owns(view) {
        return false;
    }
    let result = match registry.state.lock() {
        Ok(mut state) => match state.as_mut() {
            Some(state) => {
                if !allowed {
                    state.retire();
                }
                allowed && state.requested(url.to_string())
            }
            None => false,
        },
        Err(_) => false,
    };
    result
}
pub(crate) fn page_load<R: Runtime>(
    view: &Webview<R>,
    payload: &tauri::webview::PageLoadPayload<'_>,
) {
    let Some(registry) = view.try_state::<MainLifetime>() else {
        return;
    };
    if !registry.owns(view) {
        return;
    }
    if let Ok(mut state) = registry.state.lock() {
        if let Some(state) = state.as_mut() {
            if !local(view.app_handle(), payload.url()) {
                state.retire();
                return;
            }
            match payload.event() {
                tauri::webview::PageLoadEvent::Started => state.started(payload.url().to_string()),
                tauri::webview::PageLoadEvent::Finished => state.finished(payload.url().as_str()),
            }
        }
    };
}
pub(crate) fn retire<R: Runtime>(window: &Window<R>) {
    let Some(registry) = window.try_state::<MainLifetime>() else {
        return;
    };
    let Some(reg) = registry.registration.get() else {
        return;
    };
    if window
        .resources_table()
        .get::<Identity>(reg.window_id)
        .is_ok_and(|id| Arc::ptr_eq(&id, &reg.window))
    {
        if let Ok(mut state) = registry.state.lock() {
            if let Some(state) = state.as_mut() {
                state.retire();
            }
        }
    }
}

pub(crate) fn caller_local<R: Runtime>(view: &Webview<R>) -> bool {
    view.url().is_ok_and(|url| local(view.app_handle(), &url))
}
