use super::Adapter;
use crate::surface_adapter::{
    model::Phase,
    settings::{self, LABEL},
    Observation,
};
use tauri::{AppHandle, Manager, Runtime, Url, Webview, WebviewWindow, WindowEvent};
impl Adapter {
    pub(super) fn builder_navigation(&self, url: &Url) -> bool {
        let allowed = self.0.model.lock().is_ok_and(|model| match model.phase() {
            Phase::Creating => url.as_str() == "about:blank",
            Phase::Live => settings::local(url),
            Phase::Dormant
            | Phase::Closing
            | Phase::Destroyed
            | Phase::Missing
            | Phase::Unknown => false,
        });
        if !allowed {
            self.invalidate(Observation::NavigationDenied);
        }
        allowed
    }
    pub(super) fn can_deliver<R: Runtime>(&self, app: &AppHandle<R>) -> bool {
        let Some(owned) = self.0.owned.get() else {
            return false;
        };
        let admitted = crate::main_lifetime::current(app, &owned.main)
            && self.owns_current(app)
            && self
                .0
                .model
                .lock()
                .is_ok_and(|m| m.delivery_allowed(&owned.request));
        if !admitted {
            self.invalidate(Observation::MainRetired);
        }
        admitted
    }
}
/// Some(false) for an unowned Surface label is denial, never a label-based grant.
pub(crate) fn navigation<R: Runtime>(view: &Webview<R>, url: &Url) -> Option<bool> {
    if view.label() != LABEL {
        return None;
    }
    let allowed = view.try_state::<Adapter>().is_some_and(|adapter| {
        let owned = adapter.0.owned.get().is_some_and(|o| o.owns_view(view));
        let allowed = owned && settings::local(url) && adapter.can_deliver(view.app_handle());
        if !allowed && owned {
            adapter.invalidate(Observation::NavigationDenied);
        }
        allowed
    });
    Some(allowed)
}
impl Adapter {
    pub(super) fn attach_events<R: Runtime>(
        &self,
        window: &WebviewWindow<R>,
        request: crate::surface_adapter::model::CreationRequest,
    ) {
        let adapter = self.clone();
        // Backend-installed closure is bound to this exact created Window, even after resource-table retirement.
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { .. } => {
                adapter.record(&request, Observation::CloseRequested)
            }
            WindowEvent::Destroyed => adapter.record(&request, Observation::Destroyed),
            _ => {}
        });
    }
}
