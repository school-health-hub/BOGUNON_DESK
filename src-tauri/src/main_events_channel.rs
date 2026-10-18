use super::{MainEvents, TransportFrame, UNAVAILABLE};
use tauri::{ipc::Channel, AppHandle, Manager, Webview};

impl MainEvents {
    pub(crate) fn register_channel(
        &self,
        app: &AppHandle,
        destination: Channel<TransportFrame>,
    ) -> Result<u64, String> {
        let mut channel = self.channel.lock().map_err(|_| UNAVAILABLE)?;
        let registered = self.registration.get().ok_or(UNAVAILABLE)?;
        if !registered.lease.authorize(&self.observe(app, None)) {
            return Err(UNAVAILABLE.into());
        }
        let lifetime = crate::main_lifetime::snapshot(app).map_err(|_| UNAVAILABLE)?;
        let epoch = channel.register(destination).map_err(|_| UNAVAILABLE)?;
        if !crate::main_lifetime::set_channel(app, &lifetime, Some(epoch)) {
            channel.invalidate();
            return Err(UNAVAILABLE.into());
        }
        Ok(epoch)
    }
    pub(crate) fn unregister_channel(
        &self,
        app: &AppHandle,
        registration: u64,
    ) -> Result<(), String> {
        let mut channel = self.channel.lock().map_err(|_| UNAVAILABLE)?;
        let registered = self.registration.get().ok_or(UNAVAILABLE)?;
        if !registered.lease.authorize(&self.observe(app, None)) {
            return Err(UNAVAILABLE.into());
        }
        if channel.matches(Some(registration)) {
            channel.unregister(registration);
            let lifetime = crate::main_lifetime::snapshot(app).map_err(|_| UNAVAILABLE)?;
            if !crate::main_lifetime::set_channel(app, &lifetime, None) {
                return Err(UNAVAILABLE.into());
            }
        }
        Ok(())
    }
    // Registry hooks revoke admission before calling this physical-resource cleanup.
    // It must remain usable after the normal command guard is closed.
    pub(crate) fn invalidate_channel_for(&self, caller: &Webview) {
        let Some(registered) = self.registration.get() else {
            return;
        };
        let view = caller
            .resources_table()
            .get::<super::Identity>(registered.webview)
            .ok();
        let window = caller
            .window()
            .resources_table()
            .get::<super::Identity>(registered.window)
            .ok();
        if registered.lease.authorize(&super::Observed {
            webview: view,
            window,
            caller_window: None,
            revoked: false,
        }) {
            if let Ok(mut channel) = self.channel.lock() {
                channel.invalidate();
            }
        }
    }
}

#[cfg(test)]
#[path = "main_channel_tests.rs"]
mod tests;
