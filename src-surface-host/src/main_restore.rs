use crate::surface_connection::MainOpener;
use bogunon_main_restore_protocol::main_restore::RestoreBinding;
use bogunon_main_restore_protocol::windows_transport::{PipeClient, TransportError};
use std::cell::RefCell;
use std::ffi::OsStr;

pub struct NamedPipeMainOpener(RefCell<PipeClient>);

impl std::fmt::Debug for NamedPipeMainOpener {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("NamedPipeMainOpener([REDACTED])")
    }
}

impl NamedPipeMainOpener {
    pub fn new(endpoint: &OsStr, binding: RestoreBinding) -> Result<Self, TransportError> {
        PipeClient::new(endpoint, binding)
            .map(RefCell::new)
            .map(Self)
    }
}

impl MainOpener for NamedPipeMainOpener {
    type Error = TransportError;

    fn open_existing_main(&self) -> Result<(), Self::Error> {
        self.0.borrow_mut().open_main()
    }
}
