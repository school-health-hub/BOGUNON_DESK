use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

mod hwp;
mod hwp_text;
mod pdf;
mod util;
mod zip_text;

use util::{enforce_text_limit, safe_source_name, ImportError};

const MAX_FILE_BYTES: u64 = 15 * 1024 * 1024;
const MAX_BATCH_FILES: usize = 50;
const MAX_BATCH_SOURCE_BYTES: u64 = 150 * 1024 * 1024;
const MAX_BATCH_TEXT_BYTES: usize = 20 * 1024 * 1024;
const EXTRACTION_WORKER_ERROR: &str = "활동보고서 파일을 처리하는 중 오류가 발생했습니다.";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordHelperReportFormat {
    Pdf,
    Hwpx,
    Docx,
    Hwp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordHelperImportedReport {
    source_name: String,
    format: RecordHelperReportFormat,
    text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordHelperImportFailure {
    source_name: String,
    message: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordHelperImportBatch {
    reports: Vec<RecordHelperImportedReport>,
    failures: Vec<RecordHelperImportFailure>,
}

fn document_format(path: &Path) -> Result<RecordHelperReportFormat, ImportError> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pdf") => Ok(RecordHelperReportFormat::Pdf),
        Some("hwpx") => Ok(RecordHelperReportFormat::Hwpx),
        Some("docx") => Ok(RecordHelperReportFormat::Docx),
        Some("hwp") => Ok(RecordHelperReportFormat::Hwp),
        _ => Err(ImportError::UnsupportedExtension),
    }
}

fn extract_known_report(
    path: &Path,
    format: RecordHelperReportFormat,
    source_bytes: u64,
) -> Result<(u64, RecordHelperImportedReport), ImportError> {
    let text = match format {
        RecordHelperReportFormat::Pdf => pdf::extract_pdf_text(path)?,
        RecordHelperReportFormat::Hwpx => zip_text::extract_hwpx_text(path)?,
        RecordHelperReportFormat::Docx => zip_text::extract_docx_text(path)?,
        RecordHelperReportFormat::Hwp => hwp::extract_hwp_text(path)?,
    };
    enforce_text_limit(&text, ImportError::TextLimit)?;
    Ok((
        source_bytes,
        RecordHelperImportedReport {
            source_name: safe_source_name(path)?,
            format,
            text,
        },
    ))
}

fn limited_failure(path: &Path, error: ImportError) -> RecordHelperImportFailure {
    RecordHelperImportFailure {
        source_name: safe_source_name(path).unwrap_or_else(|_| "가져올 수 없는 파일".to_owned()),
        message: error.message().to_owned(),
    }
}

fn batch_limit_failure() -> RecordHelperImportBatch {
    RecordHelperImportBatch {
        reports: Vec::new(),
        failures: vec![RecordHelperImportFailure {
            source_name: "선택한 파일".to_owned(),
            message: ImportError::BatchLimit.message().to_owned(),
        }],
    }
}

fn preflight_reports(
    paths: &[PathBuf],
) -> Result<
    (
        RecordHelperImportBatch,
        Vec<Option<(RecordHelperReportFormat, u64)>>,
    ),
    RecordHelperImportBatch,
> {
    let mut batch = RecordHelperImportBatch::default();
    let mut reports = Vec::with_capacity(paths.len());
    let mut source_bytes = 0_u64;

    if paths.len() > MAX_BATCH_FILES {
        batch.failures.push(RecordHelperImportFailure {
            source_name: "선택한 파일".to_owned(),
            message: "한 번에 최대 50개 파일까지 가져올 수 있습니다.".to_owned(),
        });
        return Err(batch);
    }

    for path in paths {
        let metadata = match fs::metadata(path) {
            Ok(metadata) => metadata,
            Err(_) => {
                batch
                    .failures
                    .push(limited_failure(path, ImportError::Unreadable));
                reports.push(None);
                continue;
            }
        };
        if !metadata.is_file() {
            batch
                .failures
                .push(limited_failure(path, ImportError::Unreadable));
            reports.push(None);
            continue;
        }

        let file_bytes = metadata.len();
        source_bytes = source_bytes.saturating_add(file_bytes);
        if source_bytes > MAX_BATCH_SOURCE_BYTES {
            return Err(batch_limit_failure());
        }
        if file_bytes > MAX_FILE_BYTES {
            batch
                .failures
                .push(limited_failure(path, ImportError::FileTooLarge));
            reports.push(None);
            continue;
        }
        match document_format(path) {
            Ok(format) => reports.push(Some((format, file_bytes))),
            Err(error) => {
                batch.failures.push(limited_failure(path, error));
                reports.push(None);
            }
        }
    }

    Ok((batch, reports))
}

fn extract_reports_with_text_limit(
    paths: Vec<PathBuf>,
    text_limit: usize,
) -> RecordHelperImportBatch {
    let (mut batch, preflight) = match preflight_reports(&paths) {
        Ok(value) => value,
        Err(batch) => return batch,
    };
    let mut text_bytes = 0_usize;

    for (path, preflight) in paths.iter().zip(preflight) {
        let Some((format, file_bytes)) = preflight else {
            continue;
        };
        match extract_known_report(path, format, file_bytes) {
            Ok((_, report)) => {
                let candidate = text_bytes.saturating_add(report.text.len());
                if candidate > text_limit {
                    batch
                        .failures
                        .push(limited_failure(path, ImportError::BatchTextLimit));
                    continue;
                }
                text_bytes = candidate;
                batch.reports.push(report);
            }
            Err(error) => batch.failures.push(limited_failure(path, error)),
        }
    }
    batch
}

fn extract_reports(paths: Vec<PathBuf>) -> RecordHelperImportBatch {
    extract_reports_with_text_limit(paths, MAX_BATCH_TEXT_BYTES)
}

async fn run_extraction_worker<T, F>(worker: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(worker)
        .await
        .map_err(|_| EXTRACTION_WORKER_ERROR.to_owned())
}

async fn extract_selected_reports(
    paths: Option<Vec<PathBuf>>,
) -> Result<RecordHelperImportBatch, String> {
    let Some(paths) = paths else {
        return Ok(RecordHelperImportBatch::default());
    };
    run_extraction_worker(move || extract_reports(paths)).await
}

#[tauri::command]
pub async fn pick_and_extract_record_helper_reports(
    app: AppHandle,
) -> Result<RecordHelperImportBatch, String> {
    let paths = app
        .dialog()
        .file()
        .add_filter("활동보고서", &["pdf", "hwpx", "docx", "hwp"])
        .blocking_pick_files()
        .map(|files| {
            files
                .into_iter()
                .map(|file| {
                    file.into_path()
                        .map_err(|_| "파일을 읽지 못했습니다.".to_owned())
                })
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;
    extract_selected_reports(paths).await
}

#[cfg(test)]
mod tests;
