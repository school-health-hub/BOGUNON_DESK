//! Pre-publication snapshot: never attests its own save or later output success.
use super::{
    approval::Binding,
    gate::Attempt,
    result::{Delivery, Lifecycle, RunResult, StageName},
};
use serde::Serialize;
use std::marker::PhantomData;
#[derive(Debug, Clone, Copy, Serialize)]
pub struct UnixSeconds(u64);
impl UnixSeconds {
    pub const fn new(value: u64) -> Self {
        Self(value)
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SnapshotState {
    BeforePublishAndOutput,
}
// Completed means a preceding synchronous Driver step returned successfully.
// It does not independently attest a Win32 message or asynchronous observation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StepStatus {
    Completed,
    Failed,
    NotObserved,
}
#[derive(Debug, Serialize)]
struct Step {
    stage: StageName,
    status: StepStatus,
}
mod sealed {
    pub trait Sealed {}
}
pub trait Provenance: sealed::Sealed {
    const NAME: &'static str;
}
use crate::native_contract::ownership_receipt::{Native, Synthetic};
impl sealed::Sealed for Native {}
impl sealed::Sealed for Synthetic {}
impl Provenance for Native {
    const NAME: &'static str = "NATIVE_OBSERVATION";
}
impl Provenance for Synthetic {
    const NAME: &'static str = "SYNTHETIC_ONLY";
}
#[derive(Serialize)]
#[serde(bound(serialize = ""))]
pub struct Evidence<P> {
    schema_version: u8,
    runner_id: &'static str,
    scope: &'static str,
    evidence_namespace: &'static str,
    observation_provenance: &'static str,
    source_head: String,
    source_sha: String,
    executable_sha256: String,
    manifest_sha256: String,
    descriptor_sha256: String,
    result: RunResult<P>,
    lifecycle_steps: [Step; 9],
    snapshot_unix_seconds: UnixSeconds,
    persistence_at_snapshot: SnapshotState,
    evidence_save_at_snapshot: Delivery,
    stdout_at_snapshot: Delivery,
    stderr_at_snapshot: Delivery,
    #[serde(skip)]
    binding: Binding,
    #[serde(skip)]
    provenance: PhantomData<P>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Binding,
}
impl<P: Provenance> Evidence<P> {
    pub fn snapshot(
        attempt: &Attempt,
        result: RunResult<P>,
        timestamp: UnixSeconds,
    ) -> Result<Self, Error> {
        if !result.matches(attempt) {
            return Err(Error::Binding);
        }
        let binding = attempt.binding();
        let stages = [
            StageName::Create,
            StageName::CreateDelivery,
            StageName::CreateCompleted,
            StageName::Close,
            StageName::CloseDelivery,
            StageName::CloseCompleted,
            StageName::Finalization,
            StageName::FinalDrain,
            StageName::Proof,
        ];
        let failed = match result.lifecycle() {
            Lifecycle::Failed(stage) => stages.iter().position(|s| *s == stage),
            Lifecycle::Succeeded | Lifecycle::NotObserved | Lifecycle::Panic => None,
        };
        let lifecycle_steps = std::array::from_fn(|index| {
            let status = match result.lifecycle() {
                Lifecycle::Succeeded => StepStatus::Completed,
                Lifecycle::NotObserved | Lifecycle::Panic => StepStatus::NotObserved,
                Lifecycle::Failed(_) => match failed {
                    Some(n) if index < n => StepStatus::Completed,
                    Some(n) if index == n => StepStatus::Failed,
                    Some(_) | None => StepStatus::NotObserved,
                },
            };
            Step {
                stage: stages[index],
                status,
            }
        });
        Ok(Self {
            schema_version: 1,
            runner_id: super::RUNNER_ID,
            scope: super::SCOPE,
            evidence_namespace: super::EVIDENCE_NAMESPACE,
            observation_provenance: P::NAME,
            source_head: binding.source_head.clone(),
            source_sha: binding.source_sha.clone(),
            executable_sha256: binding.executable_sha256.clone(),
            manifest_sha256: binding.manifest_sha256.clone(),
            descriptor_sha256: binding.descriptor_sha256.clone(),
            result,
            lifecycle_steps,
            snapshot_unix_seconds: timestamp,
            persistence_at_snapshot: SnapshotState::BeforePublishAndOutput,
            evidence_save_at_snapshot: Delivery::NotObserved,
            stdout_at_snapshot: Delivery::NotObserved,
            stderr_at_snapshot: Delivery::NotObserved,
            binding: binding.clone(),
            provenance: PhantomData,
        })
    }
    pub(super) fn matches(&self, attempt: &Attempt) -> bool {
        self.binding == *attempt.binding()
    }
}
