use super::owner_policy::Failure;
use std::cell::Cell;
/// Shared bounded callback reentry latch; no OS observation or proof issuance.
pub struct CallbackGate(Cell<bool>);
pub struct Entry<'a>(&'a CallbackGate);
impl CallbackGate {
    pub const fn new() -> Self {
        Self(Cell::new(false))
    }
    pub fn enter(&self) -> Result<Entry<'_>, Failure> {
        if self.0.replace(true) {
            return Err(Failure::Reentry);
        }
        Ok(Entry(self))
    }
    pub fn idle(&self) -> bool {
        !self.0.get()
    }
}
impl Drop for Entry<'_> {
    fn drop(&mut self) {
        self.0 .0.set(false);
    }
}
