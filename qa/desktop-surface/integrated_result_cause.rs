//! Closed sanitized diagnostic names, never Native handles or callback payloads.
use crate::native_contract::{creator_thread_host::Error, failure_cleanup};
use serde::Serialize;
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Cause {
    Thread,
    Reentry,
    Protocol,
    Callback,
    Overflow,
    Budget,
    PumpStop,
    Unknown,
}
impl From<Error> for Cause {
    fn from(value: Error) -> Self {
        match value {
            Error::Thread => Self::Thread,
            Error::Reentry => Self::Reentry,
            Error::Protocol => Self::Protocol,
            Error::Callback => Self::Callback,
            Error::Overflow => Self::Overflow,
            Error::Budget => Self::Budget,
            Error::PumpStop => Self::PumpStop,
            Error::Unknown => Self::Unknown,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CleanupFact {
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
impl From<failure_cleanup::Fact> for CleanupFact {
    fn from(value: failure_cleanup::Fact) -> Self {
        match value {
            failure_cleanup::Fact::CreatorThread => Self::CreatorThread,
            failure_cleanup::Fact::OwnerIdentity => Self::OwnerIdentity,
            failure_cleanup::Fact::LedgerToken => Self::LedgerToken,
            failure_cleanup::Fact::Destroy => Self::Destroy,
            failure_cleanup::Fact::Ledger => Self::Ledger,
            failure_cleanup::Fact::Residual => Self::Residual,
            failure_cleanup::Fact::ClassRelease => Self::ClassRelease,
            failure_cleanup::Fact::CallbackClear => Self::CallbackClear,
            failure_cleanup::Fact::OwnerRelease => Self::OwnerRelease,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CleanupAdmission {
    Thread,
    Owner,
    Token,
    Duplicate,
    Reentry,
    Unknown,
}
impl From<failure_cleanup::Error> for CleanupAdmission {
    fn from(value: failure_cleanup::Error) -> Self {
        match value {
            failure_cleanup::Error::Thread => Self::Thread,
            failure_cleanup::Error::Owner => Self::Owner,
            failure_cleanup::Error::Token => Self::Token,
            failure_cleanup::Error::Duplicate => Self::Duplicate,
            failure_cleanup::Error::Reentry => Self::Reentry,
            failure_cleanup::Error::Unknown => Self::Unknown,
        }
    }
}
