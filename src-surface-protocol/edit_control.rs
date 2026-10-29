use crate::main_restore::{Capability, RestoreBinding};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const EDIT_PROTOCOL_VERSION: u16 = 1;
pub const MAX_EDIT_MESSAGE_BYTES: usize = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EditCommand {
    Begin,
    Complete,
    Cancel,
}

impl EditCommand {
    pub const fn wire_name(self) -> &'static str {
        match self {
            Self::Begin => "BeginEdit",
            Self::Complete => "CompleteEdit",
            Self::Cancel => "CancelEdit",
        }
    }
}

#[derive(Clone)]
pub struct EditBinding {
    generation: u64,
    attempt: u64,
    capability: Capability,
}

impl std::fmt::Debug for EditBinding {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("EditBinding([REDACTED])")
    }
}

impl EditBinding {
    pub(crate) fn from_restore(binding: &RestoreBinding) -> Self {
        Self {
            generation: binding.generation,
            attempt: binding.attempt,
            capability: binding.capability_for_edit(),
        }
    }

    pub fn request(
        &self,
        sequence: u64,
        command: EditCommand,
    ) -> Result<Vec<u8>, EditControlError> {
        if sequence == 0 || sequence == u64::MAX {
            return Err(EditControlError::InvalidSequence);
        }
        serde_json::to_vec(&WireEditRequest {
            version: EDIT_PROTOCOL_VERSION,
            generation: self.generation,
            attempt: self.attempt,
            sequence,
            command: command.wire_name(),
            capability: &self.capability.encode(),
        })
        .map_err(|_| EditControlError::InvalidMessage)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AdmittedEditCommand {
    pub sequence: u64,
    pub command: EditCommand,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum EditControlError {
    #[error("edit control message is oversized or malformed")]
    InvalidMessage,
    #[error("edit control protocol version is unsupported")]
    InvalidVersion,
    #[error("edit control generation is stale")]
    StaleGeneration,
    #[error("edit control attempt is stale")]
    StaleAttempt,
    #[error("edit control sequence is duplicate, stale, or invalid")]
    InvalidSequence,
    #[error("edit control capability is invalid")]
    InvalidCapability,
    #[error("edit control command is unsupported")]
    UnsupportedCommand,
}

pub struct EditAdmission {
    binding: EditBinding,
    last_sequence: u64,
}

impl EditAdmission {
    pub const fn new(binding: EditBinding) -> Self {
        Self {
            binding,
            last_sequence: 0,
        }
    }

    pub fn admit(&mut self, payload: &[u8]) -> Result<AdmittedEditCommand, EditControlError> {
        if payload.len() > MAX_EDIT_MESSAGE_BYTES {
            return Err(EditControlError::InvalidMessage);
        }
        let request: IncomingEditRequest =
            serde_json::from_slice(payload).map_err(|_| EditControlError::InvalidMessage)?;
        if request.version != EDIT_PROTOCOL_VERSION {
            return Err(EditControlError::InvalidVersion);
        }
        if request.generation != self.binding.generation {
            return Err(EditControlError::StaleGeneration);
        }
        if request.attempt != self.binding.attempt {
            return Err(EditControlError::StaleAttempt);
        }
        if !self.binding.capability.matches_encoded(&request.capability) {
            return Err(EditControlError::InvalidCapability);
        }
        if request.sequence == 0
            || request.sequence == u64::MAX
            || request.sequence <= self.last_sequence
        {
            return Err(EditControlError::InvalidSequence);
        }
        let command = match request.command.as_str() {
            "BeginEdit" => EditCommand::Begin,
            "CompleteEdit" => EditCommand::Complete,
            "CancelEdit" => EditCommand::Cancel,
            _ => return Err(EditControlError::UnsupportedCommand),
        };
        self.last_sequence = request.sequence;
        Ok(AdmittedEditCommand {
            sequence: request.sequence,
            command,
        })
    }
}

#[derive(Serialize)]
#[serde(deny_unknown_fields)]
struct WireEditRequest<'a> {
    version: u16,
    generation: u64,
    attempt: u64,
    sequence: u64,
    command: &'a str,
    capability: &'a str,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IncomingEditRequest {
    version: u16,
    generation: u64,
    attempt: u64,
    sequence: u64,
    command: String,
    capability: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> EditBinding {
        let restore = RestoreBinding::new(7, 3, 101, Capability::from_bytes([9; 32]))
            .unwrap_or_else(|| panic!("fixture binding must be valid"));
        EditBinding::from_restore(&restore)
    }

    #[test]
    fn admits_only_fixed_edit_commands_in_sequence() {
        let binding = fixture();
        let mut admission = EditAdmission::new(binding.clone());
        for (sequence, command) in [
            (1, EditCommand::Begin),
            (2, EditCommand::Complete),
            (3, EditCommand::Cancel),
        ] {
            let payload = binding
                .request(sequence, command)
                .unwrap_or_else(|error| panic!("fixture request: {error}"));
            assert_eq!(
                admission.admit(&payload),
                Ok(AdmittedEditCommand { sequence, command })
            );
        }
    }

    #[test]
    fn rejects_unknown_stale_and_foreign_edit_messages() {
        let binding = fixture();
        let mut admission = EditAdmission::new(binding.clone());
        let first = binding
            .request(1, EditCommand::Begin)
            .unwrap_or_else(|error| panic!("fixture request: {error}"));
        assert!(admission.admit(&first).is_ok());
        assert_eq!(
            admission.admit(&first),
            Err(EditControlError::InvalidSequence)
        );

        let unknown = String::from_utf8(
            binding
                .request(2, EditCommand::Cancel)
                .unwrap_or_else(|error| panic!("fixture request: {error}")),
        )
        .unwrap_or_else(|error| panic!("fixture UTF-8: {error}"))
        .replace("CancelEdit", "RunCommand");
        assert_eq!(
            admission.admit(unknown.as_bytes()),
            Err(EditControlError::UnsupportedCommand)
        );

        let foreign_restore = RestoreBinding::new(7, 3, 101, Capability::from_bytes([8; 32]))
            .unwrap_or_else(|| panic!("fixture binding must be valid"));
        let foreign = EditBinding::from_restore(&foreign_restore)
            .request(2, EditCommand::Cancel)
            .unwrap_or_else(|error| panic!("fixture request: {error}"));
        assert_eq!(
            admission.admit(&foreign),
            Err(EditControlError::InvalidCapability)
        );
    }

    #[test]
    fn debug_output_redacts_the_edit_capability() {
        let binding = fixture();
        assert_eq!(format!("{binding:?}"), "EditBinding([REDACTED])");
    }
}
