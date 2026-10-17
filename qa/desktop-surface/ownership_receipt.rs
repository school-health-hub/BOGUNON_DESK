use crate::surface_event_types::Binding;
use std::{marker::PhantomData, sync::Arc};
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Synthetic {}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Native {}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceOwnership {
    Owned,
    Partial,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LedgerToken(u32);
impl LedgerToken {
    pub(super) const fn synthetic(value: u32) -> Self {
        Self(value)
    }
    pub(super) const fn value(self) -> u32 {
        self.0
    }
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Creation {
    pub binding: Binding,
    pub token: LedgerToken,
    pub creator_thread: u32,
    pub class: u32,
    pub pid: u32,
    pub tid: u32,
    pub ownership: ResourceOwnership,
}
/// Immutable creation facts; synthetic values never attest OS observations.
#[derive(Debug, Clone)]
pub struct OwnerReceipt<P = Synthetic> {
    identity: Arc<()>,
    creation: Creation,
    provenance: PhantomData<P>,
}
impl<P> PartialEq for OwnerReceipt<P> {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.identity, &other.identity) && self.creation == other.creation
    }
}
impl<P> Eq for OwnerReceipt<P> {}
impl<P> OwnerReceipt<P> {
    pub const fn creation(&self) -> &Creation {
        &self.creation
    }
}
impl OwnerReceipt<Synthetic> {
    pub(super) fn synthetic(creation: Creation) -> Self {
        Self {
            identity: Arc::new(()),
            creation,
            provenance: PhantomData,
        }
    }
}

#[cfg(all(windows, not(test)))]
impl LedgerToken {
    pub(super) const fn native(value: u32) -> Self {
        Self(value)
    }
}
#[cfg(all(windows, not(test)))]
impl OwnerReceipt<Native> {
    pub(super) fn observed(value: super::native_owner::Created) -> Self {
        Self {
            identity: Arc::new(()),
            creation: value.facts(),
            provenance: PhantomData,
        }
    }
}
