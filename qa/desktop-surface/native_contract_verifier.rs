use super::{CleanupProof, Kind, Request};
use crate::{own_callbacks::Ledger, surface_event_types::Binding};
use std::sync::Arc;
/// Synthetic owner identity: retained across ledger retirement; never a native credential.
#[derive(Debug, Clone)]
pub struct OwnerReceipt(Arc<()>);
impl PartialEq for OwnerReceipt {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}
impl Eq for OwnerReceipt {}
impl OwnerReceipt {
    fn fresh() -> Self {
        Self(Arc::new(()))
    }
}
#[derive(Debug, Clone)]
struct Ownership {
    pub owner: OwnerReceipt,
    pub binding: Binding,
    pub token: u32,
    pub creator_thread: u32,
    pub class: u32,
    pub pid: u32,
    pub tid: u32,
}
#[derive(Debug, Clone)]
struct Observations {
    pub identity: Ownership,
    pub current_thread: u32,
    pub destroyed: bool,
    pub remaining: Option<u32>,
    pub owner_released: bool,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VerifyError {
    Request,
    OwnerReceipt,
    Thread,
    Ledger,
    Destroy,
    Remaining,
    Release,
}
/// This checks model observations only. A future native verifier must independently gather facts.
fn verify(
    request: &Request,
    retained: &Ownership,
    ledger: &Ledger,
    observed: &Observations,
) -> Result<CleanupProof, VerifyError> {
    if request.kind != Kind::VerifyOwnSurfaceCleanup || request.binding != retained.binding {
        return Err(VerifyError::Request);
    }
    let actual = &observed.identity;
    if !Arc::ptr_eq(&retained.owner.0, &actual.owner.0)
        || actual.binding != retained.binding
        || actual.token != retained.token
        || actual.class != retained.class
        || actual.pid != retained.pid
        || actual.tid != retained.tid
    {
        return Err(VerifyError::OwnerReceipt);
    }
    if observed.current_thread != retained.creator_thread
        || actual.creator_thread != retained.creator_thread
    {
        return Err(VerifyError::Thread);
    }
    if ledger.live.is_some() {
        return Err(VerifyError::Ledger);
    }
    if !observed.destroyed {
        return Err(VerifyError::Destroy);
    }
    if observed.remaining != Some(0) {
        return Err(VerifyError::Remaining);
    }
    if !observed.owner_released {
        return Err(VerifyError::Release);
    }
    Ok(CleanupProof {
        request: request.clone(),
        owner: retained.owner.clone(),
    })
}

#[path = "native_contract_fake.rs"]
pub mod fake;
