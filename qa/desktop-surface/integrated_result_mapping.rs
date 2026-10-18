//! Private conversion of an admitted existing Driver report.
use super::*;
impl<P> RunResult<P> {
    pub(in crate::integrated_runner) fn from_driver(
        attempt: &Attempt,
        report: &DriverReport<P>,
    ) -> Self {
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
            panic_observed: false,
            lifecycle_failure_cause,
            cleanup_failure_fact,
            cleanup_admission_error,
            binding: Some(attempt.binding().clone()),
            provenance: PhantomData,
        }
    }
}
