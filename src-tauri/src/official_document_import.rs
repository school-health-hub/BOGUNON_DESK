use std::{
    fs::{self, File},
    io::{BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};

use pdf_extract::{Document, MediaBox, OutputDev, OutputError, Transform};
use quick_xml::{events::Event, Reader};
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use zip::ZipArchive;

const MAX_FILE_BYTES: u64 = 15 * 1024 * 1024;
const MAX_PDF_PAGES: usize = 50;
const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;
const MAX_HWPX_ZIP_ENTRIES: usize = 1024;
const MAX_HWPX_SECTION_XML_BYTES: u64 = 8 * 1024 * 1024;
const MIN_PDF_MEANINGFUL_CHARACTERS: usize = 8;
const ZIP_EOCD_MIN_BYTES: usize = 22;
const ZIP_MAX_COMMENT_BYTES: usize = u16::MAX as usize;
const EXTRACTION_WORKER_ERROR: &str = "공문 파일을 처리하는 중 오류가 발생했습니다.";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OfficialDocumentFormat {
    Pdf,
    Hwpx,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialDocumentImportResult {
    source_name: String,
    format: OfficialDocumentFormat,
    text: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ImportError {
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
    InvalidFileName,
}

impl ImportError {
    const fn message(self) -> &'static str {
        match self {
            Self::UnsupportedExtension => "PDF 또는 HWPX 파일만 가져올 수 있습니다.",
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
            Self::InvalidFileName => "파일 이름을 읽지 못했습니다.",
        }
    }
}

fn document_format(path: &Path) -> Result<OfficialDocumentFormat, ImportError> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pdf") => Ok(OfficialDocumentFormat::Pdf),
        Some("hwpx") => Ok(OfficialDocumentFormat::Hwpx),
        _ => Err(ImportError::UnsupportedExtension),
    }
}

fn source_name(path: &Path) -> Result<String, ImportError> {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
        .ok_or(ImportError::InvalidFileName)
}

fn enforce_file_size(path: &Path, unreadable: ImportError) -> Result<(), ImportError> {
    let size = fs::metadata(path).map_err(|_| unreadable)?.len();
    if size > MAX_FILE_BYTES {
        return Err(ImportError::FileTooLarge);
    }
    Ok(())
}

fn enforce_text_size(text: &str, error: ImportError) -> Result<(), ImportError> {
    if text.len() > MAX_TEXT_BYTES {
        return Err(error);
    }
    Ok(())
}

fn normalize_extracted_text(text: &str) -> String {
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

#[derive(Default)]
struct LimitedPdfTextOutput {
    text: String,
    last_end: f64,
    last_y: f64,
    first_character_in_word: bool,
    page_number: u32,
    exceeded_limit: bool,
}

impl LimitedPdfTextOutput {
    fn push(&mut self, value: &str) -> Result<(), OutputError> {
        if self.text.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
            self.exceeded_limit = true;
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "PDF text limit exceeded",
            )
            .into());
        }
        self.text.push_str(value);
        Ok(())
    }
}

impl OutputDev for LimitedPdfTextOutput {
    fn begin_page(
        &mut self,
        page_number: u32,
        _media_box: &MediaBox,
        _art_box: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), OutputError> {
        if self.page_number > 0 {
            self.push("\n\n")?;
        }
        self.page_number = page_number;
        self.last_end = f64::MAX;
        self.last_y = 0.0;
        self.first_character_in_word = false;
        Ok(())
    }

    fn end_page(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn output_character(
        &mut self,
        transform: &Transform,
        width: f64,
        _spacing: f64,
        font_size: f64,
        character: &str,
    ) -> Result<(), OutputError> {
        let rendered_font_size = (transform.m11.powi(2) + transform.m12.powi(2)).sqrt() * font_size;
        let x = transform.m31;
        let y = transform.m32;
        if self.first_character_in_word {
            if (y - self.last_y).abs() > rendered_font_size * 1.5
                || (x < self.last_end && (y - self.last_y).abs() > rendered_font_size * 0.5)
            {
                self.push("\n")?;
            } else if x > self.last_end + rendered_font_size * 0.1 {
                self.push(" ")?;
            }
        }
        self.push(character)?;
        self.first_character_in_word = false;
        self.last_y = y;
        self.last_end = x + width * rendered_font_size;
        Ok(())
    }

    fn begin_word(&mut self) -> Result<(), OutputError> {
        self.first_character_in_word = true;
        Ok(())
    }

    fn end_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn end_line(&mut self) -> Result<(), OutputError> {
        Ok(())
    }
}

fn extract_pdf_text(path: &Path) -> Result<String, ImportError> {
    let document = Document::load(path).map_err(|_| ImportError::PdfUnreadable)?;
    if document.get_pages().len() > MAX_PDF_PAGES {
        return Err(ImportError::PdfPageLimit);
    }
    let mut output = LimitedPdfTextOutput::default();
    if pdf_extract::output_doc(&document, &mut output).is_err() {
        return Err(if output.exceeded_limit {
            ImportError::PdfTextLimit
        } else {
            ImportError::PdfUnreadable
        });
    }
    let text = normalize_extracted_text(&output.text);
    enforce_text_size(&text, ImportError::PdfTextLimit)?;
    if text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count()
        < MIN_PDF_MEANINGFUL_CHARACTERS
    {
        return Err(ImportError::PdfWithoutText);
    }
    Ok(text)
}

fn section_number(name: &str) -> Option<u32> {
    let number = name
        .strip_prefix("Contents/section")?
        .strip_suffix(".xml")?;
    if number.is_empty() || !number.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    number.parse().ok()
}

fn push_limited(output: &mut String, value: &str) -> Result<(), ImportError> {
    if output.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
        return Err(ImportError::HwpxTextLimit);
    }
    output.push_str(value);
    Ok(())
}

fn extract_hwpx_section(xml: &str, output: &mut String) -> Result<(), ImportError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut inside_text = 0_u32;
    let mut inside_paragraph = 0_u32;

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) => match element.local_name().as_ref() {
                "t" => inside_text = inside_text.saturating_add(1),
                "p" => inside_paragraph = inside_paragraph.saturating_add(1),
                "lineBreak" | "br" if inside_paragraph > 0 => push_limited(output, "\n")?,
                "tab" if inside_paragraph > 0 => push_limited(output, "\t")?,
                _ => {}
            },
            Ok(Event::Empty(element)) => match element.local_name().as_ref() {
                "lineBreak" | "br" if inside_paragraph > 0 => push_limited(output, "\n")?,
                "tab" if inside_paragraph > 0 => push_limited(output, "\t")?,
                _ => {}
            },
            Ok(Event::Text(text)) if inside_text > 0 => {
                push_limited(output, text.as_ref())?;
            }
            Ok(Event::CData(text)) if inside_text > 0 => {
                push_limited(output, text.as_ref())?;
            }
            Ok(Event::GeneralRef(reference)) if inside_text > 0 => {
                if let Some(character) = reference
                    .resolve_char_ref()
                    .map_err(|_| ImportError::HwpxUnreadable)?
                {
                    let mut encoded = [0_u8; 4];
                    push_limited(output, character.encode_utf8(&mut encoded))?;
                } else if let Some(entity) =
                    quick_xml::escape::resolve_xml_entity(reference.as_ref())
                {
                    push_limited(output, entity)?;
                } else {
                    return Err(ImportError::HwpxUnreadable);
                }
            }
            Ok(Event::End(element)) => match element.local_name().as_ref() {
                "t" => inside_text = inside_text.saturating_sub(1),
                "p" => {
                    if !output.ends_with('\n') {
                        push_limited(output, "\n")?;
                    }
                    inside_paragraph = inside_paragraph.saturating_sub(1);
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(_) => return Err(ImportError::HwpxUnreadable),
            _ => {}
        }
        buffer.clear();
    }
    Ok(())
}

fn hwpx_entry_count_from_tail(tail: &[u8]) -> Result<usize, ImportError> {
    let Some(offset) = tail
        .windows(4)
        .rposition(|window| window == [0x50, 0x4b, 0x05, 0x06])
    else {
        return Err(ImportError::HwpxUnreadable);
    };
    let eocd = tail
        .get(offset..)
        .filter(|bytes| bytes.len() >= ZIP_EOCD_MIN_BYTES)
        .ok_or(ImportError::HwpxUnreadable)?;
    let comment_bytes = usize::from(u16::from_le_bytes([eocd[20], eocd[21]]));
    if eocd.len() != ZIP_EOCD_MIN_BYTES + comment_bytes {
        return Err(ImportError::HwpxUnreadable);
    }
    let entry_count = usize::from(u16::from_le_bytes([eocd[10], eocd[11]]));
    if entry_count == usize::from(u16::MAX) || entry_count > MAX_HWPX_ZIP_ENTRIES {
        return Err(ImportError::HwpxEntryLimit);
    }
    Ok(entry_count)
}

fn preflight_hwpx_entry_count(file: &mut File) -> Result<usize, ImportError> {
    let file_bytes = file
        .seek(SeekFrom::End(0))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let tail_bytes = file_bytes.min((ZIP_EOCD_MIN_BYTES + ZIP_MAX_COMMENT_BYTES) as u64);
    file.seek(SeekFrom::End(-(tail_bytes as i64)))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let mut tail = vec![0; tail_bytes as usize];
    file.read_exact(&mut tail)
        .map_err(|_| ImportError::HwpxUnreadable)?;
    hwpx_entry_count_from_tail(&tail)
}

fn extract_hwpx_text(path: &Path) -> Result<String, ImportError> {
    let mut file = File::open(path).map_err(|_| ImportError::HwpxUnreadable)?;
    let expected_entries = preflight_hwpx_entry_count(&mut file)?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let mut archive =
        ZipArchive::new(BufReader::new(file)).map_err(|_| ImportError::HwpxUnreadable)?;
    if archive.len() != expected_entries {
        return Err(ImportError::HwpxUnreadable);
    }
    let mut sections = Vec::new();
    let mut total_xml_bytes = 0_u64;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        if let Some(number) = section_number(entry.name()) {
            total_xml_bytes = total_xml_bytes.saturating_add(entry.size());
            if total_xml_bytes > MAX_HWPX_SECTION_XML_BYTES {
                return Err(ImportError::HwpxXmlLimit);
            }
            sections.push((number, index));
        }
    }
    if sections.is_empty() {
        return Err(ImportError::HwpxUnreadable);
    }
    sections.sort_unstable_by_key(|(number, _)| *number);

    let mut text = String::new();
    let mut actual_xml_bytes = 0_u64;
    for (_, index) in sections {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        let remaining = MAX_HWPX_SECTION_XML_BYTES.saturating_sub(actual_xml_bytes);
        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(remaining.saturating_add(1))
            .read_to_end(&mut bytes)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        actual_xml_bytes = actual_xml_bytes.saturating_add(bytes.len() as u64);
        if actual_xml_bytes > MAX_HWPX_SECTION_XML_BYTES {
            return Err(ImportError::HwpxXmlLimit);
        }
        let xml = std::str::from_utf8(&bytes).map_err(|_| ImportError::HwpxUnreadable)?;
        extract_hwpx_section(xml, &mut text)?;
    }

    let text = normalize_extracted_text(&text);
    enforce_text_size(&text, ImportError::HwpxTextLimit)?;
    if text.chars().all(char::is_whitespace) {
        return Err(ImportError::HwpxWithoutText);
    }
    Ok(text)
}

fn extract_document(path: &Path) -> Result<OfficialDocumentImportResult, ImportError> {
    let format = document_format(path)?;
    enforce_file_size(
        path,
        match format {
            OfficialDocumentFormat::Pdf => ImportError::PdfUnreadable,
            OfficialDocumentFormat::Hwpx => ImportError::HwpxUnreadable,
        },
    )?;
    let text = match format {
        OfficialDocumentFormat::Pdf => extract_pdf_text(path)?,
        OfficialDocumentFormat::Hwpx => extract_hwpx_text(path)?,
    };
    Ok(OfficialDocumentImportResult {
        source_name: source_name(path)?,
        format,
        text,
    })
}

async fn run_extraction_worker<T, F>(worker: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(worker)
        .await
        .map_err(|_| EXTRACTION_WORKER_ERROR.to_owned())?
}

async fn extract_selected_document(
    path: Option<PathBuf>,
) -> Result<Option<OfficialDocumentImportResult>, String> {
    let Some(path) = path else {
        return Ok(None);
    };
    run_extraction_worker(move || {
        extract_document(&path).map_err(|error| error.message().to_owned())
    })
    .await
    .map(Some)
}

#[tauri::command]
pub async fn pick_and_extract_official_document(
    app: AppHandle,
) -> Result<Option<OfficialDocumentImportResult>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .add_filter("HWPX", &["hwpx"])
        .blocking_pick_file()
        .map(|file| {
            file.into_path()
                .map_err(|_| "파일을 읽지 못했습니다.".to_owned())
        })
        .transpose()?;
    extract_selected_document(path).await
}

#[cfg(test)]
mod tests {
    use std::{
        io::Write,
        time::{SystemTime, UNIX_EPOCH},
    };

    use pdf_extract::{dictionary, Object, Stream};
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    use super::*;

    fn fixture_path(name: &str, extension: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("official-document-{nonce}-{name}.{extension}"))
    }

    fn write_synthetic_pdf(name: &str, pages: &[&str]) -> PathBuf {
        let path = fixture_path(name, "pdf");
        let mut document = Document::with_version("1.7");
        let font_id = document.add_object(dictionary! {
            "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica", "Encoding" => "WinAnsiEncoding",
        });
        let pages_id = document.new_object_id();
        let mut page_ids = Vec::new();
        for page_text in pages {
            let operations = page_text
                .lines()
                .map(|line| {
                    let escaped = line
                        .replace('\\', "\\\\")
                        .replace('(', "\\(")
                        .replace(')', "\\)");
                    format!("({escaped}) Tj 0 -15 Td")
                })
                .collect::<Vec<_>>()
                .join("\n");
            let content = format!("BT /F1 10 Tf 50 750 Td\n{operations}\nET");
            let content_id = document.add_object(Stream::new(dictionary! {}, content.into_bytes()));
            let page_id = document.new_object_id();
            document.objects.insert(page_id, Object::Dictionary(dictionary! {
                "Type" => "Page", "Parent" => Object::Reference(pages_id), "Contents" => Object::Reference(content_id),
                "Resources" => dictionary! { "Font" => dictionary! { "F1" => Object::Reference(font_id) } },
            }));
            page_ids.push(page_id);
        }
        document.objects.insert(pages_id, Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => page_ids.len() as i64, "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        }));
        let catalog_id = document.add_object(
            dictionary! { "Type" => "Catalog", "Pages" => Object::Reference(pages_id) },
        );
        document.trailer.set("Root", catalog_id);
        document.save(&path).unwrap();
        path
    }

    fn write_hwpx(name: &str, entries: &[(&str, &str)]) -> PathBuf {
        let path = fixture_path(name, "hwpx");
        let file = File::create(&path).unwrap();
        let mut archive = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        for (entry_name, contents) in entries {
            archive.start_file(*entry_name, options).unwrap();
            archive.write_all(contents.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        path
    }

    fn write_hwpx_with_entry_count(name: &str, entry_count: usize, section_xml: &str) -> PathBuf {
        let path = fixture_path(name, "hwpx");
        let file = File::create(&path).unwrap();
        let mut archive = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        archive
            .start_file("Contents/section0.xml", options)
            .unwrap();
        archive.write_all(section_xml.as_bytes()).unwrap();
        for index in 1..entry_count {
            archive
                .start_file(format!("Metadata/entry{index}.bin"), options)
                .unwrap();
            archive.write_all(b"x").unwrap();
        }
        archive.finish().unwrap();
        path
    }

    fn zip_eocd(entry_count: u16, comment: &[u8]) -> Vec<u8> {
        let mut eocd = vec![0; ZIP_EOCD_MIN_BYTES];
        eocd[0..4].copy_from_slice(&[0x50, 0x4b, 0x05, 0x06]);
        eocd[8..10].copy_from_slice(&entry_count.to_le_bytes());
        eocd[10..12].copy_from_slice(&entry_count.to_le_bytes());
        eocd[20..22].copy_from_slice(&(comment.len() as u16).to_le_bytes());
        eocd.extend_from_slice(comment);
        eocd
    }

    #[test]
    fn extracts_text_pdf_in_page_order_and_returns_basename_only() {
        let path = write_synthetic_pdf("ordered", &["First page text", "Second page text"]);
        let result = extract_document(&path).unwrap();
        assert_eq!(
            result.source_name,
            path.file_name().unwrap().to_str().unwrap()
        );
        assert!(!result
            .source_name
            .contains(path.parent().unwrap().to_str().unwrap()));
        assert!(result.text.find("First page").unwrap() < result.text.find("Second page").unwrap());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_blank_and_oversized_page_count_pdfs() {
        let blank = write_synthetic_pdf("blank", &[""]);
        assert_eq!(extract_pdf_text(&blank), Err(ImportError::PdfWithoutText));
        fs::remove_file(blank).unwrap();
        let pages = vec!["Readable page"; MAX_PDF_PAGES + 1];
        let oversized = write_synthetic_pdf("pages", &pages);
        assert_eq!(extract_pdf_text(&oversized), Err(ImportError::PdfPageLimit));
        fs::remove_file(oversized).unwrap();
    }

    #[test]
    fn rejects_corrupt_pdf_and_pdf_text_over_limit() {
        let corrupt = fixture_path("corrupt", "pdf");
        fs::write(&corrupt, b"not a pdf").unwrap();
        assert_eq!(extract_pdf_text(&corrupt), Err(ImportError::PdfUnreadable));
        fs::remove_file(corrupt).unwrap();
        let huge = "x".repeat(MAX_TEXT_BYTES + 1);
        let text_limit = write_synthetic_pdf("text-limit", &[&huge]);
        assert_eq!(
            extract_pdf_text(&text_limit),
            Err(ImportError::PdfTextLimit)
        );
        fs::remove_file(text_limit).unwrap();
    }

    #[test]
    fn extracts_hwpx_sections_in_numeric_order_with_controls_and_entities() {
        let path = write_hwpx(
            "ordered",
            &[
                (
                    "Contents/section10.xml",
                    r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>third</hp:t></hp:run></hp:p></hp:section>"#,
                ),
                (
                    "Contents/section2.xml",
                    r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>second&amp;value</hp:t><hp:tab/><hp:t>tab</hp:t><hp:lineBreak/><hp:t>line</hp:t></hp:run></hp:p></hp:section>"#,
                ),
                (
                    "Contents/section0.xml",
                    r#"<hp:section xmlns:hp="urn:test"><hp:tbl><hp:tr><hp:tc><hp:p><hp:run><hp:t>first</hp:t></hp:run></hp:p></hp:tc></hp:tr></hp:tbl></hp:section>"#,
                ),
            ],
        );
        let text = extract_hwpx_text(&path).unwrap();
        let first = text
            .find("first")
            .unwrap_or_else(|| panic!("missing first in {text:?}"));
        let second = text
            .find("second&value")
            .unwrap_or_else(|| panic!("missing second in {text:?}"));
        let third = text
            .find("third")
            .unwrap_or_else(|| panic!("missing third in {text:?}"));
        assert!(
            first < second && second < third,
            "unexpected section order: {text:?}"
        );
        assert!(
            text.contains("second&value\ttab\nline"),
            "missing controls in {text:?}"
        );
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_invalid_or_empty_hwpx_packages() {
        let missing = write_hwpx("missing", &[("Contents/content.hpf", "package")]);
        assert_eq!(
            extract_hwpx_text(&missing),
            Err(ImportError::HwpxUnreadable)
        );
        fs::remove_file(missing).unwrap();
        let empty = write_hwpx(
            "empty",
            &[(
                "Contents/section0.xml",
                "<hp:section xmlns:hp=\"urn:test\"><hp:p/></hp:section>",
            )],
        );
        assert_eq!(extract_hwpx_text(&empty), Err(ImportError::HwpxWithoutText));
        fs::remove_file(empty).unwrap();
        let corrupt = fixture_path("corrupt", "hwpx");
        fs::write(&corrupt, b"not a zip").unwrap();
        assert_eq!(
            extract_hwpx_text(&corrupt),
            Err(ImportError::HwpxUnreadable)
        );
        fs::remove_file(corrupt).unwrap();
    }

    #[test]
    fn enforces_hwpx_xml_text_file_and_extension_limits_without_path_leaks() {
        let huge_xml = "x".repeat(MAX_HWPX_SECTION_XML_BYTES as usize + 1);
        let xml_limit = write_hwpx("xml-limit", &[("Contents/section0.xml", &huge_xml)]);
        assert_eq!(
            extract_hwpx_text(&xml_limit),
            Err(ImportError::HwpxXmlLimit)
        );
        fs::remove_file(xml_limit).unwrap();
        let huge_text = "x".repeat(MAX_TEXT_BYTES + 1);
        let xml = format!("<p><t>{huge_text}</t></p>");
        let text_limit = write_hwpx("text-limit", &[("Contents/section0.xml", &xml)]);
        assert_eq!(
            extract_hwpx_text(&text_limit),
            Err(ImportError::HwpxTextLimit)
        );
        fs::remove_file(text_limit).unwrap();
        let unsupported = fixture_path("unsupported", "hwp");
        fs::write(&unsupported, b"legacy").unwrap();
        assert_eq!(
            extract_document(&unsupported),
            Err(ImportError::UnsupportedExtension)
        );
        fs::remove_file(unsupported).unwrap();
        let oversized = fixture_path("oversized", "pdf");
        let file = File::create(&oversized).unwrap();
        file.set_len(MAX_FILE_BYTES + 1).unwrap();
        assert_eq!(extract_document(&oversized), Err(ImportError::FileTooLarge));
        fs::remove_file(oversized).unwrap();
        for error in [
            ImportError::PdfUnreadable,
            ImportError::HwpxUnreadable,
            ImportError::UnsupportedExtension,
        ] {
            assert!(!error.message().contains("\\"));
            assert!(!error.message().contains(":"));
        }
    }

    #[test]
    fn enforces_hwpx_entry_and_xml_limits_independently() {
        let readable_xml = r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>text</hp:t></hp:run></hp:p></hp:section>"#;
        let too_many_entries =
            write_hwpx_with_entry_count("entry-limit", MAX_HWPX_ZIP_ENTRIES + 1, readable_xml);
        assert_eq!(
            extract_hwpx_text(&too_many_entries),
            Err(ImportError::HwpxEntryLimit)
        );
        assert_eq!(
            ImportError::HwpxEntryLimit.message(),
            "HWPX 문서에 포함된 파일이 너무 많습니다."
        );
        fs::remove_file(too_many_entries).unwrap();

        let huge_xml = "x".repeat(MAX_HWPX_SECTION_XML_BYTES as usize + 1);
        let xml_limit = write_hwpx_with_entry_count("xml-limit-independent", 1, &huge_xml);
        assert_eq!(
            extract_hwpx_text(&xml_limit),
            Err(ImportError::HwpxXmlLimit)
        );
        fs::remove_file(xml_limit).unwrap();
    }

    #[test]
    fn rejects_hwpx_entry_count_before_zip_archive_allocation() {
        assert_eq!(
            hwpx_entry_count_from_tail(&zip_eocd((MAX_HWPX_ZIP_ENTRIES + 1) as u16, &[])),
            Err(ImportError::HwpxEntryLimit)
        );
        assert_eq!(
            hwpx_entry_count_from_tail(&zip_eocd(MAX_HWPX_ZIP_ENTRIES as u16, b"ok")),
            Ok(MAX_HWPX_ZIP_ENTRIES)
        );
    }

    #[test]
    fn accepts_hwpx_package_at_entry_limit() {
        let xml = r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>boundary</hp:t></hp:run></hp:p></hp:section>"#;
        let path = write_hwpx_with_entry_count("entry-boundary", MAX_HWPX_ZIP_ENTRIES, xml);
        assert_eq!(extract_hwpx_text(&path).unwrap(), "boundary");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn background_extraction_preserves_success_and_parser_errors() {
        let valid = write_hwpx(
            "background-success",
            &[(
                "Contents/section0.xml",
                r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>background</hp:t></hp:run></hp:p></hp:section>"#,
            )],
        );
        let result = tauri::async_runtime::block_on(extract_selected_document(Some(valid.clone())))
            .unwrap()
            .unwrap();
        assert_eq!(result.text, "background");
        fs::remove_file(valid).unwrap();

        let corrupt = fixture_path("background-error", "hwpx");
        fs::write(&corrupt, b"not a zip").unwrap();
        let error =
            tauri::async_runtime::block_on(extract_selected_document(Some(corrupt.clone())))
                .unwrap_err();
        assert_eq!(error, ImportError::HwpxUnreadable.message());
        fs::remove_file(corrupt).unwrap();
    }

    #[test]
    fn background_worker_hides_panics_behind_a_stable_error() {
        let result = tauri::async_runtime::block_on(run_extraction_worker::<(), _>(|| {
            panic!("sensitive worker detail")
        }));
        assert_eq!(result.unwrap_err(), EXTRACTION_WORKER_ERROR);
    }

    #[test]
    fn cancelled_selection_returns_none_without_starting_extraction() {
        let result = tauri::async_runtime::block_on(extract_selected_document(None)).unwrap();
        assert_eq!(result, None);
    }
}
