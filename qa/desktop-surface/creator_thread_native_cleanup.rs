use super::{thread, Native, NativeBackend, Rc, ThreadId};
use crate::native_contract::{
    failure_cleanup::{self as cleanup, Facts, Observation, Resources},
    native_owner::FailureCapability,
    ownership_finalization::Confirmation as C,
};
pub struct Capability {
    lease: Rc<()>,
    creator: ThreadId,
    owner: Option<FailureCapability>,
}
impl NativeBackend {
    pub(super) fn issue_failure_cleanup(&mut self) -> Result<Capability, cleanup::Error> {
        if self.creator != thread::current().id() {
            return Err(cleanup::Error::Thread);
        }
        if self.cleanup_issued {
            return Err(cleanup::Error::Duplicate);
        }
        self.cleanup_issued = true;
        let owner = match self.owner.as_mut() {
            Some(owner) => Some(owner.cleanup_capability()?),
            None => None,
        };
        Ok(Capability {
            lease: self.cleanup_lease.clone(),
            creator: self.creator,
            owner,
        })
    }
    pub(super) fn run_failure_cleanup(&mut self, cap: Capability) -> Observation<Native> {
        let mut facts = Facts {
            creator_thread: C::Unknown,
            owner_identity: C::Unknown,
            ledger_token: C::Unknown,
            destroy: C::Unknown,
            ledger: C::Unknown,
            residual: None,
            class_release: C::Unknown,
            callback_clear: C::Unknown,
            owner_release: C::Unknown,
        };
        if self.creator != thread::current().id() || self.creator != cap.creator {
            facts.creator_thread = C::Failed;
            return Observation::new(Resources::Unknown, facts);
        }
        facts.creator_thread = C::Confirmed;
        if !self.cleanup_issued || !Rc::ptr_eq(&cap.lease, &self.cleanup_lease) {
            facts.owner_identity = C::Failed;
            return Observation::new(Resources::Unknown, facts);
        }
        match (self.owner.as_mut(), cap.owner) {
            (Some(owner), Some(capability)) => owner.cleanup_failure(capability),
            (None, None) => {
                // Native creation cannot occur before an Owner is retained by this backend.
                // These are scoped absence facts, not a Windows-wide residual observation.
                Observation::new(
                    Resources::NoResourcesConfirmed,
                    Facts {
                        creator_thread: C::Confirmed,
                        owner_identity: C::Confirmed,
                        ledger_token: C::Confirmed,
                        destroy: C::Confirmed,
                        ledger: C::Confirmed,
                        residual: Some(0),
                        class_release: C::Confirmed,
                        callback_clear: C::Confirmed,
                        owner_release: C::Confirmed,
                    },
                )
            }
            (Some(_), None) | (None, Some(_)) => {
                facts.owner_identity = C::Failed;
                Observation::new(Resources::Unknown, facts)
            }
        }
    }
}
