use serde::Deserialize;
use thiserror::Error;

pub const MAX_MESSAGE_BYTES: usize = 1024;
pub const SURFACE_ORIGIN: &str = "https://bogunon-surface.localhost";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Generation(u64);

impl Generation {
    pub const fn new(value: u64) -> Option<Self> {
        if value == 0 {
            None
        } else {
            Some(Self(value))
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Sequence(u64);

impl Sequence {
    pub const fn new(value: u64) -> Option<Self> {
        if value == 0 || value == u64::MAX {
            None
        } else {
            Some(Self(value))
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestKind {
    OpenMain,
    RefreshProjection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Request {
    pub generation: Generation,
    pub sequence: Sequence,
    pub kind: RequestKind,
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum IpcError {
    #[error("message exceeds the maximum size")]
    Oversized,
    #[error("message schema is invalid")]
    InvalidSchema,
    #[error("message origin is not authorized")]
    WrongOrigin,
    #[error("message did not originate in the top-level frame")]
    ChildFrame,
    #[error("request generation is stale")]
    StaleGeneration,
    #[error("request sequence is stale")]
    StaleSequence,
    #[error("the main application is retired")]
    MainRetired,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WireRequest<'a> {
    generation: u64,
    sequence: u64,
    command: &'a str,
}

pub fn parse_request(payload: &[u8], source: &str, top_level: bool) -> Result<Request, IpcError> {
    if payload.len() > MAX_MESSAGE_BYTES {
        return Err(IpcError::Oversized);
    }
    if source != SURFACE_ORIGIN {
        return Err(IpcError::WrongOrigin);
    }
    if !top_level {
        return Err(IpcError::ChildFrame);
    }
    let wire: WireRequest<'_> =
        serde_json::from_slice(payload).map_err(|_| IpcError::InvalidSchema)?;
    let generation = Generation::new(wire.generation).ok_or(IpcError::InvalidSchema)?;
    let sequence = Sequence::new(wire.sequence).ok_or(IpcError::InvalidSchema)?;
    let kind = match wire.command {
        "OpenMain" => RequestKind::OpenMain,
        "RefreshProjection" => RequestKind::RefreshProjection,
        _ => return Err(IpcError::InvalidSchema),
    };
    Ok(Request {
        generation,
        sequence,
        kind,
    })
}

pub struct Admission {
    generation: Generation,
    last_sequence: u64,
    main_active: bool,
}

impl Admission {
    pub const fn new(generation: Generation) -> Self {
        Self {
            generation,
            last_sequence: 0,
            main_active: true,
        }
    }

    pub fn admit(&mut self, request: Request) -> Result<RequestKind, IpcError> {
        if !self.main_active {
            return Err(IpcError::MainRetired);
        }
        if request.generation != self.generation {
            return Err(IpcError::StaleGeneration);
        }
        if request.sequence.0 <= self.last_sequence {
            return Err(IpcError::StaleSequence);
        }
        self.last_sequence = request.sequence.0;
        Ok(request.kind)
    }

    pub const fn retire_main(&mut self) {
        self.main_active = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(command: &str, generation: u64, sequence: u64) -> Vec<u8> {
        format!(r#"{{"generation":{generation},"sequence":{sequence},"command":"{command}"}}"#)
            .into_bytes()
    }

    #[test]
    fn accepts_only_the_two_registered_commands() {
        for (name, expected) in [
            ("OpenMain", RequestKind::OpenMain),
            ("RefreshProjection", RequestKind::RefreshProjection),
        ] {
            let parsed = parse_request(&request(name, 1, 1), SURFACE_ORIGIN, true);
            assert_eq!(parsed.map(|value| value.kind), Ok(expected));
        }
        assert_eq!(
            parse_request(&request("ReadFinance", 1, 1), SURFACE_ORIGIN, true),
            Err(IpcError::InvalidSchema)
        );
    }

    #[test]
    fn rejects_unknown_fields_wrong_origin_frames_and_oversized_payloads() {
        let extra = br#"{"generation":1,"sequence":1,"command":"OpenMain","path":"secret"}"#;
        assert_eq!(
            parse_request(extra, SURFACE_ORIGIN, true),
            Err(IpcError::InvalidSchema)
        );
        assert_eq!(
            parse_request(&request("OpenMain", 1, 1), "https://example.test", true),
            Err(IpcError::WrongOrigin)
        );
        assert_eq!(
            parse_request(&request("OpenMain", 1, 1), SURFACE_ORIGIN, false),
            Err(IpcError::ChildFrame)
        );
        assert_eq!(
            parse_request(&vec![b'x'; MAX_MESSAGE_BYTES + 1], SURFACE_ORIGIN, true),
            Err(IpcError::Oversized)
        );
    }

    #[test]
    fn rejects_stale_generation_sequence_and_retired_main() {
        let generation = Generation::new(7).unwrap();
        let mut admission = Admission::new(generation);
        let first = parse_request(&request("OpenMain", 7, 1), SURFACE_ORIGIN, true).unwrap();
        assert_eq!(admission.admit(first), Ok(RequestKind::OpenMain));
        let repeated = parse_request(&request("OpenMain", 7, 1), SURFACE_ORIGIN, true).unwrap();
        assert_eq!(admission.admit(repeated), Err(IpcError::StaleSequence));
        let stale = parse_request(&request("OpenMain", 6, 2), SURFACE_ORIGIN, true).unwrap();
        assert_eq!(admission.admit(stale), Err(IpcError::StaleGeneration));
        admission.retire_main();
        let after = parse_request(&request("OpenMain", 7, 2), SURFACE_ORIGIN, true).unwrap();
        assert_eq!(admission.admit(after), Err(IpcError::MainRetired));
    }
}
