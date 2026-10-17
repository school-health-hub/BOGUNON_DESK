use crate::own_coordinator::{run, Driver};
use crate::own_result::{Error, Evidence, Report};
use std::panic::{catch_unwind, AssertUnwindSafe};

pub fn execute<D: Driver>(
    mut driver: D,
    mut persist: impl FnMut(&Evidence) -> Result<(), Error>,
    source_sha: &str,
    artifact_sha: &str,
) -> Report {
    let mut report = match caught(|| run(&mut driver)) {
        Ok(result) => Report::new(result),
        Err(()) => Report::new(Err(Error::Panic)),
    };
    let cleanup = match caught(|| driver.cleanup()) {
        Ok(Err(Error::Panic)) => {
            report.panicked = true;
            Err(Error::Cleanup)
        }
        Ok(result) => result,
        Err(()) => {
            report.panicked = true;
            Err(Error::Cleanup)
        }
    };
    let remaining = match caught(|| driver.remaining()) {
        Ok(remaining) => remaining,
        Err(()) => {
            report.panicked = true;
            None
        }
    };
    report.finish_cleanup(cleanup, remaining);
    if caught(|| drop(driver)).is_err() {
        report.panicked = true;
        report.cleanup_passed = false;
    }
    let evidence = Evidence::new(source_sha.to_owned(), artifact_sha.to_owned(), &report);
    match caught(|| persist(&evidence)) {
        Ok(Ok(())) => {}
        Ok(Err(_)) => report.evidence_failed = true,
        Err(()) => {
            report.panicked = true;
            report.evidence_failed = true;
        }
    }
    report
}

fn caught<T>(operation: impl FnOnce() -> T) -> Result<T, ()> {
    catch_unwind(AssertUnwindSafe(operation)).map_err(|payload| {
        std::mem::forget(payload);
    })
}
