use bogunon_main_restore_protocol::windows_transport::{
    PipeServer, SurfaceRestoreGrant, TransportError,
};
use tauri::AppHandle;

pub struct MainRestoreEndpoint(PipeServer);

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
