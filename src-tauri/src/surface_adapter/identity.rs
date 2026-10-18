use super::{model::CreationRequest, settings::LABEL};
use std::sync::Arc;
use tauri::{Manager, Resource, ResourceId, Runtime, Webview, WebviewWindow, Window};
struct Identity;
impl Resource for Identity {}
pub(super) struct Owned {
    view: Arc<Identity>,
    window: Arc<Identity>,
    view_id: ResourceId,
    window_id: ResourceId,
    pub request: CreationRequest,
    pub main: crate::main_lifetime::Lease,
}
impl Owned {
    pub fn pin<R: Runtime>(
        window: &WebviewWindow<R>,
        request: CreationRequest,
        main: crate::main_lifetime::Lease,
    ) -> Self {
        let view: &Webview<R> = window.as_ref();
        let view_identity = Arc::new(Identity);
        let window_identity = Arc::new(Identity);
        Self {
            view_id: view.resources_table().add_arc(Arc::clone(&view_identity)),
            window_id: view
                .window()
                .resources_table()
                .add_arc(Arc::clone(&window_identity)),
            view: view_identity,
            window: window_identity,
            request,
            main,
        }
    }
    pub fn owns_view<R: Runtime>(&self, view: &Webview<R>) -> bool {
        view.label() == LABEL
            && self.owns_window(&view.window())
            && same_resource(&view.resources_table(), self.view_id, &self.view)
    }
    pub fn owns_window<R: Runtime>(&self, window: &Window<R>) -> bool {
        window.label() == LABEL
            && same_resource(&window.resources_table(), self.window_id, &self.window)
    }
}

fn same_resource(table: &tauri::ResourceTable, id: ResourceId, identity: &Arc<Identity>) -> bool {
    table
        .get::<Identity>(id)
        .is_ok_and(|current| Arc::ptr_eq(&current, identity))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_id_reuse_cannot_impersonate_surface() {
        let own = Arc::new(Identity);
        let mut surface = tauri::ResourceTable::default();
        let id = surface.add_arc(Arc::clone(&own));
        assert!(same_resource(&surface, id, &own));
        surface.replace(id, Identity);
        assert!(surface.has(id));
        assert!(!same_resource(&surface, id, &own));
    }
    #[test]
    fn retired_or_missing_resource_is_not_owned() {
        let own = Arc::new(Identity);
        let empty = tauri::ResourceTable::default();
        assert!(!same_resource(&empty, 0, &own));
    }
}
