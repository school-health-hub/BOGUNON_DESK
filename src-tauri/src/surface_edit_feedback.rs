//! Status only over the owning child's inherited pipe. Never a command channel.
use bogunon_main_restore_protocol::memory_channel::read_frame;
use std::{
    io::Read,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{ipc::Channel, Manager};

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum EditState {
    Idle,
    Editing,
    Closed,
}

type Sink = Arc<dyn Fn(EditState, u64) + Send + Sync>;
pub(crate) struct Feedback {
    state: EditState,
    sink: Option<Sink>,
    revision: u64,
    active: Arc<AtomicBool>,
}
pub(crate) type SharedFeedback = Arc<Mutex<Feedback>>;

fn decode(payload: &[u8]) -> Option<EditState> {
    match payload {
        b"editing" => Some(EditState::Editing),
        b"idle" => Some(EditState::Idle),
        _ => None,
    }
}

fn publish(shared: &SharedFeedback, state: EditState) {
    let delivery = {
        let Ok(mut feedback) = shared.lock() else {
            return;
        };
        if !feedback.active.load(Ordering::Acquire) {
            return;
        }
        feedback.state = state;
        feedback.revision = feedback.revision.saturating_add(1);
        let delivery = (feedback.sink.clone(), feedback.revision);
        if state == EditState::Closed {
            feedback.sink = None;
        }
        delivery
    };
    if let (Some(sink), revision) = delivery {
        sink(state, revision);
    }
}

pub(crate) fn retire(shared: &SharedFeedback) {
    if let Ok(mut feedback) = shared.lock() {
        feedback.active.store(false, Ordering::Release);
        feedback.sink = None;
        feedback.state = EditState::Closed;
    }
}

pub(crate) fn start(mut reader: impl Read + Send + 'static) -> SharedFeedback {
    // Each child owns a new Arc; an old EOF cannot clear a replacement session.
    let shared = Arc::new(Mutex::new(Feedback {
        state: EditState::Idle,
        sink: None,
        revision: 0,
        active: Arc::new(AtomicBool::new(true)),
    }));
    let output = Arc::clone(&shared);
    std::thread::spawn(move || {
        read_status(&mut reader, |state| publish(&output, state));
    });
    shared
}

fn read_status(reader: &mut impl Read, mut observe: impl FnMut(EditState)) {
    while let Ok(payload) = read_frame(reader, 7) {
        let Some(state) = decode(&payload) else {
            break;
        };
        observe(state);
    }
    // EOF, malformed/oversized frame, or Host failure is never 'editing'.
    observe(EditState::Closed);
}

pub(crate) fn subscribe(
    shared: &SharedFeedback,
    caller: tauri::Webview,
    channel: Channel<EditState>,
) -> Result<(), String> {
    let lease = crate::main_lifetime::snapshot(caller.app_handle())
        .map_err(|_| "Surface state unavailable")?;
    let active = Arc::clone(
        &shared
            .lock()
            .map_err(|_| "Surface state unavailable")?
            .active,
    );
    let delivered = Arc::new(AtomicU64::new(0));
    let sink: Sink = Arc::new(move |state, revision| {
        let caller = caller.clone();
        let channel = channel.clone();
        let lease = lease.clone();
        let active = Arc::clone(&active);
        let delivered = Arc::clone(&delivered);
        // No UI getter or Channel delivery while holding Feedback/Runtime locks.
        let app = caller.app_handle().clone();
        let _ = app.run_on_main_thread(move || {
            if !active.load(Ordering::Acquire)
                || revision < delivered.load(Ordering::Acquire)
                || !crate::main_lifetime::current(caller.app_handle(), &lease)
            {
                return;
            }
            delivered.store(revision, Ordering::Release);
            let _ = crate::main_caller::run(&caller, || channel.send(state));
        });
    });
    let snapshot = {
        let mut feedback = shared.lock().map_err(|_| "Surface state unavailable")?;
        if feedback.state == EditState::Closed || !feedback.active.load(Ordering::Acquire) {
            return Err("Surface Host is not active".into());
        }
        feedback.sink = Some(Arc::clone(&sink));
        (feedback.state, feedback.revision)
    };
    sink(snapshot.0, snapshot.1);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn optional_channel_id_uses_the_locked_tauri_deserializer() {
        use tauri::ipc::JavaScriptChannelId;
        assert!(serde_json::from_str::<Option<JavaScriptChannelId>>(r#""__CHANNEL__:42""#).is_ok());
        assert!(serde_json::from_str::<Option<JavaScriptChannelId>>("null").is_ok());
        for invalid in [r#""42""#, r#""__CHANNEL__:invalid""#, "42", "{}"] {
            assert!(serde_json::from_str::<Option<JavaScriptChannelId>>(invalid).is_err());
        }
    }
    #[test]
    fn reader_closes_after_eof_malformed_oversized_or_truncated_frames() {
        use bogunon_main_restore_protocol::memory_channel::write_frame;
        let mut valid = Vec::new();
        write_frame(&mut valid, b"editing", 7).unwrap_or_else(|_| panic!("fixture frame"));
        write_frame(&mut valid, b"idle", 7).unwrap_or_else(|_| panic!("fixture frame"));
        let mut observed = Vec::new();
        read_status(&mut valid.as_slice(), |state| observed.push(state));
        assert_eq!(
            observed,
            vec![EditState::Editing, EditState::Idle, EditState::Closed]
        );
        for invalid in [
            vec![],
            vec![8, 0, 0, 0],
            vec![4, 0, 0, 0, b'i'],
            vec![3, 0, 0, 0, b'b', b'a', b'd'],
        ] {
            observed.clear();
            read_status(&mut invalid.as_slice(), |state| observed.push(state));
            assert_eq!(observed, vec![EditState::Closed]);
        }
    }
    #[test]
    fn status_is_fixed_and_has_no_command_or_sensitive_payload() {
        assert_eq!(decode(b"editing"), Some(EditState::Editing));
        assert_eq!(decode(b"idle"), Some(EditState::Idle));
        for invalid in [
            b"OpenMain".as_slice(),
            b"idle\n",
            b"",
            b"{\"editing\":true}",
        ] {
            assert_eq!(decode(invalid), None);
        }
    }

    #[test]
    fn eof_and_retirement_cannot_keep_or_reactivate_editing() {
        let shared = Arc::new(Mutex::new(Feedback {
            state: EditState::Editing,
            sink: None,
            revision: 0,
            active: Arc::new(AtomicBool::new(true)),
        }));
        let observed = Arc::new(Mutex::new(Vec::new()));
        let sink_output = Arc::clone(&observed);
        if let Ok(mut feedback) = shared.lock() {
            feedback.sink = Some(Arc::new(move |state, _| {
                if let Ok(mut output) = sink_output.lock() {
                    output.push(state);
                }
            }));
        }
        publish(&shared, EditState::Idle);
        publish(&shared, EditState::Closed);
        assert!(shared
            .lock()
            .unwrap_or_else(|_| panic!("fixture lock"))
            .sink
            .is_none());
        assert_eq!(
            *observed.lock().unwrap_or_else(|_| panic!("fixture lock")),
            vec![EditState::Idle, EditState::Closed]
        );
        retire(&shared);
        publish(&shared, EditState::Editing);
        let feedback = shared.lock().unwrap_or_else(|_| panic!("fixture lock"));
        assert_eq!(feedback.state, EditState::Closed);
        assert!(feedback.sink.is_none());
    }
}
