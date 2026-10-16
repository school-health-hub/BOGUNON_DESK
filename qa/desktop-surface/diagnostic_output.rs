use crate::outcome::{Capability, Report, WindowResult};
use std::{
    io::Write,
    panic::{catch_unwind, AssertUnwindSafe},
};

#[derive(Clone, Copy)]
pub enum Code {
    GateOptIn,
    GateManifest,
    GateArtifact,
    GateSource,
    GateEnvironment,
    WindowSetup,
    WindowCreate,
    Snapshot,
    ShellIdentity,
    Topology,
    InternalPanic,
}
impl Code {
    const fn line(self) -> &'static str {
        match self {
            Self::GateOptIn => "E_GATE_OPT_IN",
            Self::GateManifest => "E_GATE_MANIFEST",
            Self::GateArtifact => "E_GATE_ARTIFACT",
            Self::GateSource => "E_GATE_SOURCE",
            Self::GateEnvironment => "E_GATE_ENVIRONMENT",
            Self::WindowSetup => "E_WINDOW_SETUP",
            Self::WindowCreate => "E_WINDOW_CREATE",
            Self::Snapshot => "E_SNAPSHOT",
            Self::ShellIdentity => "E_SHELL_IDENTITY",
            Self::Topology => "E_TOPOLOGY",
            Self::InternalPanic => "E_INTERNAL_PANIC",
        }
    }
    const fn blocked(self) -> bool {
        matches!(
            self,
            Self::GateOptIn
                | Self::GateManifest
                | Self::GateArtifact
                | Self::GateSource
                | Self::GateEnvironment
        )
    }
}

pub struct Finding {
    pub report: Report,
    pub error: Option<Code>,
}
impl Finding {
    pub const fn failure(error: Code) -> Self {
        Self {
            report: Report {
                window: WindowResult::Fail,
                capability: Capability::NotObserved,
            },
            error: Some(error),
        }
    }
}
pub trait Session {
    fn observe(&mut self) -> Finding;
    fn cleanup(&mut self) -> Result<(), ()>;
}

pub fn install_private_hook() {
    std::panic::set_hook(Box::new(|_| {}));
}

fn capture<T>(operation: impl FnOnce() -> T) -> Result<T, ()> {
    match catch_unwind(AssertUnwindSafe(operation)) {
        Ok(value) => Ok(value),
        Err(payload) => {
            // Do not run an untrusted panic payload destructor in this one-shot process.
            std::mem::forget(payload);
            Err(())
        }
    }
}

pub struct Diagnostic {
    finding: Finding,
    cleanup_failed: bool,
    panicked: bool,
}
pub fn execute<S: Session>(prepare: impl FnOnce() -> Result<S, Code>) -> Diagnostic {
    let mut session = match capture(prepare) {
        Ok(Ok(session)) => session,
        Ok(Err(error)) => {
            return Diagnostic {
                finding: if error.blocked() {
                    Finding {
                        report: Report::not_run(),
                        error: Some(error),
                    }
                } else {
                    Finding::failure(error)
                },
                cleanup_failed: false,
                panicked: false,
            }
        }
        Err(()) => {
            return Diagnostic {
                finding: Finding::failure(Code::InternalPanic),
                cleanup_failed: false,
                panicked: true,
            }
        }
    };
    let observation = capture(|| session.observe());
    let mut panicked = observation.is_err();
    let mut finding = observation.unwrap_or_else(|()| Finding::failure(Code::InternalPanic));
    let cleanup = capture(|| session.cleanup());
    let mut cleanup_failed = !matches!(cleanup, Ok(Ok(())));
    panicked |= cleanup.is_err();
    if capture(|| drop(session)).is_err() {
        cleanup_failed = true;
        panicked = true;
    }
    if cleanup_failed {
        finding.report.window = WindowResult::Fail;
    }
    Diagnostic {
        finding,
        cleanup_failed,
        panicked,
    }
}
impl Diagnostic {
    const fn exit_code(&self) -> u8 {
        if self.cleanup_failed {
            5
        } else if self.panicked {
            4
        } else if matches!(self.finding.report.window, WindowResult::Blocked) {
            2
        } else if matches!(self.finding.report.window, WindowResult::Pass)
            && matches!(
                self.finding.report.capability,
                Capability::Supported | Capability::Unsupported
            )
            && self.finding.error.is_none()
        {
            0
        } else {
            3
        }
    }
    pub fn write_to(self, writer: &mut impl Write) -> u8 {
        let written = capture(|| {
            let (window, capability) = self
                .finding
                .report
                .line()
                .split_once(' ')
                .ok_or(std::io::ErrorKind::InvalidData)?;
            writeln!(writer, "{window}\n{capability}")?;
            if self.cleanup_failed {
                writeln!(writer, "FAIL_CLEANUP")?;
            }
            if let Some(code) = self.finding.error {
                writeln!(writer, "{}", code.line())?;
            }
            if self.panicked && !matches!(self.finding.error, Some(Code::InternalPanic)) {
                writeln!(writer, "E_INTERNAL_PANIC")?;
            }
            if self.cleanup_failed {
                writeln!(writer, "E_CLEANUP")?;
            }
            writer.flush()
        });
        if matches!(written, Ok(Ok(()))) {
            self.exit_code()
        } else {
            6
        }
    }
}
