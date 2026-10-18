use super::super::{channel_state::ChannelState, BusinessEvent, Envelope, TransportFrame};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};
type Messages = Arc<Mutex<Vec<serde_json::Value>>>;
fn collecting_channel() -> (Channel<TransportFrame>, Messages) {
    let received = Arc::new(Mutex::new(Vec::new()));
    let messages = Arc::clone(&received);
    let channel = Channel::new(move |body| {
        match body {
            InvokeResponseBody::Json(json) => {
                assert!(json.len() < 8192);
                messages
                    .lock()
                    .unwrap()
                    .push(serde_json::from_str(&json).unwrap());
            }
            InvokeResponseBody::Raw(_) => panic!("Expected JSON transport frame"),
        }
        Ok(())
    });
    (channel, received)
}
fn reassemble(messages: &[serde_json::Value]) -> serde_json::Value {
    let text: String = messages
        .iter()
        .enumerate()
        .map(|(index, frame)| {
            assert_eq!(frame["index"], index);
            assert_eq!(frame["total"], messages.len());
            frame["data"].as_str().unwrap()
        })
        .collect();
    serde_json::from_str(&text).unwrap()
}
#[test]
fn public_channel_sends_the_six_existing_envelopes() {
    let (channel, received) = collecting_channel();
    let mut state = ChannelState::default();
    let epoch = state.register(channel).unwrap();
    for event in [
        BusinessEvent::Navigate,
        BusinessEvent::Notice,
        BusinessEvent::FileDrop,
        BusinessEvent::AnalysisStart,
        BusinessEvent::Analysis,
        BusinessEvent::AnalysisError,
    ] {
        let payload = serde_json::json!({"unchanged": ["payload", 1, null]});
        state
            .deliver(Some(epoch), |destination, transfer| {
                Envelope {
                    event: event.name(),
                    payload,
                }
                .send_frames(destination, transfer)
            })
            .unwrap();
    }
    let messages = received.lock().unwrap();
    assert_eq!(messages.len(), 6);
    let envelopes: Vec<_> = messages
        .iter()
        .map(|frame| reassemble(std::slice::from_ref(frame)))
        .collect();
    let names: Vec<_> = envelopes
        .iter()
        .map(|message| message["event"].as_str().unwrap())
        .collect();
    assert_eq!(
        names,
        [
            "desktop:navigate",
            "desktop:notice",
            "desktop:file-drop",
            "purchase:analysis-start",
            "purchase:analysis",
            "purchase:analysis-error"
        ]
    );
    assert!(envelopes.iter().all(
        |message| message["payload"] == serde_json::json!({"unchanged": ["payload", 1, null]})
    ));
    for (index, frame) in messages.iter().enumerate() {
        assert_eq!(frame["transfer"], index + 1);
    }
}
#[test]
fn public_channel_send_error_revokes_destination() {
    let channel = Channel::new(|_| Err(tauri::Error::AssetNotFound("test".into())));
    let mut state = ChannelState::default();
    let epoch = state.register(channel).unwrap();
    assert!(state
        .deliver(Some(epoch), |destination, transfer| Envelope {
            event: "desktop:notice",
            payload: serde_json::Value::Null
        }
        .send_frames(destination, transfer))
        .is_err());
    assert!(!state.matches(Some(epoch)));
}
#[test]
fn exact_serialized_envelope_boundaries_and_large_unicode_use_only_direct_frames() {
    let empty = Envelope {
        event: "purchase:analysis",
        payload: serde_json::json!({"value": ""}),
    };
    let overhead = serde_json::to_vec(&empty).unwrap().len();
    for size in [8191, 8192, 128 * 1024] {
        let (channel, received) = collecting_channel();
        let payload = serde_json::json!({"value": "x".repeat(size - overhead)});
        let envelope = Envelope {
            event: "purchase:analysis",
            payload: payload.clone(),
        };
        assert_eq!(serde_json::to_vec(&envelope).unwrap().len(), size);
        envelope.send_frames(&channel, 1).unwrap();
        assert_eq!(reassemble(&received.lock().unwrap())["payload"], payload);
    }
    let (channel, received) = collecting_channel();
    let payload = serde_json::json!({"value": "한글😀\\\"".repeat(4096)});
    Envelope {
        event: "purchase:analysis",
        payload: payload.clone(),
    }
    .send_frames(&channel, 1)
    .unwrap();
    assert_eq!(reassemble(&received.lock().unwrap())["payload"], payload);
}
#[test]
fn oversized_transfer_never_sends_any_frame() {
    let (channel, received) = collecting_channel();
    let payload = serde_json::json!({"value": "x".repeat(16 * 1024 * 1024)});
    assert!(Envelope {
        event: "purchase:analysis",
        payload
    }
    .send_frames(&channel, 1)
    .is_err());
    assert!(received.lock().unwrap().is_empty());
}

#[test]
fn partial_transfer_failure_revokes_and_stops_sending() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let attempts = Arc::new(AtomicUsize::new(0));
    let count = Arc::clone(&attempts);
    let channel = Channel::new(move |_| {
        if count.fetch_add(1, Ordering::SeqCst) == 1 {
            return Err(tauri::Error::AssetNotFound("test".into()));
        }
        Ok(())
    });
    let mut state = ChannelState::default();
    let epoch = state.register(channel).unwrap();
    assert!(state
        .deliver(Some(epoch), |destination, transfer| Envelope {
            event: "purchase:analysis",
            payload: serde_json::json!({"value": "x".repeat(10_000)})
        }
        .send_frames(destination, transfer))
        .is_err());
    assert_eq!(attempts.load(Ordering::SeqCst), 2);
    assert!(!state.matches(Some(epoch)));
}
