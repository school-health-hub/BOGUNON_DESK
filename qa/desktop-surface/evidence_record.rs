use crate::{evidence_schema, observation::topology_evidence::Trace};
use crate::{
    observation::QueryError,
    observation_reader::evidence::{Evidence, Failure},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Check {
    NotObserved,
    Passed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    #[serde(deserialize_with = "evidence_schema::version::<_, 2>")]
    schema_version: u8,
    #[serde(deserialize_with = "evidence_schema::required")]
    pub collection: Option<Evidence>,
    pub post_collection_check: Check,
    pub own_window_check: Check,
    #[serde(deserialize_with = "evidence_schema::required")]
    pub final_query_error: Option<Failure>,
    #[serde(deserialize_with = "evidence_schema::topology")]
    pub topology: Trace,
}
impl Default for Record {
    fn default() -> Self {
        Self {
            schema_version: 2,
            collection: None,
            post_collection_check: Check::NotObserved,
            own_window_check: Check::NotObserved,
            final_query_error: None,
            topology: Trace::default(),
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
