use std::{
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
};

use super::{
    bundled_template, sha256_hex, transform_template, ApprovedTemplateContract, OdtDocument,
    OdtError,
};

const MAX_ARTIFACT_BYTES: usize = 25 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OdtArtifact {
    pub path: PathBuf,
    pub sha256: String,
    pub byte_len: usize,
}

pub fn write_bundled_odt(
    destination: &Path,
    document: OdtDocument<'_>,
) -> Result<OdtArtifact, OdtError> {
    if destination.extension().and_then(|value| value.to_str()) != Some("odt")
        || destination.file_name().is_none()
    {
        return Err(OdtError::Destination);
    }
    let output = transform_template(
        bundled_template(),
        &ApprovedTemplateContract::home_v1(),
        document,
    )?;
    if output.len() > MAX_ARTIFACT_BYTES {
        return Err(OdtError::OutputPackage);
    }
    let mut file = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(OdtError::DestinationExists)
        }
        Err(_) => return Err(OdtError::Destination),
    };
    let write_result = file.write_all(&output).and_then(|()| file.sync_all());
    drop(file);
    if write_result.is_err() {
        let _cleanup_result = std::fs::remove_file(destination);
        return Err(OdtError::Destination);
    }
    Ok(OdtArtifact {
        path: destination.to_path_buf(),
        sha256: sha256_hex(&output),
        byte_len: output.len(),
    })
}
