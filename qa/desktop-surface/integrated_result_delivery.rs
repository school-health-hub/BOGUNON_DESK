//! Post-save/output result is separate from the immutable pre-save Evidence snapshot.
use super::{Delivery, RunResult};
use serde::Serialize;
#[derive(Debug, Serialize)]
#[serde(bound(serialize = ""))]
pub struct Completed<P> {
    result: RunResult<P>,
    evidence_save: Delivery,
    stdout: Delivery,
    stderr: Delivery,
    exit_code: u8,
}
impl<P> Completed<P> {
    pub fn record(result: RunResult<P>, delivery: Deliveries) -> Self {
        let exit_code = result.exit_code(delivery.evidence, delivery.stdout, delivery.stderr);
        Self {
            result,
            evidence_save: delivery.evidence,
            stdout: delivery.stdout,
            stderr: delivery.stderr,
            exit_code,
        }
    }
    pub const fn exit_code(&self) -> u8 {
        self.exit_code
    }
    pub const fn result(&self) -> &RunResult<P> {
        &self.result
    }
}
#[derive(Debug, Clone, Copy)]
pub struct Deliveries {
    pub evidence: Delivery,
    pub stdout: Delivery,
    pub stderr: Delivery,
}
