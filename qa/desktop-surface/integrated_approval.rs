use super::{EVIDENCE_NAMESPACE, RUNNER_ID, SCOPE};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub runner_id: String,
    pub scope: String,
    pub evidence_namespace: String,
    pub executable_sha256: String,
    pub source_head: String,
    pub source_sha: String,
    pub manifest_sha256: String,
    pub descriptor_sha256: String,
    pub executable_path: PathBuf,
    pub manifest_path: PathBuf,
    pub descriptor_path: PathBuf,
    pub approval_path: PathBuf,
    pub evidence_path: PathBuf,
    pub staging_path: PathBuf,
    pub claim_path: PathBuf,
    pub native_api_scope: NativeApiScope,
    pub window_count: u8,
    pub run_count: u8,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub runner_id: String,
    pub scope: String,
    pub executable_sha256: String,
    pub executable_path: PathBuf,
    pub source_head: String,
    pub source_sha: String,
    pub native_api_scope: NativeApiScope,
    pub window_count: u8,
    pub run_count: u8,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Descriptor {
    pub runner_id: String,
    pub evidence_namespace: String,
    pub manifest_sha256: String,
    pub manifest_path: PathBuf,
    pub approval_path: PathBuf,
    pub evidence_path: PathBuf,
    pub staging_path: PathBuf,
    pub claim_path: PathBuf,
}
/// An external reviewer's assertion, not a cryptographic identity or signature.
/// A future approved entrypoint must establish the human authorization separately.
pub enum OperatorReview<'a> {
    NotVerified,
    VerifiedRecord { record_sha256: &'a str },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Format,
    Scope,
    Artifact,
    Source,
    Manifest,
    Descriptor,
    Approval,
    Path,
    OptIn,
    ClaimExists,
    ClaimCreate,
    ClaimSync,
}
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub(super) fn parse<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, Error> {
    if bytes.len() > 16384 {
        return Err(Error::Format);
    }
    serde_json::from_slice(bytes).map_err(|_| Error::Format)
}
pub(super) fn validate(binding: &Binding) -> Result<(), Error> {
    if binding.runner_id != RUNNER_ID
        || binding.scope != SCOPE
        || binding.evidence_namespace != EVIDENCE_NAMESPACE
        || binding.native_api_scope != NativeApiScope::SyncOwnWindowAb
        || binding.window_count != 1
        || binding.run_count != 1
    {
        return Err(Error::Scope);
    }
    for value in [
        &binding.executable_sha256,
        &binding.manifest_sha256,
        &binding.descriptor_sha256,
    ] {
        if !hex(value, 64) {
            return Err(Error::Format);
        }
    }
    if !hex(&binding.source_head, 40)
        || !hex(&binding.source_sha, 40)
        || binding.source_head != binding.source_sha
    {
        return Err(Error::Source);
    }
    let paths = [
        &binding.executable_path,
        &binding.manifest_path,
        &binding.descriptor_path,
        &binding.approval_path,
        &binding.evidence_path,
        &binding.staging_path,
        &binding.claim_path,
    ];
    for (index, path) in paths.iter().enumerate() {
        crate::evidence_approval::absolute_disk_path(path).map_err(|()| Error::Path)?;
        if paths[..index].contains(path) {
            return Err(Error::Path);
        }
    }
    let directory = binding.descriptor_path.parent().ok_or(Error::Path)?;
    for (path, name) in [
        (&binding.evidence_path, "integrated-evidence.json"),
        (&binding.staging_path, "integrated-evidence.staging.json"),
        (&binding.claim_path, "integrated-run.claim"),
    ] {
        if path.parent() != Some(directory) || path.file_name() != Some(std::ffi::OsStr::new(name))
        {
            return Err(Error::Path);
        }
    }
    Ok(())
}
fn hex(value: &str, count: usize) -> bool {
    value.len() == count
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Closed synchronous ownership policy; no HWND/PID arguments or OS message dispatch.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub enum NativeApiScope {
    #[serde(rename = "OWN_CREATE_DESTROY_IDENTITY_LEDGER_FINALIZE_CALLBACK_DRAIN_NO_OS_DISPATCH")]
    SyncOwnWindowAb,
}
