use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectDocument {
    pub(crate) schema_version: u64,
    pub(crate) project_id: String,
    pub(crate) project_revision: u64,
    #[serde(flatten)]
    pub(crate) fields: Map<String, Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloneProvenance {
    pub(crate) source_project_id: String,
    pub(crate) source_revision: u64,
}
