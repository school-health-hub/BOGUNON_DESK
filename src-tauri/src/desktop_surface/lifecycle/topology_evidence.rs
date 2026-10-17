use super::{QueryError, WindowId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HostKind {
    Progman,
    Workerw,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FollowingSearch {
    Found,
    None,
    Error,
    #[default]
    NotObserved,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EnumerationScope {
    NullParentInitialNullAfterThenPreviousWorker,
    #[default]
    NotObserved,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Trace {
    pub host_kind: HostKind,
    pub following_search: FollowingSearch,
    pub following_tail_count: Option<usize>,
    pub enumeration_scope: EnumerationScope,
}

impl Trace {
    pub fn begin_enumeration(&mut self) {
        self.enumeration_scope = EnumerationScope::NullParentInitialNullAfterThenPreviousWorker;
    }

    pub fn record_host(&mut self, class: &str) {
        self.host_kind = match class {
            "Progman" => HostKind::Progman,
            "WorkerW" => HostKind::Workerw,
            _ => HostKind::Unknown,
        };
    }

    pub fn record_search<T>(&mut self, result: &Result<Option<T>, QueryError>) {
        self.following_search = match result {
            Ok(Some(_)) => FollowingSearch::Found,
            Ok(None) => FollowingSearch::None,
            Err(_) => FollowingSearch::Error,
        };
        self.following_tail_count = None;
    }

    pub fn record_tail(&mut self, result: &Result<&[WindowId], QueryError>) {
        self.following_tail_count = result.as_ref().ok().map(|tail| tail.len());
    }
}
