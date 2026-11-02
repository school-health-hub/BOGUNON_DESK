mod contract;
mod inspect;
mod transform;
mod write;

use sha2::{Digest, Sha256};

pub use contract::{ApprovedTemplateContract, BookmarkKind, BookmarkRule, ZipEntryRule};
pub use inspect::{inspect_template, TemplateManifest};
pub use transform::{transform_template, OdtDocument, CLEAN_META};
pub use write::{write_bundled_odt, OdtArtifact};

const BUNDLED_TEMPLATE: &[u8] = include_bytes!("../../resources/home-v1.odt");

#[derive(Debug, PartialEq, Eq)]
pub enum OdtError {
    HashMismatch,
    InvalidPackage,
    Structure(&'static str),
    MissingContent,
    UnsupportedFormat(&'static str),
    InvalidCanonicalBody,
    MissingTarget(&'static str),
    OutputPackage,
    Destination,
    DestinationExists,
}

impl std::fmt::Display for OdtError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::HashMismatch => formatter.write_str("ODT template hash is not approved"),
            Self::InvalidPackage => formatter.write_str("ODT package is invalid"),
            Self::Structure(reason) => write!(formatter, "ODT structure mismatch: {reason}"),
            Self::MissingContent => formatter.write_str("title and body are required"),
            Self::UnsupportedFormat(reason) => {
                write!(formatter, "unsupported ODT content: {reason}")
            }
            Self::InvalidCanonicalBody => {
                formatter.write_str("body ending or attachments are not canonical")
            }
            Self::MissingTarget(target) => write!(
                formatter,
                "template replacement target is missing: {target}"
            ),
            Self::OutputPackage => formatter.write_str("ODT output package could not be created"),
            Self::Destination => {
                formatter.write_str("temporary artifact path is invalid or unavailable")
            }
            Self::DestinationExists => {
                formatter.write_str("temporary artifact path already exists")
            }
        }
    }
}

impl std::error::Error for OdtError {}

pub fn bundled_template() -> &'static [u8] {
    BUNDLED_TEMPLATE
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect()
}

pub fn validate_template(
    bytes: &[u8],
    contract: &ApprovedTemplateContract,
) -> Result<TemplateManifest, OdtError> {
    if sha256_hex(bytes) != contract.sha256 {
        return Err(OdtError::HashMismatch);
    }
    let manifest = inspect_template(bytes)?;
    contract.validate(&manifest)?;
    Ok(manifest)
}
