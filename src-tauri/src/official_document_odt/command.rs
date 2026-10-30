use std::{fs, io::Read, path::Path};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use super::save::{
    replace_validated, FilesystemStager, PlatformAtomicCommitter, SaveError, SavePolicy,
};
use super::{
    inspect_template, p10_output_zip_contract, transform_template, ApprovedTemplateContract,
    OdtExportDocument,
};

const MAX_TEMPLATE_BYTES: usize = 25 * 1024 * 1024;
const MAX_FILENAME_UNITS: usize = 120;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialDocumentOdtRequest {
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) attachments: String,
    pub(crate) has_table_text: bool,
}

impl OfficialDocumentOdtRequest {
    pub(crate) fn validate(&self) -> Result<(), ExportCommandError> {
        if self.title.trim().is_empty() || self.body.trim().is_empty() {
            return Err(ExportCommandError::MissingContent);
        }
        if self.has_table_text {
            return Err(ExportCommandError::UnsupportedTable);
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum OfficialDocumentOdtResult {
    Saved {
        #[serde(rename = "fileName")]
        file_name: String,
    },
    Cancelled,
}

pub(crate) fn selected_or_cancelled<T>(
    selection: Option<T>,
) -> Result<T, OfficialDocumentOdtResult> {
    selection.ok_or(OfficialDocumentOdtResult::Cancelled)
}

#[derive(Debug)]
pub(crate) enum ExportCommandError {
    MissingContent,
    UnsupportedTable,
    TemplateRead,
    Destination,
    Filename,
}

impl std::fmt::Display for ExportCommandError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::MissingContent => "공문 제목과 본문을 모두 입력해 주세요.",
            Self::UnsupportedTable => {
                "표 복사용 본문이 있는 공문은 현재 ODT 내보내기에서 지원하지 않습니다."
            }
            Self::TemplateRead => "선택한 표준서식 파일을 읽지 못했습니다.",
            Self::Destination => "저장할 ODT 파일 경로를 확인해 주세요.",
            Self::Filename => "공문 제목으로 안전한 파일명을 만들 수 없습니다.",
        })
    }
}

impl std::error::Error for ExportCommandError {}

pub(crate) fn default_odt_filename(title: &str) -> Result<String, ExportCommandError> {
    let sanitized: String = title
        .trim()
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect();
    let stem = sanitized.trim_end_matches(['.', ' ']);
    if stem.is_empty() || is_reserved_windows_name(stem) {
        return Err(ExportCommandError::Filename);
    }
    let mut units = 0;
    let bounded: String = stem
        .chars()
        .take_while(|character| {
            let next = units + character.len_utf16();
            if next > MAX_FILENAME_UNITS - 4 {
                return false;
            }
            units = next;
            true
        })
        .collect();
    let bounded = bounded.trim_end_matches(['.', ' ']);
    if bounded.is_empty() || is_reserved_windows_name(bounded) {
        return Err(ExportCommandError::Filename);
    }
    Ok(format!("{bounded}.odt"))
}

fn is_reserved_windows_name(stem: &str) -> bool {
    let base = stem.split('.').next().unwrap_or(stem).to_ascii_uppercase();
    matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (base.len() == 4
            && (base.starts_with("COM") || base.starts_with("LPT"))
            && matches!(base.as_bytes()[3], b'1'..=b'9'))
}

fn read_template(path: &Path) -> Result<Vec<u8>, ExportCommandError> {
    let file = fs::File::open(path).map_err(|_| ExportCommandError::TemplateRead)?;
    if !file
        .metadata()
        .map_err(|_| ExportCommandError::TemplateRead)?
        .is_file()
    {
        return Err(ExportCommandError::TemplateRead);
    }
    let mut bytes = Vec::new();
    file.take(25 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| ExportCommandError::TemplateRead)?;
    if bytes.len() > MAX_TEMPLATE_BYTES {
        return Err(ExportCommandError::TemplateRead);
    }
    Ok(bytes)
}

fn validate_staged_output(
    bytes: &[u8],
    contract: &ApprovedTemplateContract,
) -> Result<(), SaveError> {
    let manifest = inspect_template(bytes).map_err(|_| SaveError::Validation)?;
    if manifest.bookmarks != contract.bookmarks
        || manifest.table_count != contract.table_count
        || manifest.frame_count != contract.frame_count
        || manifest.style_reference_count != contract.style_reference_count
        || manifest.style_reference_sha256 != contract.style_reference_sha256
        || manifest.zip_entries != p10_output_zip_contract()
    {
        return Err(SaveError::Validation);
    }
    Ok(())
}

pub(crate) fn execute_save_official_document_odt(
    app: AppHandle,
    request: OfficialDocumentOdtRequest,
) -> Result<OfficialDocumentOdtResult, String> {
    request.validate().map_err(|error| error.to_string())?;
    let default_name = default_odt_filename(&request.title).map_err(|error| error.to_string())?;
    let template_file = match selected_or_cancelled(
        app.dialog()
            .file()
            .add_filter("K-에듀파인 표준서식", &["odt"])
            .blocking_pick_file(),
    ) {
        Ok(file) => file,
        Err(cancelled) => return Ok(cancelled),
    };
    let template_path = template_file
        .into_path()
        .map_err(|_| ExportCommandError::TemplateRead.to_string())?;
    let template = read_template(&template_path).map_err(|error| error.to_string())?;
    let contract = ApprovedTemplateContract::production();
    let output = transform_template(
        &template,
        &contract,
        OdtExportDocument {
            title: &request.title,
            body: &request.body,
            attachments: &request.attachments,
        },
    )
    .map_err(|error| error.to_string())?;
    let destination_file = match selected_or_cancelled(
        app.dialog()
            .file()
            .set_file_name(&default_name)
            .add_filter("ODT 문서", &["odt"])
            .blocking_save_file(),
    ) {
        Ok(file) => file,
        Err(cancelled) => return Ok(cancelled),
    };
    let destination = destination_file
        .into_path()
        .map_err(|_| ExportCommandError::Destination.to_string())?;
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ExportCommandError::Destination.to_string())?
        .to_owned();
    replace_validated(
        &destination,
        &output,
        SavePolicy {
            stager: FilesystemStager,
            validate: |staged: &[u8]| validate_staged_output(staged, &contract),
            committer: PlatformAtomicCommitter::new(),
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(OfficialDocumentOdtResult::Saved { file_name })
}
