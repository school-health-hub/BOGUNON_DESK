use std::path::Path;

pub const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImportError {
    UnsupportedExtension,
    FileTooLarge,
    Unreadable,
    PdfPageLimit,
    PdfWithoutText,
    ZipEntryLimit,
    XmlLimit,
    TextLimit,
    WithoutText,
    HwpUnsupportedSecurity,
    HwpUnsupportedVersion,
    HwpSectionLimit,
    HwpRecordLimit,
    HwpDataLimit,
    InvalidFileName,
    BatchLimit,
    BatchTextLimit,
}

impl ImportError {
    pub const fn message(self) -> &'static str {
        match self {
            Self::UnsupportedExtension => "PDF, HWPX, DOCX, HWP 파일만 가져올 수 있습니다.",
            Self::FileTooLarge => "파일은 최대 15MB까지 가져올 수 있습니다.",
            Self::Unreadable => "파일을 읽지 못했습니다.",
            Self::PdfPageLimit => "PDF는 최대 50페이지까지 가져올 수 있습니다.",
            Self::PdfWithoutText => {
                "텍스트를 읽을 수 없는 PDF입니다.\n스캔 문서 OCR은 현재 지원하지 않습니다."
            }
            Self::ZipEntryLimit => "문서에 포함된 파일이 너무 많습니다.",
            Self::XmlLimit => "문서의 본문 데이터가 너무 큽니다.",
            Self::TextLimit => "문서에서 추출한 텍스트가 너무 큽니다.",
            Self::WithoutText => "문서에서 읽을 수 있는 본문을 찾지 못했습니다.",
            Self::HwpUnsupportedSecurity => {
                "암호화, 배포용, DRM, 보안 설정이 적용된 HWP 문서는 지원하지 않습니다."
            }
            Self::HwpUnsupportedVersion => "HWP 5.x 문서만 지원합니다.",
            Self::HwpSectionLimit => "HWP 문서의 본문 구역이 너무 많습니다.",
            Self::HwpRecordLimit => "HWP 문서의 본문 레코드가 너무 많습니다.",
            Self::HwpDataLimit => "HWP 문서의 본문 데이터가 너무 큽니다.",
            Self::InvalidFileName => "파일 이름을 읽지 못했습니다.",
            Self::BatchLimit => "선택한 파일의 전체 크기가 너무 큽니다.",
            Self::BatchTextLimit => "추출된 활동보고서 본문의 전체 크기가 너무 큽니다.",
        }
    }
}

pub fn safe_source_name(path: &Path) -> Result<String, ImportError> {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .filter(|name| !name.contains('/') && !name.contains('\\'))
        .map(str::to_owned)
        .ok_or(ImportError::InvalidFileName)
}

pub fn enforce_text_limit(text: &str, error: ImportError) -> Result<(), ImportError> {
    if text.len() > MAX_TEXT_BYTES {
        return Err(error);
    }
    Ok(())
}

pub fn push_limited(output: &mut String, value: &str) -> Result<(), ImportError> {
    if output.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
        return Err(ImportError::TextLimit);
    }
    output.push_str(value);
    Ok(())
}

pub fn normalize_extracted_text(text: &str) -> String {
    let mut result = String::new();
    let mut previous_line_was_blank = false;
    for line in text.trim().lines() {
        let line = line.trim_end();
        let is_blank = line.trim().is_empty();
        if is_blank && previous_line_was_blank {
            continue;
        }
        if !result.is_empty() {
            result.push('\n');
        }
        if !is_blank {
            result.push_str(line);
        }
        previous_line_was_blank = is_blank;
    }
    result
}

pub fn ensure_has_text(text: String) -> Result<String, ImportError> {
    if text.chars().all(char::is_whitespace) {
        return Err(ImportError::WithoutText);
    }
    Ok(text)
}
