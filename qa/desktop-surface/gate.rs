use serde::Deserialize;
use std::path::Path;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Approval {
    pub source_sha: String,
    pub executable_path: String,
    pub sha256: String,
    pub scope: String,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateError {
    OptIn,
    Manifest,
    Artifact,
    Source,
    Environment,
}
pub fn opt_in(value: Option<&str>) -> Result<(), GateError> {
    if value == Some("APPROVED_9B2C") {
        Ok(())
    } else {
        Err(GateError::OptIn)
    }
}
pub fn verify(approval: &Approval, actual: (&Path, &str, &str)) -> Result<(), GateError> {
    if approval.scope != "9B2C_READ_ONLY_OWN_WINDOWS"
        || !Path::new(&approval.executable_path).is_absolute()
        || Path::new(&approval.executable_path) != actual.0
        || approval.sha256.len() != 64
        || !approval.sha256.bytes().all(|b| b.is_ascii_hexdigit())
        || !approval.sha256.eq_ignore_ascii_case(actual.1)
    {
        return Err(GateError::Artifact);
    }
    if approval.source_sha.len() != 40
        || !approval.source_sha.bytes().all(|b| b.is_ascii_hexdigit())
        || approval.source_sha != actual.2
    {
        return Err(GateError::Source);
    }
    Ok(())
}

#[cfg(all(feature = "live-windows-skip-miri", not(test)))]
pub struct LivePermit(());
#[cfg(all(feature = "live-windows-skip-miri", not(test)))]
pub fn authorize() -> Result<LivePermit, GateError> {
    use sha2::{Digest, Sha256};
    use std::{fs, io::Read, os::windows::fs::MetadataExt};
    opt_in(std::env::var("BOGUNON_SURFACE_LIVE_OPT_IN").ok().as_deref())?;
    let manifest =
        std::env::var_os("BOGUNON_SURFACE_APPROVED_MANIFEST").ok_or(GateError::Manifest)?;
    let manifest = Path::new(&manifest);
    let executable = std::env::current_exe().map_err(|_| GateError::Artifact)?;
    for path in [manifest, executable.as_path()] {
        if !path.is_absolute() {
            return Err(GateError::Artifact);
        }
        for ancestor in path.ancestors() {
            let metadata = fs::symlink_metadata(ancestor).map_err(|_| GateError::Artifact)?;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(GateError::Artifact);
            }
        }
    }
    let mut input = fs::File::open(manifest).map_err(|_| GateError::Manifest)?;
    let mut text = String::new();
    input
        .by_ref()
        .take(8193)
        .read_to_string(&mut text)
        .map_err(|_| GateError::Manifest)?;
    if text.len() > 8192 {
        return Err(GateError::Manifest);
    }
    let approval: Approval = serde_json::from_str(&text).map_err(|_| GateError::Manifest)?;
    let mut binary = fs::File::open(&executable).map_err(|_| GateError::Artifact)?;
    let mut digest = Sha256::new();
    let mut buffer = [0; 8192];
    loop {
        let count = binary.read(&mut buffer).map_err(|_| GateError::Artifact)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    let sha = format!("{:x}", digest.finalize());
    verify(
        &approval,
        (
            &executable,
            &sha,
            option_env!("BOGUNON_SURFACE_SOURCE_SHA").unwrap_or("UNSET"),
        ),
    )?;
    super::live_permissions::verify_permissions()?;
    Ok(LivePermit(()))
}
