use super::Adapter;
use crate::surface_adapter::{
    model::Phase,
    settings::{self, LABEL},
    Observation,
};
use tauri::{AppHandle, Manager, Runtime, Url, Webview, WebviewWindow, WindowEvent};
impl Adapter {
    pub(super) fn builder_navigation(
        &self,
        request: &crate::surface_adapter::model::CreationRequest,
        url: &Url,
    ) -> bool {
        let allowed = self.0.model.lock().is_ok_and(|model| {
            model.owns(request)
                && match model.phase() {
                    Phase::Creating => url.as_str() == "about:blank",
                    Phase::Live => settings::local(url),
                    Phase::Dormant
                    | Phase::Closing
                    | Phase::Destroyed
                    | Phase::Missing
                    | Phase::Unknown => false,
                }
        });
        if !allowed {
            self.record(request, Observation::NavigationDenied);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::surface_adapter::model::{Gate, Model};
    fn creating() -> (Adapter, crate::surface_adapter::model::CreationRequest) {
        let adapter = Adapter::default();
        let request;
        {
            let mut model = adapter.0.model.lock().expect("synthetic model");
            *model = Model::synthetic_enabled();
            request = model.request(1);
            model
                .begin(
                    &request,
                    Gate {
                        main: true,
                        isolation: true,
                        acl: true,
                        assets: true,
                        explorer_disabled: true,
                    },
                )
                .expect("synthetic gate");
        }
        (adapter, request)
    }
    #[test]
    fn bootstrap_is_blank_only_and_denial_records_before_owned_pin() {
        let (adapter, request) = creating();
        assert!(adapter.builder_navigation(&request, &Url::parse("about:blank").expect("url")));
        assert!(!adapter.builder_navigation(
            &request,
            &Url::parse("https://bogunon-surface.localhost/surface.html").expect("url")
        ));
        assert_eq!(adapter.status().expect("status").phase, Phase::Unknown);
        assert!(adapter.0.owned.get().is_none());
    }
    #[test]
    fn foreign_request_cannot_authorize_bootstrap_or_retire_current_request() {
        let (adapter, _) = creating();
        let (_, other) = creating();
        assert!(!adapter.builder_navigation(&other, &Url::parse("about:blank").expect("url")));
        assert_eq!(adapter.status().expect("status").phase, Phase::Creating);
    }
    #[test]
    fn closed_admission_rejects_even_fixed_local_asset() {
        let (adapter, request) = creating();
        adapter.record(&request, Observation::CreateFailed);
        assert!(!adapter.builder_navigation(
            &request,
            &Url::parse("https://bogunon-surface.localhost/surface.html").expect("url")
        ));
        assert!(!adapter.status().expect("status").replacement_allowed);
    }
}
