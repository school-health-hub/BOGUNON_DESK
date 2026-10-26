use bogunon_main_restore_protocol::windows_transport::{
    PipeServer, SurfaceRestoreGrant, TransportError,
};
use std::sync::mpsc::{self, Receiver, SyncSender};
use tauri::AppHandle;

pub struct MainRestoreEndpoint(PipeServer);

pub struct MainRestoreServer {
    grant: Receiver<Result<SurfaceRestoreGrant, TransportError>>,
    command: SyncSender<ServerCommand>,
}

enum ServerCommand {
    Serve,
    Retire,
}

impl MainRestoreEndpoint {
    pub fn create(
        generation: u64,
        attempt: u64,
        surface_pid: u32,
    ) -> Result<(Self, SurfaceRestoreGrant), TransportError> {
        PipeServer::create(generation, attempt, surface_pid)
            .map(|(server, grant)| (Self(server), grant))
    }

    pub fn serve_once(&mut self, app: &AppHandle) -> Result<(), TransportError> {
        self.0
            .serve_once(|| super::show_main_window(app).map_err(|_| ()))
    }

    pub const fn retire_main(&mut self) {
        self.0.retire_main();
    }

    pub const fn retire_surface(&mut self) {
        self.0.retire_surface();
    }
}

impl MainRestoreServer {
    pub fn start(
        app: AppHandle,
        generation: u64,
        attempt: u64,
        surface_pid: u32,
    ) -> Result<Self, String> {
        let (grant_tx, grant) = mpsc::sync_channel(1);
        let (command, command_rx) = mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("surface-main-restore".to_owned())
            .spawn(move || {
                let (mut endpoint, grant) =
                    match MainRestoreEndpoint::create(generation, attempt, surface_pid) {
                        Ok(prepared) => prepared,
                        Err(error) => {
                            let _ = grant_tx.send(Err(error));
                            return;
                        }
                    };
                if grant_tx.send(Ok(grant)).is_err() {
                    endpoint.retire_surface();
                    return;
                }
                match command_rx.recv() {
                    Ok(ServerCommand::Serve) => {
                        let _ = endpoint.serve_once(&app);
                        endpoint.retire_surface();
                    }
                    Ok(ServerCommand::Retire) | Err(_) => endpoint.retire_surface(),
                }
            })
            .map_err(|error| error.to_string())?;
        Ok(Self { grant, command })
    }

    pub fn receive_grant(&self) -> Result<SurfaceRestoreGrant, String> {
        self.grant
            .recv()
            .map_err(|_| "Main restore endpoint did not become ready".to_owned())?
            .map_err(|error| error.to_string())
    }

    pub fn serve(self) -> Result<(), String> {
        self.command
            .send(ServerCommand::Serve)
            .map_err(|_| "Main restore endpoint is unavailable".to_owned())
    }

    pub fn retire(self) {
        let _ = self.command.send(ServerCommand::Retire);
    }
}

#[cfg(test)]
mod tests {
    use super::MainRestoreServer;

    #[test]
    fn server_control_can_cross_threads_without_moving_the_native_endpoint() {
        fn assert_send<T: Send>() {}

        assert_send::<MainRestoreServer>();
    }
}
