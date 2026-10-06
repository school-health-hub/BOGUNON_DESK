use std::{
    fs::File,
    io::{BufReader, Read, Seek, SeekFrom},
    path::Path,
};

use quick_xml::{events::Event, Reader};
use zip::ZipArchive;

use super::util::{ensure_has_text, normalize_extracted_text, push_limited, ImportError};

const ZIP_EOCD_MIN_BYTES: usize = 22;
const ZIP_MAX_COMMENT_BYTES: usize = 65_535;
const MAX_ZIP_ENTRIES: usize = 1024;
const MAX_XML_BYTES: u64 = 8 * 1024 * 1024;

fn entry_count_from_tail(tail: &[u8]) -> Result<usize, ImportError> {
    let Some(offset) = tail
        .windows(4)
        .rposition(|window| window == [0x50, 0x4b, 0x05, 0x06])
    else {
        return Err(ImportError::Unreadable);
    };
    let eocd = tail
        .get(offset..)
        .filter(|bytes| bytes.len() >= ZIP_EOCD_MIN_BYTES)
        .ok_or(ImportError::Unreadable)?;
    let comment_bytes = usize::from(u16::from_le_bytes([eocd[20], eocd[21]]));
    if eocd.len() != ZIP_EOCD_MIN_BYTES + comment_bytes {
        return Err(ImportError::Unreadable);
    }
    let entry_count = usize::from(u16::from_le_bytes([eocd[10], eocd[11]]));
    if entry_count == usize::from(u16::MAX) || entry_count > MAX_ZIP_ENTRIES {
        return Err(ImportError::ZipEntryLimit);
    }
    Ok(entry_count)
}

fn preflight_entry_count(file: &mut File) -> Result<usize, ImportError> {
    let file_bytes = file
        .seek(SeekFrom::End(0))
        .map_err(|_| ImportError::Unreadable)?;
    let max_tail_bytes = u64::try_from(ZIP_EOCD_MIN_BYTES + ZIP_MAX_COMMENT_BYTES)
        .map_err(|_| ImportError::Unreadable)?;
    let tail_bytes = file_bytes.min(max_tail_bytes);
    let tail_offset = i64::try_from(tail_bytes).map_err(|_| ImportError::Unreadable)?;
    file.seek(SeekFrom::End(-tail_offset))
        .map_err(|_| ImportError::Unreadable)?;
    let tail_len = usize::try_from(tail_bytes).map_err(|_| ImportError::Unreadable)?;
    let mut tail = vec![0; tail_len];
    file.read_exact(&mut tail)
        .map_err(|_| ImportError::Unreadable)?;
    entry_count_from_tail(&tail)
}

fn read_limited_xml<R: Read>(
    entry: &mut zip::read::ZipFile<'_, R>,
    used: &mut u64,
) -> Result<String, ImportError> {
    *used = used.saturating_add(entry.size());
    if *used > MAX_XML_BYTES {
        return Err(ImportError::XmlLimit);
    }
    let mut bytes = Vec::new();
    entry
        .by_ref()
        .take(MAX_XML_BYTES.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|_| ImportError::Unreadable)?;
    let actual_bytes = u64::try_from(bytes.len()).map_err(|_| ImportError::XmlLimit)?;
    if actual_bytes > MAX_XML_BYTES {
        return Err(ImportError::XmlLimit);
    }
    String::from_utf8(bytes).map_err(|_| ImportError::Unreadable)
}

fn extract_xml_text(xml: &str, paragraph: &str, text_tag: &str) -> Result<String, ImportError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut output = String::new();
    let mut inside_text = 0_u32;
    let mut inside_paragraph = 0_u32;
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) => match element.local_name().as_ref() {
                tag if tag == text_tag => inside_text = inside_text.saturating_add(1),
                tag if tag == paragraph => inside_paragraph = inside_paragraph.saturating_add(1),
                "lineBreak" | "br" if inside_paragraph > 0 => push_limited(&mut output, "\n")?,
                "tab" if inside_paragraph > 0 => push_limited(&mut output, "\t")?,
                _ => {}
            },
            Ok(Event::Empty(element)) => match element.local_name().as_ref() {
                "lineBreak" | "br" if inside_paragraph > 0 => push_limited(&mut output, "\n")?,
                "tab" if inside_paragraph > 0 => push_limited(&mut output, "\t")?,
                _ => {}
            },
            Ok(Event::Text(text)) if inside_text > 0 => push_limited(&mut output, text.as_ref())?,
            Ok(Event::CData(text)) if inside_text > 0 => push_limited(&mut output, text.as_ref())?,
            Ok(Event::GeneralRef(reference)) if inside_text > 0 => {
                if let Some(character) = reference
                    .resolve_char_ref()
                    .map_err(|_| ImportError::Unreadable)?
                {
                    let mut encoded = [0_u8; 4];
                    push_limited(&mut output, character.encode_utf8(&mut encoded))?;
                } else if let Some(entity) =
                    quick_xml::escape::resolve_xml_entity(reference.as_ref())
                {
                    push_limited(&mut output, entity)?;
                } else {
                    return Err(ImportError::Unreadable);
                }
            }
            Ok(Event::End(element)) => match element.local_name().as_ref() {
                tag if tag == text_tag => inside_text = inside_text.saturating_sub(1),
                tag if tag == paragraph => {
                    if !output.ends_with('\n') {
                        push_limited(&mut output, "\n")?;
                    }
                    inside_paragraph = inside_paragraph.saturating_sub(1);
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(_) => return Err(ImportError::Unreadable),
            _ => {}
        }
        buffer.clear();
    }
    Ok(output)
}

pub fn extract_hwpx_text(path: &Path) -> Result<String, ImportError> {
    extract_ordered_sections(path, "Contents/section", ".xml", "p", "t")
}

pub fn extract_docx_text(path: &Path) -> Result<String, ImportError> {
    extract_single_xml(path, "word/document.xml", "p", "t")
}

fn extract_single_xml(
    path: &Path,
    name: &str,
    paragraph: &str,
    text_tag: &str,
) -> Result<String, ImportError> {
    let mut file = File::open(path).map_err(|_| ImportError::Unreadable)?;
    let expected_entries = preflight_entry_count(&mut file)?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| ImportError::Unreadable)?;
    let mut archive = ZipArchive::new(BufReader::new(file)).map_err(|_| ImportError::Unreadable)?;
    if archive.len() != expected_entries {
        return Err(ImportError::Unreadable);
    }
    let mut used = 0_u64;
    let mut entry = archive.by_name(name).map_err(|_| ImportError::Unreadable)?;
    let xml = read_limited_xml(&mut entry, &mut used)?;
    ensure_has_text(normalize_extracted_text(&extract_xml_text(
        &xml, paragraph, text_tag,
    )?))
}

fn extract_ordered_sections(
    path: &Path,
    prefix: &str,
    suffix: &str,
    paragraph: &str,
    text_tag: &str,
) -> Result<String, ImportError> {
    let mut file = File::open(path).map_err(|_| ImportError::Unreadable)?;
    let expected_entries = preflight_entry_count(&mut file)?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| ImportError::Unreadable)?;
    let mut archive = ZipArchive::new(BufReader::new(file)).map_err(|_| ImportError::Unreadable)?;
    if archive.len() != expected_entries {
        return Err(ImportError::Unreadable);
    }
    let mut sections = Vec::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|_| ImportError::Unreadable)?;
        if let Some(number) = entry
            .name()
            .strip_prefix(prefix)
            .and_then(|name| name.strip_suffix(suffix))
            .and_then(|value| value.parse::<u32>().ok())
        {
            sections.push((number, index));
        }
    }
    if sections.is_empty() {
        return Err(ImportError::Unreadable);
    }
    sections.sort_unstable_by_key(|(number, _)| *number);
    let mut used = 0_u64;
    let mut output = String::new();
    for (_, index) in sections {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| ImportError::Unreadable)?;
        let xml = read_limited_xml(&mut entry, &mut used)?;
        push_limited(&mut output, &extract_xml_text(&xml, paragraph, text_tag)?)?;
    }
    ensure_has_text(normalize_extracted_text(&output))
}
