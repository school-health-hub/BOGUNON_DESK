//! NATIVE-04B application DTO over the existing S-3 framing and capability primitive.
//! No Win32 adapter is linked; every window value is explicitly synthetic.
use crate::main_restore::{Capability, RestoreBinding, RestoreResponse, MAX_REQUEST_BYTES};
use crate::memory_channel::{read_frame, write_frame};
use bogunon_workerw_boundary::{DryRunBinding, DryRunEngine, DryRunOperation, DryRunRequest};
use serde::Deserialize;
use std::io::{Read, Write};

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Config {
    source_sha: String,
    host_created: String,
    explorer_pid: u32,
    explorer_created: String,
    model_window: u64,
    mode: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Grant {
    generation: u64,
    attempt: u64,
    expected_surface_pid: u32,
    capability: [u8; 32],
    #[serde(rename = "workerwDryRun")]
    config: Config,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Request {
    version: u8,
    generation: u64,
    attempt: u64,
    capability: String,
    source_sha: String,
    sequence: u64,
    host_pid: u32,
    model_window: u64,
    explorer_created: String,
    mode: String,
    operation: DryRunOperation,
}

struct Admission {
    binding: RestoreBinding,
    source: String,
    last: u64,
}
impl Admission {
    fn admit(&mut self, bytes: &[u8]) -> Result<Request, ()> {
        let r: Request = serde_json::from_slice(bytes).map_err(|_| ())?;
        if bytes.len() > MAX_REQUEST_BYTES
            || r.version != 1
            || r.mode != "DryRun"
            || r.source_sha != self.source
            || r.generation != self.binding.generation
            || r.attempt != self.binding.attempt
            || r.host_pid != self.binding.expected_surface_pid
            || r.sequence <= self.last
            || r.sequence == u64::MAX
            || !self
                .binding
                .capability_for_edit()
                .matches_encoded(&r.capability)
        {
            return Err(());
        }
        self.last = r.sequence;
        Ok(r)
    }
}
fn emit(output: &mut impl Write, value: &impl serde::Serialize) -> Result<(), ()> {
    let bytes = serde_json::to_vec(value).map_err(|_| ())?;
    write_frame(output, &bytes, MAX_REQUEST_BYTES).map_err(|_| ())
}
fn execute(input: &mut impl Read, output: &mut impl Write, own_pid: u32) -> Result<(), ()> {
    let mut bytes = read_frame(input, MAX_REQUEST_BYTES).map_err(|_| ())?;
    let parsed = serde_json::from_slice::<Grant>(&bytes);
    bytes.fill(0);
    let g = parsed.map_err(|_| ())?;
    if g.expected_surface_pid != own_pid
        || g.config.mode != "DryRun"
        || g.config.model_window != 901
        || g.config.source_sha.len() != 40
        || !g.config.source_sha.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(());
    }
    let binding = RestoreBinding::new(
        g.generation,
        g.attempt,
        own_pid,
        Capability::from_bytes(g.capability),
    )
    .ok_or(())?;
    let mut engine = DryRunEngine::new(DryRunBinding {
        generation: g.generation,
        attempt: g.attempt,
        host_pid: own_pid,
        host_created: g.config.host_created.parse().map_err(|_| ())?,
        explorer_pid: g.config.explorer_pid,
        explorer_created: g.config.explorer_created.parse().map_err(|_| ())?,
        model_window: g.config.model_window,
    })
    .map_err(|_| ())?;
    let mut request = binding.request(1).map_err(|_| ())?;
    write_frame(output, &request, MAX_REQUEST_BYTES).map_err(|_| ())?;
    request.fill(0);
    let reply = read_frame(input, MAX_REQUEST_BYTES).map_err(|_| ())?;
    let response: RestoreResponse = serde_json::from_slice(&reply).map_err(|_| ())?;
    if !response.accepted || response.code != "OPENED" {
        return Err(());
    }
    write_frame(output, &reply, MAX_REQUEST_BYTES).map_err(|_| ())?;
    let mut admission = Admission {
        binding,
        source: g.config.source_sha,
        last: 0,
    };
    // EOF is a transport event, not proof of native cleanup. Never issue a live receipt.
    loop {
        let mut prefix = [0_u8; 1];
        if input.read(&mut prefix).map_err(|_| ())? == 0 {
            engine.connection_closed();
            return Ok(());
        }
        let mut chained = std::io::Cursor::new(prefix).chain(&mut *input);
        let mut frame = read_frame(&mut chained, MAX_REQUEST_BYTES).map_err(|_| ())?;
        let admitted = admission.admit(&frame);
        frame.fill(0);
        let r = admitted.map_err(|_| ())?;
        let report = engine.dispatch(DryRunRequest {
            sequence: r.sequence,
            host_pid: r.host_pid,
            model_window: r.model_window,
            explorer_created: r.explorer_created.parse().map_err(|_| ())?,
            operation: r.operation,
        });
        emit(output, &report)?;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn admission() -> Admission {
        Admission {
            binding: RestoreBinding::new(1, 2, 3, Capability::from_bytes([7; 32])).unwrap(),
            source: "a".repeat(40),
            last: 0,
        }
    }
    fn request() -> serde_json::Value {
        serde_json::json!({"version":1,"generation":1,"attempt":2,"hostPid":3,
        "capability":"07".repeat(32),"sourceSha":"a".repeat(40),"sequence":1,"modelWindow":901,
        "explorerCreated":"9","mode":"DryRun","operation":"attach"})
    }
    #[test]
    fn admission_reuses_s3_capability_and_rejects_replay() {
        let mut a = admission();
        let bytes = serde_json::to_vec(&request()).unwrap();
        assert!(a.admit(&bytes).is_ok());
        assert!(a.admit(&bytes).is_err());
    }
    #[test]
    fn foreign_grant_session_owner_source_mode_and_unknown_fields_rejected() {
        for (key, value) in [
            ("capability", serde_json::json!("00".repeat(32))),
            ("attempt", serde_json::json!(8)),
            ("hostPid", serde_json::json!(99)),
            ("sourceSha", serde_json::json!("b".repeat(40))),
            ("mode", serde_json::json!("Live")),
            ("version", serde_json::json!(2)),
            ("generation", serde_json::json!(99)),
            ("sequence", serde_json::json!(0)),
            ("sequence", serde_json::json!(u64::MAX)),
            ("extra", serde_json::json!(true)),
        ] {
            let mut r = request();
            r[key] = value;
            assert!(admission().admit(&serde_json::to_vec(&r).unwrap()).is_err());
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[error("HOST_CHANNEL_REJECTED")]
pub struct ChannelRejected;
pub fn run(
    input: &mut impl Read,
    output: &mut impl Write,
    own_pid: u32,
) -> Result<(), ChannelRejected> {
    execute(input, output, own_pid).map_err(|()| ChannelRejected)
}

#[cfg(test)]
mod wire_tests {
    use super::*;
    fn grant() -> serde_json::Value {
        serde_json::json!({"generation":1,"attempt":2,"expected_surface_pid":3,"capability":vec![7;32],
        "workerwDryRun":{"sourceSha":"a".repeat(40),"mode":"DryRun","hostCreated":"4","explorerPid":5,"explorerCreated":"6","modelWindow":901}})
    }
    fn append(input: &mut Vec<u8>, value: serde_json::Value) {
        write_frame(input, &serde_json::to_vec(&value).unwrap(), 512).unwrap();
    }
    #[test]
    fn framed_authentication_workerw_and_eof_use_existing_protocol() {
        let mut input = Vec::new();
        append(&mut input, grant());
        append(
            &mut input,
            serde_json::json!({"accepted":true,"code":"OPENED"}),
        );
        append(
            &mut input,
            serde_json::json!({"version":1,"generation":1,"attempt":2,"capability":"07".repeat(32),"sourceSha":"a".repeat(40),
            "sequence":1,"hostPid":3,"modelWindow":901,"explorerCreated":"6","mode":"DryRun","operation":"attach"}),
        );
        let mut output = Vec::new();
        assert!(run(&mut std::io::Cursor::new(input), &mut output, 3).is_ok());
        let mut output = std::io::Cursor::new(output);
        let request: serde_json::Value =
            serde_json::from_slice(&read_frame(&mut output, 512).unwrap()).unwrap();
        assert_eq!(request["command"], "OpenMain");
        let _ = read_frame(&mut output, 512).unwrap();
        let report: serde_json::Value =
            serde_json::from_slice(&read_frame(&mut output, 512).unwrap()).unwrap();
        assert_eq!(report["state"], "ModelAttached");
        assert_eq!(report["cleanup"], "NotVerified");
        assert_eq!(report["actualAttachmentVerified"], false);
    }
    #[test]
    fn foreign_and_live_grants_rejected_before_handshake() {
        for (key, value) in [
            ("expected_surface_pid", serde_json::json!(99)),
            ("extra", serde_json::json!(true)),
        ] {
            let mut g = grant();
            g[key] = value;
            let mut input = Vec::new();
            append(&mut input, g);
            let mut out = Vec::new();
            assert!(run(&mut std::io::Cursor::new(input), &mut out, 3).is_err());
            assert!(out.is_empty());
        }
        let mut g = grant();
        g["workerwDryRun"]["mode"] = serde_json::json!("Live");
        let mut input = Vec::new();
        append(&mut input, g);
        assert!(run(&mut std::io::Cursor::new(input), &mut Vec::new(), 3).is_err());
    }
}
