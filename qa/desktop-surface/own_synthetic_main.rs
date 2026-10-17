mod disposable_surface;
mod own_coordinator;
mod own_execution;
mod own_result;
mod surface_event_router;
mod surface_event_types;

use own_coordinator::{Driver, Notice, NoticeKind};
use own_result::Error;
use surface_event_types::Binding;

struct Synthetic {
    scenario: String,
    pending: Vec<Notice>,
    alive: bool,
}
impl Driver for Synthetic {
    fn create(&mut self, binding: &Binding) -> Result<(), Error> {
        self.alive = true;
        if self.scenario == "partial-panic" {
            panic!("PRIVATE_PATH_HWND_MARKER");
        }
        self.pending.push(Notice {
            binding: binding.clone(),
            kind: NoticeKind::Created,
        });
        Ok(())
    }
    fn observe(&mut self) -> Result<(), Error> {
        match self.scenario.as_str() {
            "panic" | "panic-cleanup" => panic!("PRIVATE_PATH_HWND_MARKER"),
            "observe-fail" => Err(Error::Native),
            _ => Ok(()),
        }
    }
    fn drain(&mut self) -> Result<Vec<Notice>, Error> {
        Ok(std::mem::take(&mut self.pending))
    }
    fn dispose(&mut self, binding: &Binding) -> Result<(), Error> {
        self.alive = false;
        self.pending.push(Notice {
            binding: binding.clone(),
            kind: NoticeKind::Destroyed,
        });
        Ok(())
    }
    fn cleanup(&mut self) -> Result<(), Error> {
        match self.scenario.as_str() {
            "typed-cleanup-panic" => Err(Error::Panic),
            "cleanup-fail" | "panic-cleanup" | "cleanup-evidence" => Err(Error::Cleanup),
            _ => {
                self.alive = false;
                Ok(())
            }
        }
    }
    fn remaining(&self) -> Option<u32> {
        Some(u32::from(self.alive))
    }
}
struct BrokenWriter;
impl std::io::Write for BrokenWriter {
    fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
        Err(std::io::ErrorKind::BrokenPipe.into())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Err(std::io::ErrorKind::BrokenPipe.into())
    }
}
fn main() -> std::process::ExitCode {
    std::panic::set_hook(Box::new(|_| {}));
    let scenario = std::env::args().nth(1).unwrap_or_default();
    let report = if scenario == "gate" {
        let mut report = own_result::Report::new(Err(Error::Gate));
        report.finish_cleanup(Ok(()), Some(0));
        report
    } else {
        let driver = Synthetic {
            scenario: scenario.clone(),
            pending: Vec::new(),
            alive: false,
        };
        own_execution::execute(
            driver,
            |_| match scenario.as_str() {
                "evidence-fail" | "cleanup-evidence" => Err(Error::Evidence),
                _ => Ok(()),
            },
            &"a".repeat(40),
            &"b".repeat(64),
        )
    };
    let code = match scenario.as_str() {
        "writer-fail" => report.write_to(&mut BrokenWriter),
        _ => report.write_to(&mut std::io::stdout().lock()),
    };
    std::process::ExitCode::from(code)
}
