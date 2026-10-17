//! Cleanup observations never grant lifecycle success or produce CleanupProof.
use super::ownership_finalization::Confirmation;
use std::marker::PhantomData;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Resources {
    NoResourcesConfirmed,
    Owned,
    Partial,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Thread,
    Owner,
    Token,
    Duplicate,
    Reentry,
    Unknown,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fact {
    CreatorThread,
    OwnerIdentity,
    LedgerToken,
    Destroy,
    Ledger,
    Residual,
    ClassRelease,
    CallbackClear,
    OwnerRelease,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Succeeded,
    Failed(Fact),
    Unknown(Fact),
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Facts {
    pub creator_thread: Confirmation,
    pub owner_identity: Confirmation,
    pub ledger_token: Confirmation,
    pub destroy: Confirmation,
    pub ledger: Confirmation,
    pub residual: Option<u32>,
    pub class_release: Confirmation,
    pub callback_clear: Confirmation,
    pub owner_release: Confirmation,
}
#[derive(Debug, PartialEq, Eq)]
pub struct Observation<P> {
    pub resources: Resources,
    pub facts: Facts,
    provenance: PhantomData<P>,
}
impl<P> Observation<P> {
    pub(in crate::native_contract) const fn unknown() -> Self {
        Self::new(
            Resources::Unknown,
            Facts {
                creator_thread: Confirmation::Unknown,
                owner_identity: Confirmation::Unknown,
                ledger_token: Confirmation::Unknown,
                destroy: Confirmation::Unknown,
                ledger: Confirmation::Unknown,
                residual: None,
                class_release: Confirmation::Unknown,
                callback_clear: Confirmation::Unknown,
                owner_release: Confirmation::Unknown,
            },
        )
    }
    pub(in crate::native_contract) const fn new(resources: Resources, facts: Facts) -> Self {
        Self {
            resources,
            facts,
            provenance: PhantomData,
        }
    }
    pub fn status(&self) -> Status {
        let facts = [
            (Fact::CreatorThread, self.facts.creator_thread),
            (Fact::OwnerIdentity, self.facts.owner_identity),
            (Fact::LedgerToken, self.facts.ledger_token),
            (Fact::Destroy, self.facts.destroy),
            (Fact::Ledger, self.facts.ledger),
            (
                Fact::Residual,
                match self.facts.residual {
                    Some(0) => Confirmation::Confirmed,
                    Some(_) => Confirmation::Failed,
                    None => Confirmation::Unknown,
                },
            ),
            (Fact::ClassRelease, self.facts.class_release),
            (Fact::CallbackClear, self.facts.callback_clear),
            (Fact::OwnerRelease, self.facts.owner_release),
        ];
        // A definite failure takes precedence over an earlier incomplete observation.
        for (fact, value) in facts {
            if value == Confirmation::Failed {
                return Status::Failed(fact);
            }
        }
        for (fact, value) in facts {
            if value == Confirmation::Unknown {
                return Status::Unknown(fact);
            }
        }
        Status::Succeeded
    }
}

/// No owned handle is not proof of absence after a Native create attempt.
pub(in crate::native_contract) const fn destroy_or_absence(
    create_attempted: bool,
    destruction_recorded: bool,
) -> Confirmation {
    if destruction_recorded || !create_attempted {
        Confirmation::Confirmed
    } else {
        Confirmation::Unknown
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn attempted_create_without_destruction_stays_unknown() {
        // Given attempted creation without recorded destruction; When classified; Then absence stays unknown.
        assert_eq!(destroy_or_absence(true, false), Confirmation::Unknown);
    }
    #[test]
    fn recorded_destruction_is_confirmed() {
        // Given a recorded destruction; When classified; Then the destruction observation is confirmed.
        assert_eq!(destroy_or_absence(true, true), Confirmation::Confirmed);
    }
    #[test]
    fn no_creation_attempt_confirms_scoped_absence() {
        // Given creation never attempted; When classified; Then scoped pre-create absence is confirmed.
        assert_eq!(destroy_or_absence(false, false), Confirmation::Confirmed);
    }
}
