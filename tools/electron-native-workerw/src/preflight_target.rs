use super::*;
use crate::{legacy::test_window::DestroyedTestWindow, ownership::Resource};
impl PreflightSession {
    /// Consumes the session; release is limited to independently destroyed own test window/lease.
    /// Host process remains owned. This is not a live attachment cleanup receipt.
    pub(crate) fn settle_test_target(mut self, proof: DestroyedTestWindow) -> bool {
        self.cancel();
        if !proof.matches(&self.binding) {
            self.quarantine();
            return false;
        }
        let window = self
            .ledger
            .release(self.attempt, Resource::Window, self.binding.surface)
            .is_ok();
        let lease = self.lease.release(self.attempt).is_ok();
        window && lease && !self.unknown
    }
}
