use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf, Prefix};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Approval {
    runtime_manifest_sha256: String,
    evidence_path: PathBuf,
    staging_path: PathBuf,
    scope: String,
}
pub struct ApprovedPaths {
    pub(super) output: PathBuf,
    pub(super) staging: PathBuf,
}

pub fn absolute_disk_path(path: &Path) -> Result<(), ()> {
    let mut parts = path.components();
    if !matches!(parts.next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_)))
        || !matches!(parts.next(), Some(Component::RootDir))
    {
        return Err(());
    }
    for part in parts {
        let Component::Normal(name) = part else {
            return Err(());
        };
        let text = name.to_str().ok_or(())?;
        if text.contains(':') || text.ends_with(['.', ' ']) || text.is_empty() {
            return Err(());
        }
    }
    // Components normalizes embedded dot segments; reject their raw spelling too.
    if path
        .to_str()
        .ok_or(())?
        .split(['\\', '/'])
        .any(|part| part == "." || part == "..")
    {
        return Err(());
    }
    Ok(())
}

pub fn parse(text: &[u8], runtime: &[u8], descriptor: &Path) -> Result<ApprovedPaths, ()> {
    if text.len() > 8192 {
        return Err(());
    }
    absolute_disk_path(descriptor)?;
    let approval: Approval = serde_json::from_slice(text).map_err(|_| ())?;
    let hash = format!("{:x}", Sha256::digest(runtime));
    if approval.scope != "9B2F_SANITIZED_EVIDENCE_V1"
        || !approval.runtime_manifest_sha256.eq_ignore_ascii_case(&hash)
    {
        return Err(());
    }
    for (path, name) in [
        (&approval.evidence_path, "evidence.json"),
        (&approval.staging_path, "evidence.staging.json"),
    ] {
        absolute_disk_path(path)?;
        if path.parent() != descriptor.parent()
            || path.file_name() != Some(std::ffi::OsStr::new(name))
        {
            return Err(());
        }
    }
    Ok(ApprovedPaths {
        output: approval.evidence_path,
        staging: approval.staging_path,
    })
}
