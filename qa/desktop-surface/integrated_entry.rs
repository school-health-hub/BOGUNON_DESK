//! Explicit artifact loading and separate operator assertion; no Native calls.
use crate::integrated_runner::{approval, gate, OPT_IN_VALUE, RUNNER_ID, SCOPE};
use serde::Deserialize;
use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
use std::{
    ffi::OsString,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryError {
    OptIn,
    Arguments,
    Source,
    Artifact,
    Approval,
    Path,
}
pub struct Arguments {
    manifest: PathBuf,
    descriptor: PathBuf,
    binding: PathBuf,
    operator_record: PathBuf,
    reviewed_record_sha: String,
}
pub fn arguments(
    opt_in: Option<&str>,
    read: impl FnOnce() -> Vec<OsString>,
) -> Result<Arguments, EntryError> {
    if opt_in != Some(OPT_IN_VALUE) {
        return Err(EntryError::OptIn);
    }
    let values = read();
    if values.len() != 10 {
        return Err(EntryError::Arguments);
    }
    let expected = [
        "--manifest",
        "--descriptor",
        "--approval-binding",
        "--operator-record",
        "--reviewed-record-sha",
    ];
    for (pair, name) in values.chunks_exact(2).zip(expected) {
        if pair[0] != name {
            return Err(EntryError::Arguments);
        }
    }
    let reviewed_record_sha = values[9].to_str().ok_or(EntryError::Arguments)?.to_owned();
    if !digest_shape(&reviewed_record_sha) {
        return Err(EntryError::Arguments);
    }
    Ok(Arguments {
        manifest: PathBuf::from(&values[1]),
        descriptor: PathBuf::from(&values[3]),
        binding: PathBuf::from(&values[5]),
        operator_record: PathBuf::from(&values[7]),
        reviewed_record_sha,
    })
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OperatorRecord {
    decision: Decision,
    runner_id: String,
    scope: String,
    approval_binding_sha256: String,
    approved_at_unix_seconds: u64,
    operator_reference: String,
}
#[derive(Deserialize)]
enum Decision {
    #[serde(rename = "APPROVE")]
    Approve,
}
fn validate_operator(bytes: &[u8], pin: &str, binding: &[u8]) -> Result<(), EntryError> {
    if approval::digest(bytes) != pin {
        return Err(EntryError::Approval);
    }
    let record: OperatorRecord = serde_json::from_slice(bytes).map_err(|_| EntryError::Approval)?;
    let Decision::Approve = record.decision;
    if record.runner_id != RUNNER_ID
        || record.scope != SCOPE
        || record.approval_binding_sha256 != approval::digest(binding)
        || record.approved_at_unix_seconds == 0
        || record.operator_reference.trim().is_empty()
        || record.operator_reference.len() > 128
        || record.operator_reference.chars().any(char::is_control)
    {
        return Err(EntryError::Approval);
    }
    Ok(())
}
fn digest_shape(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub struct Loaded {
    args: Arguments,
    executable_path: PathBuf,
    executable: Vec<u8>,
    manifest: Vec<u8>,
    descriptor: Vec<u8>,
    binding: Vec<u8>,
    binding_sha: String,
    source: &'static str,
    _guards: Vec<File>,
}
impl Loaded {
    pub fn load(args: Arguments) -> Result<Self, EntryError> {
        let source = crate::integrated_source::validate(crate::integrated_source::SOURCE_SHA)
            .map_err(|()| EntryError::Source)?;
        let executable_path = std::env::current_exe().map_err(|_| EntryError::Artifact)?;
        Self::load_checked(args, source, executable_path)
    }
    fn load_checked(
        args: Arguments,
        source: &'static str,
        executable_path: PathBuf,
    ) -> Result<Self, EntryError> {
        let mut guards = Vec::new();
        let executable = locked(&executable_path, 64 * 1024 * 1024, &mut guards)?;
        let manifest = locked(&args.manifest, 8192, &mut guards)?;
        let descriptor = locked(&args.descriptor, 8192, &mut guards)?;
        let binding = locked(&args.binding, 8192, &mut guards)?;
        let operator = locked(&args.operator_record, 8192, &mut guards)?;
        validate_operator(&operator, &args.reviewed_record_sha, &binding)?;
        let binding_sha = approval::digest(&binding);
        Ok(Self {
            args,
            executable_path,
            executable,
            manifest,
            descriptor,
            binding,
            binding_sha,
            source,
            _guards: guards,
        })
    }
    /// Record facts are asserted externally, not authenticated as a human signature.
    pub fn input(&self) -> gate::Input<'_> {
        gate::Input {
            executable: &self.executable,
            manifest: &self.manifest,
            descriptor: &self.descriptor,
            approval_record: &self.binding,
            executable_path: &self.executable_path,
            manifest_path: &self.args.manifest,
            descriptor_path: &self.args.descriptor,
            approval_path: &self.args.binding,
            source_head: self.source,
            source_sha: self.source,
            opt_in: Some(OPT_IN_VALUE),
            operator_review: approval::OperatorReview::VerifiedRecord {
                record_sha256: &self.binding_sha,
            },
        }
    }
}
fn locked(path: &Path, limit: u64, guards: &mut Vec<File>) -> Result<Vec<u8>, EntryError> {
    guards.extend(crate::evidence_paths::lock_directories(path).map_err(|()| EntryError::Path)?);
    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(path)
        .map_err(|_| EntryError::Path)?;
    let metadata = file.metadata().map_err(|_| EntryError::Path)?;
    crate::evidence_paths::ordinary_attributes(metadata.file_attributes())
        .map_err(|()| EntryError::Path)?;
    if !metadata.is_file() || metadata.len() > limit {
        return Err(EntryError::Path);
    }
    let mut bytes = Vec::new();
    (&mut file)
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| EntryError::Path)?;
    if u64::try_from(bytes.len()).map_err(|_| EntryError::Path)? > limit {
        return Err(EntryError::Path);
    }
    guards.push(file);
    Ok(bytes)
}
#[cfg(test)]
#[path = "integrated_entry_tests.rs"]
mod tests;
