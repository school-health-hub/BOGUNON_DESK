//! A private destination slot: replacement and revocation invalidate every old lease.
pub(super) struct ChannelState<T> {
    next: u64,
    transfer: u64,
    active: Option<(u64, T)>,
}
impl<T> Default for ChannelState<T> {
    fn default() -> Self {
        Self {
            next: 0,
            transfer: 0,
            active: None,
        }
    }
}
impl<T> ChannelState<T> {
    pub(super) fn register(&mut self, channel: T) -> Result<u64, ()> {
        self.invalidate();
        if self.next >= 9_007_199_254_740_991 {
            return Err(());
        }
        self.next += 1;
        self.active = Some((self.next, channel));
        Ok(self.next)
    }
    pub(super) fn snapshot(&self) -> Option<u64> {
        self.active.as_ref().map(|(epoch, _)| *epoch)
    }
    pub(super) fn matches(&self, epoch: Option<u64>) -> bool {
        epoch.is_some() && epoch == self.snapshot()
    }
    pub(super) fn invalidate(&mut self) {
        self.active = None;
    }
    pub(super) fn unregister(&mut self, epoch: u64) {
        if self.matches(Some(epoch)) {
            self.invalidate();
        }
    }
    pub(super) fn deliver(
        &mut self,
        epoch: Option<u64>,
        send: impl FnOnce(&T, u64) -> Result<(), ()>,
    ) -> Result<(), ()> {
        if !self.matches(epoch) {
            return Err(());
        }
        if self.transfer >= 9_007_199_254_740_991 {
            self.invalidate();
            return Err(());
        }
        self.transfer += 1;
        let result = self
            .active
            .as_ref()
            .ok_or(())
            .and_then(|(_, channel)| send(channel, self.transfer));
        if result.is_err() {
            self.invalidate();
        }
        result
    }
}
#[cfg(test)]
#[path = "main_channel_state_tests.rs"]
mod tests;
