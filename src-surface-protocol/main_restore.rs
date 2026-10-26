use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const PROTOCOL_VERSION: u16 = 1;
pub const MAX_REQUEST_BYTES: usize = 512;
pub const CAPABILITY_BYTES: usize = 32;

#[derive(Clone, PartialEq, Eq)]
pub struct Capability([u8; CAPABILITY_BYTES]);

impl Capability {
    pub const fn from_bytes(value: [u8; CAPABILITY_BYTES]) -> Self {
        Self(value)
    }

    pub fn encode(&self) -> String {
        let mut result = String::with_capacity(CAPABILITY_BYTES * 2);
        for byte in self.0 {
            use std::fmt::Write as _;
            let _ = write!(result, "{byte:02x}");
        }
        result
    }

    fn matches_encoded(&self, candidate: &str) -> bool {
        let expected = self.encode();
        if expected.len() != candidate.len() {
            return false;
        }
        expected
            .bytes()
            .zip(candidate.bytes())
            .fold(0_u8, |difference, (left, right)| {
                difference | (left ^ right)
            })
            == 0
    }
}

impl std::fmt::Debug for Capability {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Capability([REDACTED])")
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RestoreBinding {
    pub generation: u64,
    pub attempt: u64,
    pub expected_surface_pid: u32,
    capability: Capability,
}

impl RestoreBinding {
    pub const fn new(
        generation: u64,
        attempt: u64,
        expected_surface_pid: u32,
        capability: Capability,
    ) -> Option<Self> {
        if generation == 0 || attempt == 0 || expected_surface_pid == 0 {
            None
        } else {
            Some(Self {
                generation,
                attempt,
                expected_surface_pid,
                capability,
            })
        }
    }

    pub fn request(&self, sequence: u64) -> Result<Vec<u8>, ProtocolError> {
        if sequence == 0 || sequence == u64::MAX {
            return Err(ProtocolError::InvalidSequence);
        }
        serde_json::to_vec(&WireRequest {
            version: PROTOCOL_VERSION,
            generation: self.generation,
            attempt: self.attempt,
            sequence,
            command: "OpenMain",
            capability: &self.capability.encode(),
        })
        .map_err(|_| ProtocolError::InvalidMessage)
    }
}

#[derive(Serialize)]
#[serde(deny_unknown_fields)]
struct WireRequest<'a> {
    version: u16,
    generation: u64,
    attempt: u64,
    sequence: u64,
    command: &'a str,
    capability: &'a str,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IncomingRequest {
    version: u16,
    generation: u64,
    attempt: u64,
    sequence: u64,
    command: String,
    capability: String,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolError {
    #[error("restore request is oversized or malformed")]
    InvalidMessage,
    #[error("restore protocol version is unsupported")]
    InvalidVersion,
    #[error("restore generation is stale")]
    StaleGeneration,
    #[error("restore attempt is stale")]
    StaleAttempt,
    #[error("restore sequence is duplicate, stale, or invalid")]
    InvalidSequence,
    #[error("restore capability is invalid")]
    InvalidCapability,
    #[error("restore client process is not the admitted Surface Host")]
    InvalidClientProcess,
    #[error("restore command is unsupported")]
    UnsupportedCommand,
    #[error("Main is unavailable or retired")]
    MainUnavailable,
    #[error("Surface is unavailable or retired")]
    SurfaceUnavailable,
}

pub struct Admission {
    binding: RestoreBinding,
    last_sequence: u64,
    main_active: bool,
    surface_active: bool,
}

impl Admission {
    pub const fn new(binding: RestoreBinding) -> Self {
        Self {
            binding,
            last_sequence: 0,
            main_active: true,
            surface_active: true,
        }
    }

    pub fn admit(&mut self, payload: &[u8], os_client_pid: u32) -> Result<(), ProtocolError> {
        if !self.main_active {
            return Err(ProtocolError::MainUnavailable);
        }
        if !self.surface_active {
            return Err(ProtocolError::SurfaceUnavailable);
        }
        if payload.len() > MAX_REQUEST_BYTES {
            return Err(ProtocolError::InvalidMessage);
        }
        let request: IncomingRequest =
            serde_json::from_slice(payload).map_err(|_| ProtocolError::InvalidMessage)?;
        if request.version != PROTOCOL_VERSION {
            return Err(ProtocolError::InvalidVersion);
        }
        if request.command != "OpenMain" {
            return Err(ProtocolError::UnsupportedCommand);
        }
        if os_client_pid != self.binding.expected_surface_pid {
            return Err(ProtocolError::InvalidClientProcess);
        }
        if request.generation != self.binding.generation {
            return Err(ProtocolError::StaleGeneration);
        }
        if request.attempt != self.binding.attempt {
            return Err(ProtocolError::StaleAttempt);
        }
        if !self.binding.capability.matches_encoded(&request.capability) {
            return Err(ProtocolError::InvalidCapability);
        }
        if request.sequence == 0
            || request.sequence == u64::MAX
            || request.sequence <= self.last_sequence
        {
            return Err(ProtocolError::InvalidSequence);
        }
        self.last_sequence = request.sequence;
        Ok(())
    }

    pub const fn retire_main(&mut self) {
        self.main_active = false;
    }

    pub const fn retire_surface(&mut self) {
        self.surface_active = false;
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RestoreResponse {
    pub accepted: bool,
    pub code: String,
}

impl RestoreResponse {
    pub fn accepted() -> Self {
        Self {
            accepted: true,
            code: "OPENED".into(),
        }
    }

    pub fn rejected(error: ProtocolError) -> Self {
        Self {
            accepted: false,
            code: match error {
                ProtocolError::InvalidMessage => "INVALID_MESSAGE",
                ProtocolError::InvalidVersion => "INVALID_VERSION",
                ProtocolError::StaleGeneration => "STALE_GENERATION",
                ProtocolError::StaleAttempt => "STALE_ATTEMPT",
                ProtocolError::InvalidSequence => "INVALID_SEQUENCE",
                ProtocolError::InvalidCapability => "INVALID_CAPABILITY",
                ProtocolError::InvalidClientProcess => "INVALID_CLIENT_PROCESS",
                ProtocolError::UnsupportedCommand => "UNSUPPORTED_COMMAND",
                ProtocolError::MainUnavailable => "MAIN_UNAVAILABLE",
                ProtocolError::SurfaceUnavailable => "SURFACE_UNAVAILABLE",
            }
            .into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn binding() -> RestoreBinding {
        RestoreBinding::new(7, 11, 101, Capability::from_bytes([0x5a; 32]))
            .unwrap_or_else(|| panic!("valid fixture"))
    }

    #[test]
    fn admits_only_exact_open_main_binding_once_per_sequence() {
        let binding = binding();
        let request = binding
            .request(1)
            .unwrap_or_else(|_| panic!("valid fixture"));
        let mut admission = Admission::new(binding);
        assert_eq!(admission.admit(&request, 101), Ok(()));
        assert_eq!(
            admission.admit(&request, 101),
            Err(ProtocolError::InvalidSequence)
        );
    }

    #[test]
    fn rejects_wrong_pid_attempt_capability_and_command() {
        let binding = binding();
        let request = binding
            .request(1)
            .unwrap_or_else(|_| panic!("valid fixture"));
        assert_eq!(
            Admission::new(binding.clone()).admit(&request, 202),
            Err(ProtocolError::InvalidClientProcess)
        );
        let wrong_attempt = request
            .windows(b"\"attempt\":11".len())
            .position(|window| window == b"\"attempt\":11")
            .map(|offset| {
                let mut changed = request.clone();
                changed[offset + b"\"attempt\":".len()] = b'9';
                changed[offset + b"\"attempt\":".len() + 1] = b'9';
                changed
            })
            .unwrap_or_default();
        assert_eq!(
            Admission::new(binding.clone()).admit(&wrong_attempt, 101),
            Err(ProtocolError::StaleAttempt)
        );
        let mut wrong_capability = request.clone();
        let encoded = Capability::from_bytes([0x5a; 32]).encode();
        let position = wrong_capability
            .windows(encoded.len())
            .position(|value| value == encoded.as_bytes())
            .unwrap_or_else(|| panic!("fixture capability must be present"));
        wrong_capability[position] = b'4';
        assert_eq!(
            Admission::new(binding.clone()).admit(&wrong_capability, 101),
            Err(ProtocolError::InvalidCapability)
        );
        let unsupported = String::from_utf8(request)
            .unwrap_or_default()
            .replace("OpenMain", "RunCommand")
            .into_bytes();
        assert_eq!(
            Admission::new(binding).admit(&unsupported, 101),
            Err(ProtocolError::UnsupportedCommand)
        );
    }

    #[test]
    fn retirement_and_shutdown_races_fail_closed() {
        let binding = binding();
        let request = binding
            .request(1)
            .unwrap_or_else(|_| panic!("valid fixture"));
        let mut main_retired = Admission::new(binding.clone());
        main_retired.retire_main();
        assert_eq!(
            main_retired.admit(&request, 101),
            Err(ProtocolError::MainUnavailable)
        );
        let mut surface_retired = Admission::new(binding);
        surface_retired.retire_surface();
        assert_eq!(
            surface_retired.admit(&request, 101),
            Err(ProtocolError::SurfaceUnavailable)
        );
    }

    #[test]
    fn capability_debug_is_redacted() {
        assert_eq!(
            format!("{:?}", Capability::from_bytes([1; 32])),
            "Capability([REDACTED])"
        );
    }
}
