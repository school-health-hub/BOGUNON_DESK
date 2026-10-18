//! Main is pinned once at setup. Labels identify roles, not resource lifetimes.
//! No HWND access, authentication state, credential I/O, or JS identity input.
use std::{
    future::Future,
    sync::{Arc, OnceLock},
};
use tauri::{AppHandle, Manager, Resource, ResourceId, Runtime, Webview};

#[path = "main_caller_identity.rs"]
mod identity;
pub(crate) use identity::{CommandError, Error};
use identity::{Identity, Observed, Permit, Pinned};

impl Resource for Identity {}

struct Registration {
    pinned: Pinned,
    webview_resource: ResourceId,
    window_resource: ResourceId,
}
#[derive(Default)]
pub(crate) struct MainCallerGuard(OnceLock<Registration>);

impl MainCallerGuard {
    /// Main recreation/rebinding is deliberately unsupported in this stage.
    pub(crate) fn install<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), Error> {
        if self.0.get().is_some() {
            return Err(Error::AlreadyRegistered);
        }
        let main = app
            .get_webview_window("main")
            .ok_or(Error::MainUnavailable)?;
        let webview: &Webview<R> = main.as_ref();
        let window = webview.window();
        if webview.window().label() != "main" {
            return Err(Error::NotMain);
        }
        let pinned = Pinned {
            webview: Arc::new(Identity),
            window: Arc::new(Identity),
        };
        let webview_resource = webview
            .resources_table()
            .add_arc(Arc::clone(&pinned.webview));
        let window_resource = window.resources_table().add_arc(Arc::clone(&pinned.window));
        self.0
            .set(Registration {
                pinned,
                webview_resource,
                window_resource,
            })
            .map_err(|_| Error::AlreadyRegistered)
    }
    fn authorize<R: Runtime>(&self, caller: &Webview<R>) -> Result<Permit, Error> {
        let registered = self.0.get().ok_or(Error::Unregistered)?;
        let main = caller
            .get_webview_window("main")
            .ok_or(Error::MainUnavailable)?;
        let main_webview: &Webview<R> = main.as_ref();
        let main_window = main_webview.window();
        let caller_window = caller.window();
        let caller_webview_identity = caller
            .resources_table()
            .get::<Identity>(registered.webview_resource)
            .ok();
        let caller_window_identity = caller_window
            .resources_table()
            .get::<Identity>(registered.window_resource)
            .ok();
        let main_webview_identity = main_webview
            .resources_table()
            .get::<Identity>(registered.webview_resource)
            .ok();
        let main_window_identity = main_window
            .resources_table()
            .get::<Identity>(registered.window_resource)
            .ok();
        registered.pinned.authorize(Observed {
            webview_label: caller.label(),
            window_label: caller_window.label(),
            caller_webview: caller_webview_identity,
            caller_window: caller_window_identity,
            registered_webview: main_webview_identity,
            registered_window: main_window_identity,
        })
    }
}

fn authorize<R: Runtime>(caller: &Webview<R>) -> Result<Permit, Error> {
    caller
        .try_state::<MainCallerGuard>()
        .ok_or(Error::Unregistered)?
        .authorize(caller)
}
pub(crate) fn run<R: Runtime, T, E>(
    caller: &Webview<R>,
    operation: impl FnOnce() -> Result<T, E>,
) -> Result<T, CommandError<E>> {
    identity::dispatch(authorize(caller), operation)
}
pub(crate) async fn run_async<R: Runtime, T, E, F: Future<Output = Result<T, E>>>(
    caller: &Webview<R>,
    operation: impl FnOnce() -> F,
) -> Result<T, CommandError<E>> {
    identity::dispatch_async(authorize(caller), operation).await
}

#[cfg(test)]
#[path = "main_caller_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "main_caller_command_tests.rs"]
mod command_tests;
