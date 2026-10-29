use crate::ipc::{parse_request, Admission, Generation, IpcError, RequestKind};
use serde_json::json;
use thiserror::Error;

pub const SURFACE_HOST: &str = "bogunon-surface.localhost";
pub const SURFACE_ENTRY_URL: &str = "https://bogunon-surface.localhost/surface.html";
pub const APPROVED_ACTION_IDS: [&str; 4] = [
    "official-document",
    "purchase-helper",
    "record-helper",
    "home",
];

pub fn surface_entry_url(generation: Generation) -> String {
    format!("{SURFACE_ENTRY_URL}?generation={}", generation.get())
}

pub fn is_admitted_surface_url(uri: &str) -> bool {
    uri == SURFACE_ENTRY_URL
        || uri
            .strip_prefix(&format!("{SURFACE_ENTRY_URL}?generation="))
            .is_some_and(|value| value.parse::<u64>().is_ok_and(|value| value > 0))
        || uri.starts_with(&format!("https://{SURFACE_HOST}/assets/"))
}

pub fn admitted_web_message_origin(
    document_uri: &str,
    generation: Generation,
) -> Option<&'static str> {
    (document_uri == surface_entry_url(generation)).then_some(crate::ipc::SURFACE_ORIGIN)
}

pub trait MainOpener {
    type Error;
    /// Requests display of an already-running, admitted Main instance.
    /// Implementations must not create Main or synchronously re-enter Surface IPC.
    fn open_existing_main(&self) -> Result<(), Self::Error>;
}

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionError {
    #[error("surface IPC was rejected: {0}")]
    Ipc(#[from] IpcError),
    #[error("the existing Main window could not be opened")]
    MainUnavailable,
    #[error("surface response serialization failed")]
    Serialization,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionResponse {
    MainOpened,
    Projection(String),
    RendererReady,
    Editing(bool),
}

pub struct SurfaceConnection<M: MainOpener> {
    admission: Admission,
    main: M,
}

impl<M: MainOpener> SurfaceConnection<M> {
    pub const fn new(generation: Generation, main: M) -> Self {
        Self {
            admission: Admission::new(generation),
            main,
        }
    }

    pub fn handle(
        &mut self,
        payload: &[u8],
        source: &str,
        top_level: bool,
    ) -> Result<ConnectionResponse, ConnectionError> {
        let request = parse_request(payload, source, top_level)?;
        match self.admission.admit(request)? {
            RequestKind::OpenMain => {
                self.main
                    .open_existing_main()
                    .map_err(|_| ConnectionError::MainUnavailable)?;
                Ok(ConnectionResponse::MainOpened)
            }
            RequestKind::RefreshProjection => {
                synthetic_projection_envelope().map(ConnectionResponse::Projection)
            }
            RequestKind::RendererReady => Ok(ConnectionResponse::RendererReady),
            RequestKind::EditStarted => Ok(ConnectionResponse::Editing(true)),
            RequestKind::EditStopped => Ok(ConnectionResponse::Editing(false)),
        }
    }

    pub const fn retire_main(&mut self) {
        self.admission.retire_main();
    }
}

pub fn synthetic_projection_envelope() -> Result<String, ConnectionError> {
    serde_json::to_string(&json!({
        "kind": "SurfaceProjection",
        "projection": {
            "kind": "synthetic-preview",
            "generatedAt": "2026-10-23T09:41:00+09:00",
            "calendarEvents": [
                { "date": "2026-10-06", "kind": "education", "label": "합성 교육 일정" },
                { "date": "2026-10-14", "kind": "checkup", "label": "합성 검진 일정" }
            ],
            "tasks": [
                { "id": "synthetic-task-1", "label": "합성 보건실 점검표 확인", "dueDate": "2026-10-23", "completed": false, "order": 1 }
            ],
            "ddays": [
                { "id": "synthetic-dday-1", "label": "합성 연수 신청", "targetDate": "2026-10-23", "remainingDays": 0, "kind": "task" }
            ],
            "weather": { "state": "ready", "temperatureCelsius": 18, "condition": "맑고 선선함", "iconCode": "sunny", "updatedAt": "2026-10-23T09:35:00+09:00" },
            "launchers": [
                { "actionId": "official-document", "label": "공문 작업실", "icon": "document" },
                { "actionId": "purchase-helper", "label": "Purchase Helper", "icon": "purchase" },
                { "actionId": "record-helper", "label": "Record Helper", "icon": "record" },
                { "actionId": "home", "label": "메인 Dashboard", "icon": "dashboard" }
            ]
        }
    }))
    .map_err(|_| ConnectionError::Serialization)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ipc::SURFACE_ORIGIN;
    use std::cell::Cell;

    struct Main(Cell<u32>);
    impl MainOpener for Main {
        type Error = ();
        fn open_existing_main(&self) -> Result<(), Self::Error> {
            self.0.set(self.0.get() + 1);
            Ok(())
        }
    }

    fn request(command: &str, sequence: u64) -> Vec<u8> {
        format!(r#"{{"generation":7,"sequence":{sequence},"command":"{command}"}}"#).into_bytes()
    }

    #[test]
    fn edit_status_preserves_ready_origin_generation_sequence_and_retirement_boundaries() {
        let generation = Generation::new(7).unwrap_or_else(|| panic!("fixture generation"));
        let mut connection = SurfaceConnection::new(generation, Main(Cell::new(0)));
        assert!(connection
            .handle(&request("EditStarted", 1), SURFACE_ORIGIN, true)
            .is_err());
        assert_eq!(
            connection.handle(&request("RendererReady", 1), SURFACE_ORIGIN, true),
            Ok(ConnectionResponse::RendererReady)
        );
        for command in ["EditStarted", "EditStopped"] {
            assert!(connection
                .handle(&request(command, 2), "https://invalid.test", true)
                .is_err());
            assert!(connection
                .handle(&request(command, 2), SURFACE_ORIGIN, false)
                .is_err());
        }
        assert_eq!(
            connection.handle(&request("EditStarted", 2), SURFACE_ORIGIN, true),
            Ok(ConnectionResponse::Editing(true))
        );
        assert!(connection
            .handle(&request("EditStopped", 2), SURFACE_ORIGIN, true)
            .is_err());
        assert_eq!(
            connection.handle(&request("EditStopped", 3), SURFACE_ORIGIN, true),
            Ok(ConnectionResponse::Editing(false))
        );
        assert_eq!(connection.main.0.get(), 0);
        connection.retire_main();
        assert!(connection
            .handle(&request("EditStarted", 4), SURFACE_ORIGIN, true)
            .is_err());
    }

    #[test]
    fn admits_only_existing_open_main_and_synthetic_projection() {
        let Some(generation) = Generation::new(7) else {
            panic!("test generation must be nonzero")
        };
        let mut connection = SurfaceConnection::new(generation, Main(Cell::new(0)));
        assert_eq!(
            connection.handle(&request("OpenMain", 1), SURFACE_ORIGIN, true),
            Ok(ConnectionResponse::MainOpened)
        );
        let Ok(response) =
            connection.handle(&request("RefreshProjection", 2), SURFACE_ORIGIN, true)
        else {
            panic!("synthetic projection request must be admitted")
        };
        let ConnectionResponse::Projection(payload) = response else {
            panic!("expected projection")
        };
        assert!(payload.contains("synthetic-preview"));
        for id in APPROVED_ACTION_IDS {
            assert!(payload.contains(id));
        }
    }

    #[test]
    fn preserves_origin_generation_sequence_and_retirement_guards() {
        let Some(generation) = Generation::new(7) else {
            panic!("test generation must be nonzero")
        };
        let mut connection = SurfaceConnection::new(generation, Main(Cell::new(0)));
        assert!(matches!(
            connection.handle(&request("OpenMain", 1), "https://example.test", true),
            Err(ConnectionError::Ipc(IpcError::WrongOrigin))
        ));
        assert!(connection
            .handle(&request("OpenMain", 1), SURFACE_ORIGIN, true)
            .is_ok());
        assert!(matches!(
            connection.handle(&request("OpenMain", 1), SURFACE_ORIGIN, true),
            Err(ConnectionError::Ipc(IpcError::StaleSequence))
        ));
        connection.retire_main();
        assert!(matches!(
            connection.handle(&request("OpenMain", 2), SURFACE_ORIGIN, true),
            Err(ConnectionError::Ipc(IpcError::MainRetired))
        ));
    }

    #[test]
    fn renderer_ready_is_admitted_once_without_opening_main() {
        let Some(generation) = Generation::new(7) else {
            panic!("test generation must be nonzero")
        };
        let mut connection = SurfaceConnection::new(generation, Main(Cell::new(0)));
        assert_eq!(
            connection.handle(&request("RendererReady", 1), SURFACE_ORIGIN, true),
            Ok(ConnectionResponse::RendererReady)
        );
        assert_eq!(
            connection.handle(&request("RendererReady", 2), SURFACE_ORIGIN, true),
            Err(ConnectionError::Ipc(IpcError::RendererAlreadyReady))
        );
        assert_eq!(connection.main.0.get(), 0);
    }

    #[test]
    fn binds_navigation_to_the_nonzero_runtime_generation() {
        let Some(generation) = Generation::new(19) else {
            panic!("test generation must be nonzero")
        };
        assert_eq!(
            surface_entry_url(generation),
            format!("{SURFACE_ENTRY_URL}?generation=19")
        );
        assert!(is_admitted_surface_url(&surface_entry_url(generation)));
        assert!(!is_admitted_surface_url(&format!(
            "{SURFACE_ENTRY_URL}?generation=0"
        )));
        assert!(!is_admitted_surface_url(
            "https://example.test/surface.html?generation=19"
        ));
    }

    #[test]
    fn admits_web_messages_from_the_bound_surface_document_uri() {
        let Some(generation) = Generation::new(19) else {
            panic!("test generation must be nonzero")
        };
        let Some(other_generation) = Generation::new(20) else {
            panic!("test generation must be nonzero")
        };

        assert_eq!(
            admitted_web_message_origin(&surface_entry_url(generation), generation),
            Some(SURFACE_ORIGIN)
        );
        assert_eq!(
            admitted_web_message_origin(SURFACE_ORIGIN, generation),
            None
        );
        assert_eq!(
            admitted_web_message_origin(&surface_entry_url(other_generation), generation),
            None
        );
        assert_eq!(
            admitted_web_message_origin(
                "https://bogunon-surface.localhost/assets/surface.js",
                generation,
            ),
            None
        );
    }
}
