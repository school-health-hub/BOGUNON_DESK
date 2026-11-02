use serde::Serialize;
use std::{fmt, fs, path::Path};

mod package;
mod pdf;

pub const MAX_FILE_BYTES: u64 = 15 * 1024 * 1024;
pub const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_PDF_PAGES: usize = 50;
pub const MAX_ZIP_ENTRIES: usize = 1024;
pub const MAX_XML_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OfficialDocumentFormat {
    Pdf,
    Hwpx,
    Odt,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialDocumentImportResult {
    pub source_name: String,
    pub format: OfficialDocumentFormat,
    pub text: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImportError {
    UnsupportedExtension,
    FileTooLarge,
    PdfUnreadable,
    PdfPageLimit,
    PdfTextLimit,
    PdfWithoutText,
    HwpxUnreadable,
    HwpxEntryLimit,
    HwpxXmlLimit,
    HwpxTextLimit,
    HwpxWithoutText,
    OdtUnreadable,
    OdtEntryLimit,
    OdtXmlLimit,
    OdtTextLimit,
    OdtWithoutText,
    InvalidFileName,
}

impl ImportError {
    pub const fn message(self) -> &'static str {
        match self {
            Self::UnsupportedExtension => "PDF, ODT 또는 HWPX 파일만 가져올 수 있습니다.",
            Self::FileTooLarge => "파일은 최대 15MB까지 가져올 수 있습니다.",
            Self::PdfUnreadable => "PDF 파일을 읽지 못했습니다.",
            Self::PdfPageLimit => "PDF는 최대 50페이지까지 가져올 수 있습니다.",
            Self::PdfTextLimit => "PDF에서 추출한 텍스트가 너무 큽니다.",
            Self::PdfWithoutText => {
                "텍스트를 읽을 수 없는 PDF입니다.\n스캔 문서 OCR은 현재 지원하지 않습니다."
            }
            Self::HwpxUnreadable => "올바른 HWPX 문서를 읽지 못했습니다.",
            Self::HwpxEntryLimit => "HWPX 문서에 포함된 파일이 너무 많습니다.",
            Self::HwpxXmlLimit => "HWPX 문서의 본문 데이터가 너무 큽니다.",
            Self::HwpxTextLimit => "HWPX 문서에서 추출한 텍스트가 너무 큽니다.",
            Self::HwpxWithoutText => "HWPX 문서에서 읽을 수 있는 본문을 찾지 못했습니다.",
            Self::OdtUnreadable => "올바른 ODT 문서를 읽지 못했습니다.",
            Self::OdtEntryLimit => "ODT 문서에 포함된 파일이 너무 많습니다.",
            Self::OdtXmlLimit => "ODT 문서의 본문 데이터가 너무 큽니다.",
            Self::OdtTextLimit => "ODT 문서에서 추출한 텍스트가 너무 큽니다.",
            Self::OdtWithoutText => "ODT 문서에서 읽을 수 있는 본문을 찾지 못했습니다.",
            Self::InvalidFileName => "파일 이름을 읽지 못했습니다.",
        }
    }
}

impl fmt::Display for ImportError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message())
    }
}
impl std::error::Error for ImportError {}

pub fn extract_document(path: &Path) -> Result<OfficialDocumentImportResult, ImportError> {
    let format = document_format(path)?;
    let unreadable = match format {
        OfficialDocumentFormat::Pdf => ImportError::PdfUnreadable,
        OfficialDocumentFormat::Hwpx => ImportError::HwpxUnreadable,
        OfficialDocumentFormat::Odt => ImportError::OdtUnreadable,
    };
    if fs::metadata(path).map_err(|_| unreadable)?.len() > MAX_FILE_BYTES {
        return Err(ImportError::FileTooLarge);
    }
    let text = match format {
        OfficialDocumentFormat::Pdf => pdf::extract(path)?,
        OfficialDocumentFormat::Hwpx => package::extract_hwpx(path)?,
        OfficialDocumentFormat::Odt => package::extract_odt(path)?,
    };
    let source_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
        .ok_or(ImportError::InvalidFileName)?;
    Ok(OfficialDocumentImportResult {
        source_name,
        format,
        text,
    })
}

fn document_format(path: &Path) -> Result<OfficialDocumentFormat, ImportError> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pdf") => Ok(OfficialDocumentFormat::Pdf),
        Some("hwpx") => Ok(OfficialDocumentFormat::Hwpx),
        Some("odt") => Ok(OfficialDocumentFormat::Odt),
        _ => Err(ImportError::UnsupportedExtension),
    }
}

pub(super) fn normalize(text: &str) -> String {
    let mut output = String::new();
    let mut previous_blank = false;
    for line in text.trim().lines() {
        let line = line.trim_end();
        let blank = line.trim().is_empty();
        if blank && previous_blank {
            continue;
        }
        if !output.is_empty() {
            output.push('\n');
        }
        if !blank {
            output.push_str(line);
        }
        previous_blank = blank;
    }
    output
}
