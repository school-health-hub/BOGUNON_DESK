use super::{
    assets,
    identity::Owned,
    model::{Gate, Model},
    settings::{self, Settings, LABEL},
    Error, Observation,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
#[path = "bridge.rs"]
mod bridge;
#[path = "cleanup.rs"]
mod cleanup;
pub(crate) use bridge::navigation;
pub use cleanup::{CleanupObservation, ConstructionOwnership, ResourcePresence};
#[derive(Default)]
pub struct Adapter(Arc<Inner>);
#[derive(Default)]
struct Inner {
    model: Mutex<Model>,
    owned: OnceLock<Owned>,
    construction_attempted: AtomicBool,
    close_attempted: AtomicBool,
    destroy_attempted: AtomicBool,
}
impl Clone for Adapter {
    fn clone(&self) -> Self {
        Self(Arc::clone(&self.0))
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Status {
    pub phase: super::Phase,
    pub cleanup: super::Cleanup,
    pub replacement_allowed: bool,
}
impl Adapter {
    pub fn status(&self) -> Result<Status, Error> {
        let model = self.0.model.lock().map_err(|_| Error::Unknown)?;
        Ok(Status {
            phase: model.phase(),
            cleanup: model.cleanup(),
            replacement_allowed: model.replacement_allowed(),
        })
    }
    pub fn enabled(&self) -> bool {
        self.0.model.lock().is_ok_and(|m| m.enabled())
    }
    /// No enable setter, IPC command or startup caller exists in this stage.
    /// Actual UDF/environment verification and execution approval remain external prerequisites.
    pub fn request_create<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), Error> {
        if !self.enabled() {
            return Err(Error::Disabled);
        }
        let main = crate::main_lifetime::snapshot(app).map_err(|_| Error::MainUnavailable)?;
        let root = app.path().local_data_dir().map_err(|_| Error::Isolation)?;
        let settings = Settings::new(&root)?;
        let isolation =
            super::isolation::preflight(&root.join(&app.config().identifier), &settings.directory)
                .map_err(|_| Error::Isolation)?;
        let (_, surface_directory) = isolation.canonical_directories();
        let request = {
            let mut model = self.0.model.lock().map_err(|_| Error::Unknown)?;
            let request = model.request(1);
            model.begin(
                &request,
                Gate {
                    main: crate::main_lifetime::current(app, &main),
                    isolation: isolation.effective_admitted(),
                    acl: settings::acl_valid(),
                    assets: assets::available(),
                    explorer_disabled: true,
                },
            )?;
            request
        };
        // Configuration observation cannot certify the effective runtime environment.
        // Even a future enable toggle alone cannot authorize WebView construction.
        if app.get_webview_window(LABEL).is_some() {
            self.record(&request, Observation::CreateFailed);
            return Err(Error::Identity);
        }
        if !crate::main_lifetime::current(app, &main) {
            self.record(&request, Observation::MainRetired);
            return Err(Error::MainUnavailable);
        }
        let blank = tauri::Url::parse("about:blank").map_err(|_| Error::Native)?;
        let navigation = self.clone();
        let popup = self.clone();
        let download = self.clone();
        let navigation_request = request.clone();
        let popup_request = request.clone();
        let download_request = request.clone();
        self.0.construction_attempted.store(true, Ordering::SeqCst);
        let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(blank))
            .title("BOGUNON DESK Surface")
            .visible(false)
            .focused(false)
            .inner_size(440.0, 520.0)
            .data_directory(surface_directory.to_path_buf())
            .use_https_scheme(true)
            .disable_drag_drop_handler()
            .on_navigation(move |url| navigation.builder_navigation(&navigation_request, url))
            .on_new_window(move |_, _| {
                popup.record(&popup_request, Observation::NavigationDenied);
                tauri::webview::NewWindowResponse::Deny
            })
            .on_download(move |_, _| {
                download.record(&download_request, Observation::NavigationDenied);
                false
            })
            .build()
            .map_err(|_| {
                // No returned handle: partial creation ownership remains unknown.
                // Never destroy a resource obtained only by label after build failure.
                self.record(&request, Observation::CreateFailed);
                Error::Native
            })?;
        self.attach_events(&window, request.clone());
        // No model/ledger lock is retained across any Tauri call.
        let owned = Owned::pin(&window, request.clone(), main);
        if self.0.owned.set(owned).is_err() {
            self.record(&request, Observation::CreateFailed);
            let _ = window.destroy();
            return Err(Error::Unknown);
        }
        let current = self
            .0
            .owned
            .get()
            .is_some_and(|o| crate::main_lifetime::current(app, &o.main));
        if !current || !self.owns_current(app) {
            self.record(&request, Observation::CreateFailed);
            let _ = self.destroy_owned(app);
            return Err(Error::Unknown);
        }
        let created = self
            .0
            .model
            .lock()
            .map_err(|_| Error::Unknown)
            .and_then(|mut model| model.created(&request));
        if let Err(error) = created {
            self.record(&request, Observation::CreateFailed);
            let _ = self.destroy_owned(app);
            return Err(error);
        }
        if window.navigate(settings.url).is_err() {
            self.record(&request, Observation::NavigationDenied);
            let _ = self.destroy_owned(app);
            return Err(Error::Native);
        }
        Ok(())
    }
    pub fn request_close<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), Error> {
        let window = self.owned_window(app)?;
        if self.0.close_attempted.swap(true, Ordering::SeqCst) {
            return Err(Error::Closed);
        }
        self.invalidate(Observation::CloseRequested);
        window.close().map_err(|_| {
            self.invalidate(Observation::ResourceMissing);
            Error::Unknown
        })
    }
    /// Independent own-resource cleanup attempt; never emits a cleanup receipt.
    pub fn destroy_owned<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), Error> {
        let window = self.owned_window(app)?;
        if self.0.destroy_attempted.swap(true, Ordering::SeqCst) {
            return Err(Error::Closed);
        }
        self.invalidate(Observation::CloseRequested);
        window.destroy().map_err(|_| {
            self.invalidate(Observation::ResourceMissing);
            Error::Unknown
        })
    }
    fn owned_window<R: Runtime>(
        &self,
        app: &AppHandle<R>,
    ) -> Result<tauri::WebviewWindow<R>, Error> {
        let owned = self.0.owned.get().ok_or(Error::Closed)?;
        let Some(window) = app.get_webview_window(LABEL) else {
            self.invalidate(Observation::ResourceMissing);
            return Err(Error::Unknown);
        };
        let view: &tauri::Webview<R> = window.as_ref();
        if !owned.owns_view(view) {
            self.invalidate(Observation::ResourceMissing);
            return Err(Error::Identity);
        }
        Ok(window)
    }
    fn owns_current<R: Runtime>(&self, app: &AppHandle<R>) -> bool {
        self.owned_window(app).is_ok()
    }
    fn record(&self, request: &super::model::CreationRequest, observation: Observation) {
        if let Ok(mut model) = self.0.model.lock() {
            let _ = model.observe(request, observation);
        }
    }
    fn invalidate(&self, observation: Observation) {
        if let Some(o) = self.0.owned.get() {
            self.record(&o.request, observation);
        }
    }
}
/// Registers an inert protocol/state only. Never requests a Surface window.
pub fn configure<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(Adapter::default())
        .register_uri_scheme_protocol("bogunon-surface", |context, request| {
            let allowed = context.webview_label() == LABEL
                && context
                    .app_handle()
                    .try_state::<Adapter>()
                    .is_some_and(|adapter| adapter.can_deliver(context.app_handle()));
            if allowed {
                assets::response(&request)
            } else {
                let mut response = tauri::http::Response::new(Vec::<u8>::new());
                *response.status_mut() = tauri::http::StatusCode::FORBIDDEN;
                response
            }
        })
}
