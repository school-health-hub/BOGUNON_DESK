use super::NativeBackend;
use crate::native_contract::{
    creator_thread_host::Error, final_drain_contract::verify_final_drain,
    ownership_receipt::Native, CleanupProof, Kind, Outcome, Request, Response,
};
impl NativeBackend {
    fn proof_after_drain(
        &mut self,
        request: &Request,
        budget: usize,
    ) -> Result<CleanupProof<Native>, Error> {
        if self.stopped || self.faulted || self.cleanup_issued || self.proof_issued {
            return Err(Error::Unknown);
        }
        let finalization = self.finalization.take().ok_or(Error::Protocol)?;
        if finalization.request() != request || request.kind() != Kind::VerifyOwnSurfaceCleanup {
            return Err(Error::Protocol);
        }
        let drained = self
            .owner
            .as_mut()
            .ok_or(Error::Unknown)?
            .final_drain(&finalization, budget)
            .map_err(|_| Error::Callback)?;
        verify_final_drain(finalization, drained).map_err(|_| Error::Protocol)
    }
    pub(super) fn finish_cleanup(&mut self, request: &Request, budget: usize) -> Response<Native> {
        let outcome = match self.proof_after_drain(request, budget) {
            Ok(proof) => {
                self.proof_issued = true;
                Outcome::CleanupVerified(proof)
            }
            Err(_) => {
                self.faulted = true;
                Outcome::NativeOutcomeUnknown
            }
        };
        Response {
            request: request.clone(),
            outcome,
        }
    }
}
