mod command;
mod contract;
mod inspect;
mod save;
mod transform;

pub(crate) use command::{OfficialDocumentOdtRequest, OfficialDocumentOdtResult};

pub(crate) use contract::{
    p10_output_zip_contract, ApprovedTemplateContract, BookmarkKind, BookmarkRule, ZipEntryRule,
};
pub(crate) use inspect::{inspect_template, TemplateManifest};
pub(crate) use transform::{transform_template, OdtExportDocument};

use sha2::{Digest, Sha256};
use std::{error::Error, fmt};

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum TemplateContractError {
    ShaMismatch,
    InvalidPackage,
    StructureMismatch(&'static str),
}

impl fmt::Display for TemplateContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ShaMismatch => {
                formatter.write_str("선택한 표준서식의 SHA-256이 승인된 값과 다릅니다.")
            }
            Self::InvalidPackage => formatter.write_str("ODT 패키지를 읽을 수 없습니다."),
            Self::StructureMismatch(reason) => write!(
                formatter,
                "ODT 패키지 구조가 승인된 표준서식과 다릅니다: {reason}"
            ),
        }
    }
}

impl Error for TemplateContractError {}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum OdtTransformError {
    Template(TemplateContractError),
    MissingContent,
    UnsupportedFormat(&'static str),
    InvalidCanonicalBody,
    MissingReplacementTarget(&'static str),
    OutputPackage,
    OutputStructure(&'static str),
}

impl From<TemplateContractError> for OdtTransformError {
    fn from(error: TemplateContractError) -> Self {
        Self::Template(error)
    }
}

impl fmt::Display for OdtTransformError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Template(error) => fmt::Display::fmt(error, formatter),
            Self::MissingContent => formatter.write_str("공문 제목과 본문을 모두 입력해 주세요."),
            Self::UnsupportedFormat(reason) => write!(
                formatter,
                "현재 ODT 내보내기에서 지원하지 않는 문서 형식입니다: {reason}"
            ),
            Self::InvalidCanonicalBody => {
                formatter.write_str("공문 본문의 붙임 또는 종료 표시가 올바르지 않습니다.")
            }
            Self::MissingReplacementTarget(target) => write!(
                formatter,
                "표준서식의 치환 영역을 찾을 수 없습니다: {target}"
            ),
            Self::OutputPackage => formatter.write_str("ODT 출력 패키지를 만들 수 없습니다."),
            Self::OutputStructure(reason) => {
                write!(formatter, "ODT 출력 구조 검증에 실패했습니다: {reason}")
            }
        }
    }
}

impl Error for OdtTransformError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Template(error) => Some(error),
            Self::MissingContent
            | Self::UnsupportedFormat(_)
            | Self::InvalidCanonicalBody
            | Self::MissingReplacementTarget(_)
            | Self::OutputPackage
            | Self::OutputStructure(_) => None,
        }
    }
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect()
}

pub(crate) fn validate_template(
    bytes: &[u8],
    contract: &ApprovedTemplateContract,
) -> Result<TemplateManifest, TemplateContractError> {
    if sha256_hex(bytes) != contract.sha256 {
        return Err(TemplateContractError::ShaMismatch);
    }
    let manifest = inspect_template(bytes)?;
    contract.validate(&manifest)?;
    Ok(manifest)
}

#[tauri::command]
pub(crate) fn save_official_document_odt(
    app: tauri::AppHandle,
    request: OfficialDocumentOdtRequest,
) -> Result<OfficialDocumentOdtResult, String> {
    command::execute_save_official_document_odt(app, request)
}

#[cfg(test)]
mod command_tests;
#[cfg(test)]
mod save_tests;
#[cfg(test)]
mod tests;
