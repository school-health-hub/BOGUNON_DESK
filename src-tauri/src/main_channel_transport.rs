//! Public Channel messages stay below the audited Tauri JSON direct-send threshold.
use super::Envelope;
use tauri::ipc::Channel;
const MAX_TRANSFER_BYTES: usize = 16 * 1024 * 1024;
const CHUNK_BYTES: usize = 2048;
const MAX_FRAMES: usize = 8192;

#[derive(serde::Serialize)]
pub(crate) struct TransportFrame {
    transfer: u64,
    index: usize,
    total: usize,
    data: String,
}
impl Envelope {
    pub(super) fn send_frames(
        self,
        destination: &Channel<TransportFrame>,
        transfer: u64,
        admitted: impl Fn() -> bool,
    ) -> Result<(), ()> {
        let json = serde_json::to_string(&self).map_err(|_| ())?;
        if json.len() > MAX_TRANSFER_BYTES {
            return Err(());
        }
        let chunks = chunks(&json);
        if chunks.len() > MAX_FRAMES {
            return Err(());
        }
        for (index, data) in chunks.iter().enumerate() {
            let frame = TransportFrame {
                transfer,
                index,
                total: chunks.len(),
                data: (*data).to_owned(),
            };
            // Tauri 2.11.5 otherwise uses a shared fetch queue without Webview ownership.
            if !admitted() || serde_json::to_vec(&frame).map_err(|_| ())?.len() >= 8192 {
                return Err(());
            }
            destination.send(frame).map_err(|_| ())?;
        }
        Ok(())
    }
}
fn chunks(mut text: &str) -> Vec<&str> {
    let mut result = Vec::new();
    while !text.is_empty() {
        let mut end = text.len().min(CHUNK_BYTES);
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        let (chunk, rest) = text.split_at(end);
        result.push(chunk);
        text = rest;
    }
    result
}
