use crate::surface_broker::{Binding, Registry, State, TauriObserved};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Disabled,
    MainUnavailable,
    Isolation,
    Acl,
    Assets,
    Explorer,
    Identity,
    Closed,
    Unknown,
    Native,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Dormant,
    Creating,
    Live,
    Closing,
    Destroyed,
    Missing,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cleanup {
    Unobserved,
    Unknown,
    Confirmed,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Observation {
    CloseRequested,
    Destroyed,
    ResourceMissing,
    CreateFailed,
    NavigationDenied,
    MainRetired,
}
/// Deliberately uninhabited: no Tauri-wide cleanup verifier exists in this stage.
/// Native QA proofs and Synthetic receipts cannot construct this type.
/// ```compile_fail
/// use school_health_desk_lib::{surface_adapter::CleanupConfirmed, surface_broker::Registry};
/// fn require_tauri_cleanup(_: CleanupConfirmed) {}
/// let mut registry = Registry::synthetic();
/// registry.retiring().unwrap();
/// require_tauri_cleanup(registry.confirm_synthetic_cleanup().unwrap());
/// ```
/// ```compile_fail
/// use school_health_desk_lib::surface_adapter::CleanupConfirmed;
/// let forged = CleanupConfirmed {};
/// ```
pub enum CleanupConfirmed {}
#[derive(Clone)]
pub(super) struct CreationRequest {
    binding: Binding,
    sequence: u64,
}
pub(super) struct Gate {
    pub main: bool,
    pub isolation: bool,
    pub acl: bool,
    pub assets: bool,
    pub explorer_disabled: bool,
}
pub(super) struct Model {
    enabled: bool,
    accepted_sequence: Option<u64>,
    registry: Registry<TauriObserved>,
    phase: Phase,
    cleanup: Cleanup,
}
impl Default for Model {
    fn default() -> Self {
        Self {
            enabled: false,
            accepted_sequence: None,
            registry: Registry::adapter_reservation(),
            phase: Phase::Dormant,
            cleanup: Cleanup::Unobserved,
        }
    }
}
impl Model {
    #[cfg(test)]
    pub fn synthetic_enabled() -> Self {
        Self {
            enabled: true,
            ..Self::default()
        }
    }
    pub const fn enabled(&self) -> bool {
        self.enabled
    }
    pub fn request(&self, sequence: u64) -> CreationRequest {
        CreationRequest {
            binding: self.registry.binding(),
            sequence,
        }
    }
    pub fn begin(&mut self, request: &CreationRequest, gate: Gate) -> Result<(), Error> {
        if !self.enabled {
            return Err(Error::Disabled);
        }
        if self.phase != Phase::Dormant {
            return Err(Error::Closed);
        }
        if !gate.main {
            return Err(Error::MainUnavailable);
        }
        if !gate.isolation {
            return Err(Error::Isolation);
        }
        if !gate.acl {
            return Err(Error::Acl);
        }
        if !gate.assets {
            return Err(Error::Assets);
        }
        if !gate.explorer_disabled {
            return Err(Error::Explorer);
        }
        if self
            .registry
            .admit_lifecycle(&request.binding, request.sequence)
            .is_err()
        {
            if self.registry.state() == State::CleanupUnknown {
                self.phase = Phase::Unknown;
                self.unknown();
                return Err(Error::Unknown);
            }
            return Err(Error::Identity);
        }
        self.accepted_sequence = Some(request.sequence);
        self.phase = Phase::Creating;
        Ok(())
    }
    pub(super) fn owns(&self, request: &CreationRequest) -> bool {
        self.registry.binding().matches(&request.binding)
            && self.accepted_sequence == Some(request.sequence)
    }
    pub fn created(&mut self, request: &CreationRequest) -> Result<(), Error> {
        if !self.owns(request) {
            return Err(Error::Identity);
        }
        if self.phase != Phase::Creating {
            return Err(Error::Closed);
        }
        self.phase = Phase::Live;
        Ok(())
    }
    pub fn observe(
        &mut self,
        request: &CreationRequest,
        observation: Observation,
    ) -> Result<(), Error> {
        if !self.owns(request) {
            return Err(Error::Identity);
        }
        match observation {
            Observation::CloseRequested => {
                if !matches!(self.phase, Phase::Live | Phase::Creating) {
                    return Err(Error::Closed);
                }
                self.registry.retiring().map_err(|_| Error::Closed)?;
                self.phase = Phase::Closing;
            }
            Observation::Destroyed => {
                self.phase = Phase::Destroyed;
                self.unknown();
            }
            Observation::ResourceMissing => {
                self.phase = Phase::Missing;
                self.unknown();
            }
            Observation::CreateFailed
            | Observation::NavigationDenied
            | Observation::MainRetired => {
                self.phase = Phase::Unknown;
                self.unknown();
            }
        }
        Ok(())
    }
    fn unknown(&mut self) {
        self.cleanup = Cleanup::Unknown;
        self.registry.cleanup_unknown();
    }
    pub fn delivery_allowed(&self, request: &CreationRequest) -> bool {
        self.owns(request) && self.phase == Phase::Live && self.registry.state() == State::Active
    }
    pub const fn phase(&self) -> Phase {
        self.phase
    }
    pub const fn cleanup(&self) -> Cleanup {
        self.cleanup
    }
    pub const fn replacement_allowed(&self) -> bool {
        false
    }
    #[cfg(test)]
    pub fn registry_state(&self) -> State {
        self.registry.state()
    }
}
