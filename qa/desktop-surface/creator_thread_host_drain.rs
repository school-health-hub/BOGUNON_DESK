use super::*;
impl<B: Backend> Host<B> {
    pub(super) fn complete_after_drain(
        &mut self,
        budget: usize,
        delivered: usize,
    ) -> Result<(), Error> {
        let Some(response) = self.pending.as_ref() else {
            return Ok(());
        };
        if !matches!(response.outcome, Outcome::CleanupPending) {
            return Ok(());
        }
        if delivered != 0 {
            return self.fault(Error::Callback);
        }
        let request = response.request.clone();
        // Finalization is retained by the backend; only this later, successful pump can finish it.
        self.entered = true;
        let completed = self.backend.complete_cleanup(&request, budget);
        self.entered = false;
        if completed.request != request {
            return self.fault(Error::Protocol);
        }
        let proof = match &completed.outcome {
            Outcome::CleanupVerified(proof) => proof.clone(),
            Outcome::CreateSucceeded(_)
            | Outcome::CreateFailed
            | Outcome::CloseStarted
            | Outcome::CloseCompleted
            | Outcome::SurfaceLost
            | Outcome::CleanupPending
            | Outcome::CleanupFailed
            | Outcome::NativeOutcomeUnknown => return self.fault(Error::Unknown),
        };
        if self.adapter.respond(completed).is_err() {
            return self.fault(Error::Protocol);
        }
        self.pending = None;
        self.bridge.retire();
        self.completion = Some(proof);
        Ok(())
    }
}
