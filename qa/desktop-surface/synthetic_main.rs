mod diagnostic_output;
#[path = "../../src-tauri/src/desktop_surface/lifecycle/observation.rs"]
mod observation;
mod outcome;
mod window_lifecycle;
use diagnostic_output::{Code, Finding, Session};
use outcome::{Capability, Report, WindowResult};
use std::{
    cell::RefCell,
    io::{self, Write},
    process::ExitCode,
    rc::Rc,
};

struct Fake {
    case: String,
    trace: Rc<RefCell<Vec<&'static str>>>,
}
impl Session for Fake {
    fn observe(&mut self) -> Finding {
        self.trace.borrow_mut().extend(["create", "observe"]);
        match self.case.as_str() {
            "panic" | "panic-cleanup" | "panic-evidence" | "panic-cleanup-evidence" => {
                panic!("C:\\SYNTHETIC_PRIVATE\\source.rs HWND=SECRET PAYLOAD")
            }
            "snapshot" | "snapshot-evidence" => Finding::failure(Code::Snapshot),
            "shell" => Finding {
                report: Report {
                    window: WindowResult::Pass,
                    capability: Capability::Fail,
                },
                error: Some(Code::ShellIdentity),
            },
            "unsupported" => Finding {
                report: Report {
                    window: WindowResult::Pass,
                    capability: Capability::Unsupported,
                },
                error: None,
            },
            _ => Finding {
                report: Report {
                    window: WindowResult::Pass,
                    capability: Capability::Supported,
                },
                error: None,
            },
        }
    }
    fn cleanup(&mut self) -> Result<(), ()> {
        self.trace.borrow_mut().push("cleanup");
        match self.case.as_str() {
            "cleanup" | "panic-cleanup" | "cleanup-evidence" | "panic-cleanup-evidence" => Err(()),
            "cleanup-panic" => panic!("SYNTHETIC CLEANUP PRIVATE PATH"),
            _ => Ok(()),
        }
    }
    fn persist_evidence(&mut self) -> Result<(), ()> {
        if self.case.contains("evidence") {
            self.trace.borrow_mut().push("save");
            if self.case == "evidence-panic" {
                panic!("SYNTHETIC PRIVATE EVIDENCE PATH");
            }
            Err(())
        } else {
            Ok(())
        }
    }
}
impl Drop for Fake {
    fn drop(&mut self) {
        self.trace.borrow_mut().push("drop");
        if self.case == "drop-panic" {
            panic!("SYNTHETIC PRIVATE DROP");
        }
    }
}
struct Broken;
impl Write for Broken {
    fn write(&mut self, _: &[u8]) -> io::Result<usize> {
        Err(io::ErrorKind::BrokenPipe.into())
    }
    fn flush(&mut self) -> io::Result<()> {
        Err(io::ErrorKind::BrokenPipe.into())
    }
}
fn main() -> ExitCode {
    diagnostic_output::install_private_hook();
    let args: Vec<_> = std::env::args().collect();
    let Some(case) = args.get(1) else {
        return ExitCode::from(2);
    };
    let Some(path) = args.get(2) else {
        return ExitCode::from(2);
    };
    let trace = Rc::new(RefCell::new(vec!["gate"]));
    let result = diagnostic_output::execute(|| {
        if case == "prepare-panic" {
            panic!("SYNTHETIC PRIVATE PREPARE");
        }
        if case == "gate" {
            Err(Code::GateOptIn)
        } else {
            Ok(Fake {
                case: case.clone(),
                trace: trace.clone(),
            })
        }
    });
    if std::fs::write(path, trace.borrow().join(",")).is_err() {
        return ExitCode::from(6);
    }
    let code = if case == "writer" {
        result.write_to(&mut Broken)
    } else {
        result.write_to(&mut io::stdout().lock())
    };
    ExitCode::from(code)
}
