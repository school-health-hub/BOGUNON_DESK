//! No arbitrary status constructor can attest a Native A+B proof.
use super::{approval::Binding, gate::Attempt};
use crate::native_contract::{
    creator_thread_host::synchronous_driver::{DriverReport, Stage},
    failure_cleanup,
};
use serde::Serialize;
#[path = "integrated_result_cause.rs"]
pub mod diagnostic;
use diagnostic::{Cause, CleanupAdmission, CleanupFact};
use std::marker::PhantomData;
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StageName {
    Create,
    CreateDelivery,
    CreateCompleted,
    Close,
    CloseDelivery,
    CloseCompleted,
    Finalization,
    FinalDrain,
    Proof,
}
impl From<Stage> for StageName {
    fn from(stage: Stage) -> Self {
        match stage {
            Stage::Create => Self::Create,
            Stage::CreateDelivery => Self::CreateDelivery,
            Stage::CreateCompleted => Self::CreateCompleted,
            Stage::Close => Self::Close,
            Stage::CloseDelivery => Self::CloseDelivery,
            Stage::CloseCompleted => Self::CloseCompleted,
            Stage::Finalization => Self::Finalization,
            Stage::FinalDrain => Self::FinalDrain,
            Stage::Proof => Self::Proof,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Lifecycle {
    NotObserved,
    Succeeded,
    Failed(StageName),
    Panic,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Cleanup {
    NotObserved,
    NotRequiredVerifiedByProof,
    Succeeded,
    Failed,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Proof {
    Missing,
    VerifiedAB,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Delivery {
    NotObserved,
    Succeeded,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GateStatus {
    Passed,
    Blocked,
}
// Cloning this sanitized summary grants neither Proof issuance nor execution admission.
#[derive(Debug, Clone, Serialize)]
#[serde(bound(serialize = ""))]
pub struct RunResult<P> {
    gate: GateStatus,
    lifecycle: Lifecycle,
    failure_cleanup: Cleanup,
    proof: Proof,
    lifecycle_failure_cause: Option<Cause>,
    cleanup_failure_fact: Option<CleanupFact>,
    cleanup_admission_error: Option<CleanupAdmission>,
    #[serde(skip)]
    binding: Option<Binding>,
    #[serde(skip)]
    provenance: PhantomData<P>,
}
impl<P> RunResult<P> {
    pub const fn gate_blocked() -> Self {
        Self {
            gate: GateStatus::Blocked,
            lifecycle: Lifecycle::NotObserved,
            failure_cleanup: Cleanup::NotObserved,
            proof: Proof::Missing,
            lifecycle_failure_cause: None,
            cleanup_failure_fact: None,
            cleanup_admission_error: None,
            binding: None,
            provenance: PhantomData,
        }
    }
    pub(super) fn from_driver(attempt: &Attempt, report: &DriverReport<P>) -> Self {
        let lifecycle = match report.lifecycle() {
            Ok(()) => Lifecycle::Succeeded,
            Err(f) => Lifecycle::Failed(f.stage.into()),
        };
        let proof = match report.proof() {
            Some(_) => Proof::VerifiedAB,
            None => Proof::Missing,
        };
        let failure_cleanup = match report.failure_cleanup() {
            None => match proof {
                Proof::VerifiedAB => Cleanup::NotRequiredVerifiedByProof,
                Proof::Missing => Cleanup::Unknown,
            },
            Some(Err(_)) => Cleanup::Unknown,
            Some(Ok(report)) => match report.cleanup {
                failure_cleanup::Status::Succeeded => Cleanup::Succeeded,
                failure_cleanup::Status::Failed(_) => Cleanup::Failed,
                failure_cleanup::Status::Unknown(_) => Cleanup::Unknown,
            },
        };
        let lifecycle_failure_cause = report.lifecycle().err().map(|f| f.cause.into());
        let cleanup_failure_fact = match report.failure_cleanup() {
            Some(Ok(r)) => match r.cleanup {
                failure_cleanup::Status::Failed(f) | failure_cleanup::Status::Unknown(f) => {
                    Some(f.into())
                }
                failure_cleanup::Status::Succeeded => None,
            },
            Some(Err(_)) | None => None,
        };
        let cleanup_admission_error = match report.failure_cleanup() {
            Some(Err(error)) => Some((*error).into()),
            Some(Ok(r)) => r.admission.map(Into::into),
            None => None,
        };
        Self {
            gate: GateStatus::Passed,
            lifecycle,
            failure_cleanup,
            proof,
            lifecycle_failure_cause,
            cleanup_failure_fact,
            cleanup_admission_error,
            binding: Some(attempt.binding().clone()),
            provenance: PhantomData,
        }
    }
    /// A caught panic is never evidence that resource cleanup completed.
    pub fn panic_unknown(attempt: &Attempt) -> Self {
        Self {
            gate: GateStatus::Passed,
            lifecycle: Lifecycle::Panic,
            failure_cleanup: Cleanup::Unknown,
            proof: Proof::Missing,
            lifecycle_failure_cause: None,
            cleanup_failure_fact: None,
            cleanup_admission_error: None,
            binding: Some(attempt.binding().clone()),
            provenance: PhantomData,
        }
    }
    pub fn mark_panic(mut self) -> Self {
        self.lifecycle = Lifecycle::Panic;
        self
    }
    pub(super) fn matches(&self, attempt: &Attempt) -> bool
    where
        P: super::evidence::Provenance,
    {
        match self.binding.as_ref() {
            Some(binding) => *binding == *attempt.binding(),
            None => self.gate == GateStatus::Blocked || P::NAME == "SYNTHETIC_ONLY",
        }
    }
    pub const fn lifecycle(&self) -> Lifecycle {
        self.lifecycle
    }
    pub const fn cleanup(&self) -> Cleanup {
        self.failure_cleanup
    }
    pub const fn proof(&self) -> Proof {
        self.proof
    }
    pub const fn gate(&self) -> GateStatus {
        self.gate
    }
    pub fn exit_code(&self, evidence: Delivery, stdout: Delivery, stderr: Delivery) -> u8 {
        if matches!(self.failure_cleanup, Cleanup::Failed | Cleanup::Unknown) {
            return 5;
        }
        if self.lifecycle == Lifecycle::Panic {
            return 4;
        }
        if [evidence, stdout, stderr].contains(&Delivery::Failed) {
            return 6;
        }
        if self.gate == GateStatus::Blocked {
            return 2;
        }
        match self.lifecycle {
            Lifecycle::Panic => 4,
            Lifecycle::Failed(_) | Lifecycle::NotObserved => 3,
            Lifecycle::Succeeded => {
                if self.proof != Proof::VerifiedAB {
                    return 3;
                }
                if [evidence, stdout, stderr]
                    .iter()
                    .all(|s| *s == Delivery::Succeeded)
                {
                    0
                } else {
                    6
                }
            }
        }
    }
}
#[cfg(test)]
impl RunResult<crate::native_contract::ownership_receipt::Synthetic> {
    pub(super) const fn synthetic(
        lifecycle: Lifecycle,
        failure_cleanup: Cleanup,
        proof: Proof,
    ) -> Self {
        Self {
            gate: GateStatus::Passed,
            lifecycle,
            failure_cleanup,
            proof,
            lifecycle_failure_cause: None,
            cleanup_failure_fact: None,
            cleanup_admission_error: None,
            binding: None,
            provenance: PhantomData,
        }
    }
}
#[path = "integrated_result_delivery.rs"]
pub mod delivery;
#[cfg(test)]
#[path = "integrated_result_tests.rs"]
mod tests;
