#![forbid(unsafe_code)]
use bogunon_surface_channel_host::{
    main_restore::{Capability, RestoreBinding, RestoreResponse, MAX_REQUEST_BYTES},
    memory_channel::{read_frame, write_frame},
};
use serde::Deserialize;
use std::io::{self, Read};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Grant {
    generation: u64,
    attempt: u64,
    expected_surface_pid: u32,
    capability: [u8; 32],
}

fn execute() -> Result<(), ()> {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--inherited-restore-only"] {
        return Err(());
    }
    // Own-process watchdog only. No children, window, shell or filesystem operations.
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_secs(30));
        std::process::exit(124);
    });
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    let mut bytes = read_frame(&mut input, MAX_REQUEST_BYTES).map_err(|_| ())?;
    let grant: Grant = serde_json::from_slice(&bytes).map_err(|_| ())?;
    bytes.fill(0);
    if grant.expected_surface_pid != std::process::id() {
        return Err(());
    }
    let binding = RestoreBinding::new(
        grant.generation,
        grant.attempt,
        grant.expected_surface_pid,
        Capability::from_bytes(grant.capability),
    )
    .ok_or(())?;
    let mut request = binding.request(1).map_err(|_| ())?;
    write_frame(&mut output, &request, MAX_REQUEST_BYTES).map_err(|_| ())?;
    request.fill(0);
    let reply = read_frame(&mut input, MAX_REQUEST_BYTES).map_err(|_| ())?;
    let response: RestoreResponse = serde_json::from_slice(&reply).map_err(|_| ())?;
    if !response.accepted {
        return Err(());
    }
    write_frame(&mut output, &reply, MAX_REQUEST_BYTES).map_err(|_| ())?;
    // No command is executed. Only clean EOF is accepted after authentication.
    let mut unexpected = [0_u8; 1];
    match input.read(&mut unexpected) {
        Ok(0) => Ok(()),
        _ => Err(()),
    }
}

fn main() {
    if execute().is_err() {
        eprintln!("HOST_CHANNEL_REJECTED");
        std::process::exit(2);
    }
}
