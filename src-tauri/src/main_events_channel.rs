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
        channel
            .register(destination)
            .map_err(|_| UNAVAILABLE.to_owned())
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
        channel.unregister(registration);
        Ok(())
    }
    pub(crate) fn invalidate_channel_for(&self, caller: &Webview) {
        let _ = crate::main_caller::run(caller, || {
            let mut channel = self.channel.lock().map_err(|_| UNAVAILABLE)?;
            let registered = self.registration.get().ok_or(UNAVAILABLE)?;
            if !registered
                .lease
                .authorize(&self.observe(caller.app_handle(), None))
            {
                return Err(UNAVAILABLE);
            }
            channel.invalidate();
            Ok(())
        });
    }
}

#[cfg(test)]
#[path = "main_channel_tests.rs"]
mod tests;
