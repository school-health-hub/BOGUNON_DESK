use super::{Error, OwnerReceipt};
use crate::{own_coordinator::NoticeKind, surface_event_types::Binding};
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    OwnWndProc,
}
/// Constructed only by the sealed backend after retrieving its own bounded notices.
#[derive(Debug, Clone)]
pub struct Envelope<P> {
    pub(super) owner: OwnerReceipt<P>,
    pub(super) binding: Binding,
    pub(super) sequence: u64,
    pub(super) source: Source,
    pub(super) kind: NoticeKind,
}
pub(super) struct Bridge<P> {
    owner: Option<OwnerReceipt<P>>,
    sequence: u64,
    retired: bool,
}
impl<P: PartialEq> Bridge<P> {
    pub const fn new() -> Self {
        Self {
            owner: None,
            sequence: 0,
            retired: true,
        }
    }
    pub fn activate(&mut self, owner: OwnerReceipt<P>) -> Result<(), Error> {
        if !self.retired {
            return Err(Error::Callback);
        }
        self.owner = Some(owner);
        self.sequence = 0;
        self.retired = false;
        Ok(())
    }
    pub fn retire(&mut self) {
        self.retired = true;
    }
    pub fn origin(&self) -> Option<&Binding> {
        self.owner.as_ref().map(|owner| &owner.creation().binding)
    }
    pub fn validate(&mut self, notice: &Envelope<P>) -> Result<(), Error> {
        if self.retired
            || self.owner.as_ref() != Some(&notice.owner)
            || self.sequence.checked_add(1) != Some(notice.sequence)
            || notice.source != Source::OwnWndProc
        {
            return Err(Error::Callback);
        }
        let origin = self.origin().ok_or(Error::Callback)?;
        if notice.binding.instance() != origin.instance()
            || notice.binding.operation().generation() != origin.operation().generation()
        {
            return Err(Error::Callback);
        }
        self.sequence = notice.sequence;
        Ok(())
    }
}
