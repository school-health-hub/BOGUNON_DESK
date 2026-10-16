use crate::{
    diagnostic_output::{Code, Finding, Session},
    gate::{self, GateError},
    observation::*,
    observation_reader::Reader,
    outcome::Report,
    test_window::NativeWindows,
    window_lifecycle::{OwnedWindows, WindowError},
    window_observation::{relations, unchanged},
};

fn observe(
    reader: &mut Reader<crate::read_only_windows::NativeQueries>,
    ids: &[WindowId],
) -> Finding {
    let before = ids
        .iter()
        .map(|id| reader.0.window(*id))
        .collect::<Result<Vec<_>, _>>();
    let Ok(before) = before else {
        return Finding::failure(Code::Snapshot);
    };
    if relations(&before).is_err() {
        return Finding::failure(Code::Snapshot);
    }
    let capability = reader.collect(before[0].identity.id).and_then(|snapshot| {
        unchanged(&reader.0, &before[0], &snapshot.main)
            .map_err(|_| QueryError::IdentityChanged)?;
        reader.topology_consistent(&snapshot)
    });
    let window = before.iter().try_for_each(|old| {
        let after = reader
            .0
            .window(old.identity.id)
            .map_err(|_| WindowError::Observation)?;
        unchanged(&reader.0, old, &after)
    });
    let error = match &capability {
        Ok(()) | Err(QueryError::NoEligibleWorker) => None,
        Err(QueryError::ShellIdentity) => Some(Code::ShellIdentity),
        Err(QueryError::TopologyChanged | QueryError::AmbiguousWorker) => Some(Code::Topology),
        Err(
            QueryError::Api(..)
            | QueryError::Hresult(..)
            | QueryError::InvalidValue(..)
            | QueryError::IdentityChanged
            | QueryError::DpiMismatch,
        ) => Some(Code::Snapshot),
    };
    Finding {
        report: Report::finish(window, capability, Ok(())),
        error: if window.is_err() {
            Some(Code::Snapshot)
        } else {
            error
        },
    }
}

pub struct LiveSession {
    windows: OwnedWindows<NativeWindows>,
}

pub fn prepare() -> Result<LiveSession, Code> {
    let permit = gate::authorize().map_err(|error| match error {
        GateError::OptIn => Code::GateOptIn,
        GateError::Manifest => Code::GateManifest,
        GateError::Artifact => Code::GateArtifact,
        GateError::Source => Code::GateSource,
        GateError::Environment => Code::GateEnvironment,
    })?;
    let api = NativeWindows::new(permit).map_err(|_| Code::WindowSetup)?;
    let windows = OwnedWindows::register(api).map_err(|_| Code::WindowSetup)?;
    Ok(LiveSession { windows })
}
impl Session for LiveSession {
    fn observe(&mut self) -> Finding {
        if self.windows.create_all().is_err() {
            return Finding::failure(Code::WindowCreate);
        }
        match crate::read_only_windows::reader() {
            Ok(mut reader) => observe(&mut reader, self.windows.ids()),
            Err(_) => Finding::failure(Code::Snapshot),
        }
    }
    fn cleanup(&mut self) -> Result<(), ()> {
        self.windows.close().map_err(|_| ())
    }
}
