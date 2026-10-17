use crate::{
    diagnostic_output::{Code, Finding, Session},
    evidence_record::Record,
    evidence_store::{self, EvidenceSink},
    gate::{self, GateError},
    test_window::NativeWindows,
    window_lifecycle::OwnedWindows,
};

pub struct LiveSession {
    windows: OwnedWindows<NativeWindows>,
    sink: EvidenceSink,
    evidence: Record,
}

pub fn prepare() -> Result<LiveSession, Code> {
    let permit = gate::authorize().map_err(|error| match error {
        GateError::OptIn => Code::GateOptIn,
        GateError::Manifest => Code::GateManifest,
        GateError::Artifact => Code::GateArtifact,
        GateError::Source => Code::GateSource,
        GateError::Environment => Code::GateEnvironment,
    })?;
    let sink = EvidenceSink::from_environment(&permit).map_err(|_| Code::GateManifest)?;
    let api = NativeWindows::new(permit).map_err(|_| Code::WindowSetup)?;
    let windows = OwnedWindows::register(api).map_err(|_| Code::WindowSetup)?;
    Ok(LiveSession {
        windows,
        sink,
        evidence: Record::default(),
    })
}
impl Session for LiveSession {
    fn observe(&mut self) -> Finding {
        if self.windows.create_all().is_err() {
            return Finding::failure(Code::WindowCreate);
        }
        match crate::read_only_windows::reader() {
            Ok(mut reader) => crate::live_observation::observe(
                &mut reader,
                self.windows.ids(),
                &mut self.evidence,
            ),
            Err(_) => Finding::failure(Code::Snapshot),
        }
    }
    fn cleanup(&mut self) -> Result<(), ()> {
        self.windows.close().map_err(|_| ())
    }
    fn persist_evidence(&mut self) -> Result<(), ()> {
        evidence_store::save(&mut self.sink, &self.evidence).map_err(|_| ())
    }
}
