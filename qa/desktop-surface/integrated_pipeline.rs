//! Synchronous wiring only; the Host notice pump never dispatches OS messages.
use super::{
    approval,
    evidence::{Evidence, Provenance, UnixSeconds},
    gate::{self, Attempt, Input},
    result::{
        delivery::{Completed, Deliveries},
        Delivery, RunResult,
    },
    store,
};
use std::{
    io::Write,
    panic::{catch_unwind, AssertUnwindSafe},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateFailure {
    Rejected(approval::Error),
    Panic,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvidenceFailure {
    Snapshot,
    Store(store::Error),
    Panic,
}
pub struct PipelineReport<P> {
    completed: Completed<P>,
    gate_error: Option<GateFailure>,
    evidence_error: Option<EvidenceFailure>,
    execution_error: Option<gate::ExecutionError>,
}
impl<P> PipelineReport<P> {
    pub fn completed(&self) -> &Completed<P> {
        &self.completed
    }
    pub const fn gate_error(&self) -> Option<GateFailure> {
        self.gate_error
    }
    pub const fn evidence_error(&self) -> Option<EvidenceFailure> {
        self.evidence_error
    }
    pub const fn execution_error(&self) -> Option<gate::ExecutionError> {
        self.execution_error
    }
}
#[cfg(all(windows, not(test)))]
pub fn run_native(
    input: Input<'_>,
    timestamp: UnixSeconds,
    stdout: &mut impl Write,
    stderr: &mut impl Write,
) -> PipelineReport<crate::native_contract::ownership_receipt::Native> {
    run(input, timestamp, stdout, stderr, Attempt::execute_native)
}
fn guarded<T>(f: impl FnOnce() -> T) -> Result<T, ()> {
    catch_unwind(AssertUnwindSafe(f)).map_err(|payload| {
        // A malicious panic payload destructor must not trigger a second unwind here.
        std::mem::forget(payload);
    })
}
fn deliver(writer: &mut impl Write, bytes: &[u8]) -> Result<Delivery, ()> {
    guarded(
        || match writer.write_all(bytes).and_then(|()| writer.flush()) {
            Ok(()) => Delivery::Succeeded,
            Err(_) => Delivery::Failed,
        },
    )
}
fn run<P: Provenance + Clone>(
    input: Input<'_>,
    timestamp: UnixSeconds,
    stdout: &mut impl Write,
    stderr: &mut impl Write,
    driver: impl FnOnce(&Attempt) -> Result<RunResult<P>, gate::ExecutionError>,
) -> PipelineReport<P> {
    let (attempt, gate_error) = match guarded(|| gate::evaluate(input)) {
        Ok(Ok(permit)) => (Some(permit.consume()), None),
        Ok(Err(error)) => (None, Some(GateFailure::Rejected(error))),
        Err(()) => (None, Some(GateFailure::Panic)),
    };
    let mut execution_error = None;
    let mut result = match attempt.as_ref() {
        Some(attempt) => match guarded(|| driver(attempt)) {
            Ok(Ok(result)) => result,
            Ok(Err(error)) => {
                execution_error = Some(error);
                RunResult::execution_unknown(attempt)
            }
            Err(()) => RunResult::panic_unknown(attempt),
        },
        None if gate_error == Some(GateFailure::Panic) => RunResult::gate_blocked().mark_panic(),
        None => RunResult::gate_blocked(),
    };
    let mut evidence_error = None;
    let mut evidence_sha = None;
    let evidence_delivery = match attempt.as_ref() {
        None => Delivery::NotObserved,
        Some(attempt) => {
            let saved = guarded(|| {
                let evidence = Evidence::snapshot(attempt, result.clone(), timestamp)
                    .map_err(|_| EvidenceFailure::Snapshot)?;
                store::Store::new(attempt)
                    .and_then(|mut store| store.save(&evidence))
                    .map_err(EvidenceFailure::Store)
            });
            match saved {
                Ok(Ok(stored)) => {
                    evidence_sha = Some(stored.sha256().to_owned());
                    Delivery::Succeeded
                }
                Ok(Err(error)) => {
                    evidence_error = Some(error);
                    Delivery::Failed
                }
                Err(()) => {
                    result = result.mark_panic();
                    evidence_error = Some(EvidenceFailure::Panic);
                    Delivery::Failed
                }
            }
        }
    };
    // This line is a pre-output snapshot: later stdout/stderr delivery and final exit remain unobserved.
    let output = guarded(|| {
        serde_json::to_vec(&serde_json::json!({
            "runner_id": super::RUNNER_ID, "result": result,
            "evidence_save": evidence_delivery, "evidence_sha256": evidence_sha,
            "gate_error": gate_error.map(|e| format!("{e:?}")),
            "evidence_error": evidence_error.map(|e| format!("{e:?}")),
            "execution_error": execution_error.map(|e| format!("{e:?}")),
            "stdout": Delivery::NotObserved, "stderr": Delivery::NotObserved,
            "final_exit_code": null,
        }))
    });
    let stdout_delivery = match output {
        Ok(Ok(mut bytes)) => {
            bytes.push(b'\n');
            match deliver(stdout, &bytes) {
                Ok(status) => status,
                Err(()) => {
                    result = result.mark_panic();
                    Delivery::Failed
                }
            }
        }
        Ok(Err(_)) => Delivery::Failed,
        Err(()) => {
            result = result.mark_panic();
            Delivery::Failed
        }
    };
    let diagnostic = format!("INTEGRATED_RESULT gate={gate_error:?} execution={execution_error:?} cleanup={:?} evidence={evidence_error:?} stdout={stdout_delivery:?}\n", result.cleanup());
    let stderr_delivery = match deliver(stderr, diagnostic.as_bytes()) {
        Ok(status) => status,
        Err(()) => {
            result = result.mark_panic();
            Delivery::Failed
        }
    };
    PipelineReport {
        completed: Completed::record(
            result,
            Deliveries {
                evidence: evidence_delivery,
                stdout: stdout_delivery,
                stderr: stderr_delivery,
            },
        ),
        gate_error,
        evidence_error,
        execution_error,
    }
}
#[cfg(test)]
pub(crate) fn run_synthetic(
    input: Input<'_>,
    timestamp: UnixSeconds,
    stdout: &mut impl Write,
    stderr: &mut impl Write,
    driver: impl FnOnce(
        &Attempt,
    ) -> Result<
        RunResult<crate::native_contract::ownership_receipt::Synthetic>,
        gate::ExecutionError,
    >,
) -> PipelineReport<crate::native_contract::ownership_receipt::Synthetic> {
    run(input, timestamp, stdout, stderr, driver)
}
#[cfg(test)]
#[path = "integrated_pipeline_tests.rs"]
mod tests;
