use crate::{cleanup, udf, windows_host::HostError};
use serde::Serialize;
use std::path::Path;
use thiserror::Error;
#[derive(Debug, Error)]
pub enum RuntimeQaError {
    #[error("native host operation failed")]
    Host(#[from] HostError),
    #[error("runtime cancelled")]
    Cancelled,
    #[error("runtime stage timed out")]
    Timeout,
    #[error("UDF verification failed: {0}")]
    Udf(#[from] udf::UdfError),
    #[error("cleanup receipt was not issued: {0:?}")]
    Cleanup(cleanup::CleanupUnknown),
    #[error("diagnostic write failed")]
    Io(#[from] std::io::Error),
    #[error("diagnostic serialization failed")]
    Json(#[from] serde_json::Error),
    #[error("runtime binding or process identity did not match")]
    Identity,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct UdfEvidence<'a> {
    pub(super) schema: u8,
    pub(super) requested_under_runner_temp: bool,
    pub(super) effective_matches_requested: bool,
    pub(super) profile_under_effective_udf: bool,
    pub(super) directory_identity_matches: bool,
    pub(super) runtime_version: &'a str,
    pub(super) contains_sensitive_data: bool,
}

pub struct RuntimeCase<'a> {
    pub udf: &'a Path,
    pub diagnostics: &'a Path,
    pub generation: u64,
    pub run_nonce: u64,
    pub runtime_version: &'a str,
    pub control: &'a crate::runtime_budget::RuntimeControl<'a>,
}
