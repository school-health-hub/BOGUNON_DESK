use std::io::{Cursor, Read, Write};

use quick_xml::escape::escape;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use super::{
    contract::output_zip_contract, inspect_template, validate_template, ApprovedTemplateContract,
    OdtError,
};

const RECIPIENT_BOOKMARK: &str = "CellField5¡수신¡F";
const ROUTE_BOOKMARK: &str = "CellField6¡경유¡F";
const TITLE_BOOKMARK: &str = "CellField7¡결재제목¡T";
const BODY_BOOKMARK: &str = "NormalField1¡본문¡본문을 입력하십시오¡T¡F";
pub const CLEAN_META: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><office:document-meta office:version=\"1.2\" xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\"><office:meta/></office:document-meta>";

#[derive(Debug, Clone, Copy)]
pub struct OdtDocument<'a> {
    pub title: &'a str,
    pub body: &'a str,
    pub attachments: &'a str,
    pub has_table_text: bool,
}

pub fn transform_template(
    template: &[u8],
    contract: &ApprovedTemplateContract,
    document: OdtDocument<'_>,
) -> Result<Vec<u8>, OdtError> {
    validate_document(document)?;
    let source = validate_template(template, contract)?;
    let output = write_output(read_entries(template)?, document)?;
    let manifest = inspect_template(&output)?;
    if manifest.bookmarks != contract.bookmarks
        || manifest.table_count != source.table_count
        || manifest.frame_count != source.frame_count
        || manifest.style_reference_count != source.style_reference_count
        || manifest.style_reference_sha256 != source.style_reference_sha256
    {
        return Err(OdtError::Structure("output bookmarks or styles"));
    }
    if manifest.zip_entries != output_zip_contract() {
        return Err(OdtError::Structure("output ZIP package"));
    }
    Ok(output)
}

fn validate_document(document: OdtDocument<'_>) -> Result<(), OdtError> {
    if document.title.trim().is_empty() || document.body.trim().is_empty() {
        return Err(OdtError::MissingContent);
    }
    if document.has_table_text {
        return Err(OdtError::UnsupportedFormat("table text"));
    }
    if document
        .title
        .chars()
        .any(|value| matches!(value, '\r' | '\n' | '\t'))
        || document.body.contains('\t')
    {
        return Err(OdtError::UnsupportedFormat("tabs or title line breaks"));
    }
    if document.body.match_indices("끝.").count() != 1 || !document.body.trim_end().ends_with("끝.")
    {
        return Err(OdtError::InvalidCanonicalBody);
    }
    for attachment in attachment_names(document.attachments) {
        if !document.body.contains(attachment) {
            return Err(OdtError::InvalidCanonicalBody);
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

fn read_entries(template: &[u8]) -> Result<Vec<(String, Vec<u8>)>, OdtError> {
    let mut archive =
        ZipArchive::new(Cursor::new(template)).map_err(|_| OdtError::OutputPackage)?;
    let mut entries = Vec::with_capacity(archive.len());
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| OdtError::OutputPackage)?;
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|_| OdtError::OutputPackage)?;
        entries.push((entry.name().to_owned(), bytes));
    }
    Ok(entries)
}

fn write_output(
    entries: Vec<(String, Vec<u8>)>,
    document: OdtDocument<'_>,
) -> Result<Vec<u8>, OdtError> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
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
            .map_err(|_| OdtError::OutputPackage)?;
        writer
            .write_all(&output)
            .map_err(|_| OdtError::OutputPackage)?;
    }
    writer
        .finish()
        .map(Cursor::into_inner)
        .map_err(|_| OdtError::OutputPackage)
}

fn transform_content(content: &[u8], document: OdtDocument<'_>) -> Result<Vec<u8>, OdtError> {
    let mut xml = String::from_utf8(content.to_vec()).map_err(|_| OdtError::OutputPackage)?;
    if ["tracked-changes", "change-info", "dc:creator"]
        .iter()
        .any(|needle| xml.contains(needle))
    {
        return Err(OdtError::UnsupportedFormat(
            "tracked changes or author metadata",
        ));
    }
    replace_point(&mut xml, RECIPIENT_BOOKMARK, "내부결재", "recipient")?;
    replace_point(&mut xml, ROUTE_BOOKMARK, "", "route")?;
    replace_point(&mut xml, TITLE_BOOKMARK, document.title, "title")?;
    replace_body(&mut xml, document.body)?;
    Ok(xml.into_bytes())
}

fn replace_point(
    xml: &mut String,
    bookmark: &str,
    value: &str,
    label: &'static str,
) -> Result<(), OdtError> {
    let marker = format!("<text:bookmark text:name=\"{bookmark}\"/>");
    let marker_index = unique_index(xml, &marker, label)?;
    let before = &xml[..marker_index];
    let open = before
        .rfind("<text:span")
        .ok_or(OdtError::MissingTarget(label))?;
    let tag_end = before[open..]
        .find('>')
        .map(|offset| open + offset)
        .ok_or(OdtError::MissingTarget(label))?;
    if before[open..=tag_end].ends_with("/>") {
        if !before[tag_end + 1..].trim().is_empty() {
            return Err(OdtError::MissingTarget(label));
        }
        xml.replace_range(
            tag_end - 1..=tag_end,
            &format!(">{}</text:span>", encode_text(value)),
        );
        return Ok(());
    }
    let close = before[tag_end + 1..]
        .find("</text:span>")
        .map(|offset| tag_end + 1 + offset)
        .ok_or(OdtError::MissingTarget(label))?;
    if !before[close + "</text:span>".len()..].trim().is_empty() {
        return Err(OdtError::MissingTarget(label));
    }
    xml.replace_range(tag_end + 1..close, &encode_text(value));
    Ok(())
}

fn replace_body(xml: &mut String, value: &str) -> Result<(), OdtError> {
    let start_marker = format!("<text:bookmark-start text:name=\"{BODY_BOOKMARK}\"/>");
    let end_marker = format!("<text:bookmark-end text:name=\"{BODY_BOOKMARK}\"/>");
    let start = unique_index(xml, &start_marker, "body start")? + start_marker.len();
    let end = unique_index(xml, &end_marker, "body end")?;
    if start >= end {
        return Err(OdtError::MissingTarget("body"));
    }
    let open = start
        + xml[start..end]
            .find("<text:span")
            .ok_or(OdtError::MissingTarget("body"))?;
    let content_start = open
        + xml[open..]
            .find('>')
            .ok_or(OdtError::MissingTarget("body"))?
        + 1;
    let close = content_start
        + xml[content_start..end]
            .find("</text:span>")
            .ok_or(OdtError::MissingTarget("body"))?;
    xml.replace_range(content_start..close, &encode_text(value));
    Ok(())
}

fn unique_index(xml: &str, marker: &str, label: &'static str) -> Result<usize, OdtError> {
    let mut matches = xml.match_indices(marker);
    let (index, _) = matches.next().ok_or(OdtError::MissingTarget(label))?;
    if matches.next().is_some() {
        return Err(OdtError::MissingTarget(label));
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
