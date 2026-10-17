use serde::{Deserialize, Serialize};
use std::io::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Error {
    Gate,
    Native,
    Callback,
    Model,
    Main,
    Cleanup,
    Evidence,
    Panic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Counters {
    pub created: u32,
    pub destroyed: u32,
    pub rejected: u32,
    pub main_unchanged: bool,
}

pub struct Report {
    pub counters: Option<Counters>,
    pub error: Option<Error>,
    pub cleanup_passed: bool,
    pub remaining: Option<u32>,
    pub evidence_failed: bool,
    pub panicked: bool,
}
impl Report {
    pub fn new(result: Result<Counters, Error>) -> Self {
        let (counters, error) = match result {
            Ok(counters) => (Some(counters), None),
            Err(error) => (None, Some(error)),
        };
        Self {
            counters,
            error,
            cleanup_passed: false,
            remaining: None,
            evidence_failed: false,
            panicked: error == Some(Error::Panic),
        }
    }
    pub fn finish_cleanup(&mut self, result: Result<(), Error>, remaining: Option<u32>) {
        self.remaining = remaining;
        self.cleanup_passed = result.is_ok() && remaining == Some(0);
    }
    pub const fn code(&self) -> u8 {
        if !self.cleanup_passed {
            return 5;
        }
        if self.panicked {
            return 4;
        }
        match self.error {
            Some(Error::Panic) => 4,
            Some(Error::Gate) => 2,
            Some(Error::Cleanup) => 5,
            Some(Error::Native | Error::Callback | Error::Model | Error::Main) => 3,
            Some(Error::Evidence) => 6,
            None => {
                if self.evidence_failed {
                    6
                } else {
                    0
                }
            }
        }
    }
    pub fn write_to(&self, writer: &mut impl Write) -> u8 {
        let code = self.code();
        let window = match code {
            0 => "PASS",
            2 => "BLOCKED",
            _ => "FAIL",
        };
        let output = (|| {
            writeln!(writer, "WINDOW={window}")?;
            writeln!(writer, "CAPABILITY=NOT_OBSERVED")?;
            if !self.cleanup_passed {
                writeln!(writer, "FAIL_CLEANUP")?;
            }
            if let Some(error) = self.error {
                writeln!(writer, "{}", error.label())?;
            }
            if self.panicked && self.error != Some(Error::Panic) {
                writeln!(writer, "E_PANIC")?;
            }
            if self.evidence_failed {
                writeln!(writer, "E_EVIDENCE")?;
            }
            writer.flush()
        })();
        if output.is_err() {
            6
        } else {
            code
        }
    }
}
impl Error {
    const fn label(self) -> &'static str {
        match self {
            Self::Gate => "E_GATE",
            Self::Native => "E_NATIVE",
            Self::Callback => "E_CALLBACK",
            Self::Model => "E_MODEL",
            Self::Main => "E_MAIN",
            Self::Cleanup => "E_CLEANUP",
            Self::Evidence => "E_EVIDENCE",
            Self::Panic => "E_PANIC",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RunnerKind {
    #[serde(rename = "OWN_WIN32_SURFACE")]
    OwnWin32Surface,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Capability {
    #[serde(rename = "NOT_OBSERVED")]
    NotObserved,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Check {
    Pass,
    Fail,
    NotObserved,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Evidence {
    #[serde(deserialize_with = "version")]
    pub schema_version: u8,
    pub runner_kind: RunnerKind,
    pub capability: Capability,
    pub source_sha: String,
    pub artifact_sha256: String,
    #[serde(deserialize_with = "required")]
    pub counters: Option<Counters>,
    #[serde(deserialize_with = "required")]
    pub remaining_own_windows: Option<u32>,
    pub cleanup: Check,
    #[serde(deserialize_with = "required")]
    pub reason: Option<Error>,
    pub panicked: bool,
}
impl Evidence {
    pub fn new(source_sha: String, artifact_sha256: String, report: &Report) -> Self {
        Self {
            schema_version: 1,
            runner_kind: RunnerKind::OwnWin32Surface,
            capability: Capability::NotObserved,
            source_sha,
            artifact_sha256,
            counters: report.counters,
            remaining_own_windows: report.remaining,
            cleanup: if report.cleanup_passed {
                Check::Pass
            } else {
                Check::Fail
            },
            reason: report.error,
            panicked: report.panicked,
        }
    }
}
fn version<'de, D: serde::Deserializer<'de>>(de: D) -> Result<u8, D::Error> {
    match u8::deserialize(de)? {
        1 => Ok(1),
        _ => Err(serde::de::Error::custom("invalid schema version")),
    }
}

fn required<'de, D, T>(de: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(de)
}
