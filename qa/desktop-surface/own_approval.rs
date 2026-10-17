use crate::{evidence_approval::absolute_disk_path, own_result::Error};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub const SCOPE: &str = "9B2O_OWN_WINDOWS_NO_SHELL";
pub const EVIDENCE_SCOPE: &str = "9B2O_OWN_WINDOW_EVIDENCE_V1";
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    source_sha: String,
    executable_path: PathBuf,
    sha256: String,
    scope: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Descriptor {
    runtime_manifest_sha256: String,
    evidence_path: PathBuf,
    staging_path: PathBuf,
    run_claim_path: PathBuf,
    scope: String,
}
pub struct Actual<'a> {
    pub executable: &'a Path,
    pub artifact_sha: &'a str,
    pub source_sha: &'a str,
    pub descriptor: &'a Path,
}
pub struct Paths {
    pub output: PathBuf,
    pub staging: PathBuf,
    pub claim: PathBuf,
}
pub fn parse(runtime: &[u8], descriptor: &[u8], actual: Actual<'_>) -> Result<Paths, Error> {
    if runtime.len() > 8192 || descriptor.len() > 8192 {
        return Err(Error::Gate);
    }
    let manifest: Manifest = serde_json::from_slice(runtime).map_err(|_| Error::Gate)?;
    let descriptor: Descriptor = serde_json::from_slice(descriptor).map_err(|_| Error::Gate)?;
    for path in [
        &manifest.executable_path,
        actual.executable,
        actual.descriptor,
    ] {
        absolute_disk_path(path).map_err(|()| Error::Gate)?;
    }
    if manifest.scope != SCOPE
        || manifest.executable_path != actual.executable
        || !hex(&manifest.sha256, 64)
        || !manifest.sha256.eq_ignore_ascii_case(actual.artifact_sha)
        || !hex(&manifest.source_sha, 40)
        || manifest.source_sha != actual.source_sha
        || descriptor.scope != EVIDENCE_SCOPE
        || !descriptor
            .runtime_manifest_sha256
            .eq_ignore_ascii_case(&format!("{:x}", Sha256::digest(runtime)))
    {
        return Err(Error::Gate);
    }
    for (path, name) in [
        (&descriptor.evidence_path, "own-evidence.json"),
        (&descriptor.staging_path, "own-evidence.staging.json"),
        (&descriptor.run_claim_path, "own-run.claim"),
    ] {
        absolute_disk_path(path).map_err(|()| Error::Gate)?;
        if path.parent() != actual.descriptor.parent()
            || path.file_name() != Some(std::ffi::OsStr::new(name))
        {
            return Err(Error::Gate);
        }
    }
    Ok(Paths {
        output: descriptor.evidence_path,
        staging: descriptor.staging_path,
        claim: descriptor.run_claim_path,
    })
}
fn hex(value: &str, size: usize) -> bool {
    value.len() == size && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}
