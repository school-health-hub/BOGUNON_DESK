use std::io::{Cursor, Read, Write};

use quick_xml::escape::escape;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use super::{
    inspect_template, p10_output_zip_contract, validate_template, ApprovedTemplateContract,
    OdtTransformError, TemplateManifest,
};

const RECIPIENT_BOOKMARK: &str = "CellField5¡수신¡F";
const ROUTE_BOOKMARK: &str = "CellField6¡경유¡F";
const TITLE_BOOKMARK: &str = "CellField7¡결재제목¡T";
const BODY_BOOKMARK: &str = "NormalField1¡본문¡본문을 입력하십시오¡T¡F";
pub(super) const CLEAN_META: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><office:document-meta office:version=\"1.2\" xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\"><office:meta/></office:document-meta>";

#[derive(Debug, Clone, Copy)]
pub(crate) struct OdtExportDocument<'a> {
    pub(crate) title: &'a str,
    pub(crate) body: &'a str,
    pub(crate) attachments: &'a str,
}

pub(crate) fn transform_template(
    template: &[u8],
    contract: &ApprovedTemplateContract,
    document: OdtExportDocument<'_>,
) -> Result<Vec<u8>, OdtTransformError> {
    validate_document(document)?;
    let source_manifest = validate_template(template, contract)?;
    let entries = read_entries(template)?;
    let output = write_output(entries, document)?;
    validate_output(&output, contract, &source_manifest)?;
    Ok(output)
}

fn validate_document(document: OdtExportDocument<'_>) -> Result<(), OdtTransformError> {
    if document.title.trim().is_empty() || document.body.trim().is_empty() {
        return Err(OdtTransformError::MissingContent);
    }
    if document
        .title
        .chars()
        .any(|value| matches!(value, '\r' | '\n' | '\t'))
        || document.body.contains('\t')
    {
        return Err(OdtTransformError::UnsupportedFormat("탭 또는 제목 줄바꿈"));
    }
    if document.body.match_indices("끝.").count() != 1 {
        return Err(OdtTransformError::InvalidCanonicalBody);
    }
    for attachment in attachment_names(document.attachments) {
        if !document.body.contains(attachment) {
            return Err(OdtTransformError::InvalidCanonicalBody);
        }
    }
    Ok(())
}

fn attachment_names(value: &str) -> impl Iterator<Item = &str> {
    value.lines().filter_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed == "붙임"
            || trimmed == "끝."
            || trimmed.contains("[확인 필요]")
        {
            return None;
        }
        let without_number = trimmed
            .split_once(". ")
            .map_or(trimmed, |(_, remainder)| remainder);
        let name = without_number
            .rsplit_once(" 1부.")
            .map_or(without_number, |(name, _)| name)
            .trim();
        (!name.is_empty()).then_some(name)
    })
}

fn read_entries(template: &[u8]) -> Result<Vec<(String, Vec<u8>)>, OdtTransformError> {
    let mut archive =
        ZipArchive::new(Cursor::new(template)).map_err(|_| OdtTransformError::OutputPackage)?;
    let mut entries = Vec::with_capacity(archive.len());
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| OdtTransformError::OutputPackage)?;
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|_| OdtTransformError::OutputPackage)?;
        entries.push((entry.name().to_owned(), bytes));
    }
    Ok(entries)
}

fn write_output(
    entries: Vec<(String, Vec<u8>)>,
    document: OdtExportDocument<'_>,
) -> Result<Vec<u8>, OdtTransformError> {
    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    for (name, bytes) in entries {
        let output = match name.as_str() {
            "content.xml" => transform_content(&bytes, document)?,
            "meta.xml" => CLEAN_META.as_bytes().to_vec(),
            _ => bytes,
        };
        let method = if name == "mimetype" {
            CompressionMethod::Stored
        } else {
            CompressionMethod::Deflated
        };
        writer
            .start_file(
                name,
                SimpleFileOptions::default().compression_method(method),
            )
            .map_err(|_| OdtTransformError::OutputPackage)?;
        writer
            .write_all(&output)
            .map_err(|_| OdtTransformError::OutputPackage)?;
    }
    writer
        .finish()
        .map(Cursor::into_inner)
        .map_err(|_| OdtTransformError::OutputPackage)
}

fn transform_content(
    content: &[u8],
    document: OdtExportDocument<'_>,
) -> Result<Vec<u8>, OdtTransformError> {
    let mut xml =
        String::from_utf8(content.to_vec()).map_err(|_| OdtTransformError::OutputPackage)?;
    if ["tracked-changes", "change-info", "dc:creator"]
        .iter()
        .any(|needle| xml.contains(needle))
    {
        return Err(OdtTransformError::UnsupportedFormat(
            "변경 이력 또는 작성자 정보",
        ));
    }
    replace_point_value(&mut xml, RECIPIENT_BOOKMARK, "내부결재", "수신")?;
    replace_point_value(&mut xml, ROUTE_BOOKMARK, "", "경유")?;
    replace_point_value(&mut xml, TITLE_BOOKMARK, document.title, "제목")?;
    replace_body_value(&mut xml, document.body)?;
    Ok(xml.into_bytes())
}

fn replace_point_value(
    xml: &mut String,
    bookmark: &str,
    value: &str,
    label: &'static str,
) -> Result<(), OdtTransformError> {
    let marker = format!("<text:bookmark text:name=\"{bookmark}\"/>");
    let marker_index = unique_index(xml, &marker, label)?;
    let before = &xml[..marker_index];
    let open = before
        .rfind("<text:span")
        .ok_or(OdtTransformError::MissingReplacementTarget(label))?;
    let tag_end = before[open..]
        .find('>')
        .map(|offset| open + offset)
        .ok_or(OdtTransformError::MissingReplacementTarget(label))?;
    if before[open..=tag_end].ends_with("/>") {
        if !before[tag_end + 1..].trim().is_empty() {
            return Err(OdtTransformError::MissingReplacementTarget(label));
        }
        let replacement = format!(">{}</text:span>", encode_text(value));
        xml.replace_range(tag_end - 1..=tag_end, &replacement);
        return Ok(());
    }
    let close = before[tag_end + 1..]
        .find("</text:span>")
        .map(|offset| tag_end + 1 + offset)
        .ok_or(OdtTransformError::MissingReplacementTarget(label))?;
    if !before[close + "</text:span>".len()..].trim().is_empty() {
        return Err(OdtTransformError::MissingReplacementTarget(label));
    }
    xml.replace_range(tag_end + 1..close, &encode_text(value));
    Ok(())
}

fn replace_body_value(xml: &mut String, value: &str) -> Result<(), OdtTransformError> {
    let start_marker = format!("<text:bookmark-start text:name=\"{BODY_BOOKMARK}\"/>");
    let end_marker = format!("<text:bookmark-end text:name=\"{BODY_BOOKMARK}\"/>");
    let start = unique_index(xml, &start_marker, "본문 시작")? + start_marker.len();
    let end = unique_index(xml, &end_marker, "본문 종료")?;
    if start >= end {
        return Err(OdtTransformError::MissingReplacementTarget("본문"));
    }
    let between = &xml[start..end];
    let open_offset = between
        .find("<text:span")
        .ok_or(OdtTransformError::MissingReplacementTarget("본문"))?;
    let open = start + open_offset;
    let content_start = xml[open..]
        .find('>')
        .map(|offset| open + offset + 1)
        .ok_or(OdtTransformError::MissingReplacementTarget("본문"))?;
    let close = xml[content_start..end]
        .find("</text:span>")
        .map(|offset| content_start + offset)
        .ok_or(OdtTransformError::MissingReplacementTarget("본문"))?;
    xml.replace_range(content_start..close, &encode_text(value));
    Ok(())
}

fn unique_index(xml: &str, marker: &str, label: &'static str) -> Result<usize, OdtTransformError> {
    let mut matches = xml.match_indices(marker);
    let (index, _) = matches
        .next()
        .ok_or(OdtTransformError::MissingReplacementTarget(label))?;
    if matches.next().is_some() {
        return Err(OdtTransformError::MissingReplacementTarget(label));
    }
    Ok(index)
}

fn encode_text(value: &str) -> String {
    value
        .split('\n')
        .map(|line| encode_line(line.trim_end_matches('\r')))
        .collect::<Vec<_>>()
        .join("<text:line-break/>")
}

fn encode_line(line: &str) -> String {
    let mut encoded = String::new();
    for segment in line.split_inclusive(' ') {
        let (text, has_space) = segment
            .strip_suffix(' ')
            .map_or((segment, false), |text| (text, true));
        encoded.push_str(&escape(text));
        if has_space {
            encoded.push_str("<text:s/>");
        }
    }
    encoded
}

fn validate_output(
    output: &[u8],
    contract: &ApprovedTemplateContract,
    source: &TemplateManifest,
) -> Result<(), OdtTransformError> {
    let manifest = inspect_template(output)?;
    if manifest.bookmarks != contract.bookmarks
        || manifest.table_count != source.table_count
        || manifest.frame_count != source.frame_count
        || manifest.style_reference_count != source.style_reference_count
        || manifest.style_reference_sha256 != source.style_reference_sha256
    {
        return Err(OdtTransformError::OutputStructure("북마크 또는 서식 구조"));
    }
    if manifest.zip_entries != p10_output_zip_contract() {
        return Err(OdtTransformError::OutputStructure("ZIP 패키징"));
    }
    Ok(())
}
