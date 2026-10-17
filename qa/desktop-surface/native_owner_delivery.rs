use super::{capture::Captured, context, Failure, Owner};
impl Owner {
    pub(in crate::native_contract) fn drain_captured(&mut self) -> Result<Vec<Captured>, Failure> {
        let notices = self.drain()?;
        context::capture(|capture| capture.drain(notices))
    }
}
impl Owner {
    pub(in crate::native_contract) fn released_quiet(&self) -> Result<(), Failure> {
        self.same_thread()?;
        context::healthy()?;
        if !self.released
            || context::ACTIVE.get()
            || context::TOKEN.get() != 0
            || context::HANDLE.get().is_some()
            || !context::GATE.with(|gate| gate.idle())
            || !context::capture(|capture| Ok(capture.empty()))?
        {
            return Err(Failure::CallbackContext);
        }
        Ok(())
    }
}
