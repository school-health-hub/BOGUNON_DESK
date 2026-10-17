use crate::{
    observation::QueryError,
    observation_reader::evidence::{Evidence, Failure},
};
use serde::Serialize;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Check {
    NotObserved,
    Passed,
    Failed,
}

#[derive(Serialize)]
pub struct Record {
    schema_version: u8,
    pub collection: Option<Evidence>,
    pub post_collection_check: Check,
    pub own_window_check: Check,
    pub final_query_error: Option<Failure>,
}
impl Default for Record {
    fn default() -> Self {
        Self {
            schema_version: 1,
            collection: None,
            post_collection_check: Check::NotObserved,
            own_window_check: Check::NotObserved,
            final_query_error: None,
        }
    }
}
impl Record {
    pub fn query_error(&mut self, error: &QueryError) {
        self.final_query_error = Some(match error {
            QueryError::Api(..) => Failure::Api,
            QueryError::Hresult(..) => Failure::Hresult,
            QueryError::InvalidValue(..) => Failure::InvalidValue,
            QueryError::IdentityChanged => Failure::IdentityChanged,
            QueryError::ShellIdentity => Failure::ShellIdentity,
            QueryError::TopologyChanged => Failure::TopologyChanged,
            QueryError::NoEligibleWorker => Failure::NoEligibleWorker,
            QueryError::AmbiguousWorker => Failure::AmbiguousWorker,
            QueryError::DpiMismatch => Failure::DpiMismatch,
        });
    }
}
