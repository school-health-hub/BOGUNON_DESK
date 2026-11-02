use super::{normalize, ImportError, MAX_TEXT_BYTES, MAX_XML_BYTES, MAX_ZIP_ENTRIES};
use quick_xml::{events::Event, Reader};
use std::{
    fs::File,
    io::{BufReader, Read, Seek, SeekFrom},
    path::Path,
};
use zip::ZipArchive;

const EOCD_BYTES: usize = 22;
const MAX_COMMENT_BYTES: usize = u16::MAX as usize;

pub(super) fn extract_hwpx(path: &Path) -> Result<String, ImportError> {
    let mut file = File::open(path).map_err(|_| ImportError::HwpxUnreadable)?;
    let expected = preflight_entries(&mut file)?;
    file.seek(SeekFrom::Start(0))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let mut archive =
        ZipArchive::new(BufReader::new(file)).map_err(|_| ImportError::HwpxUnreadable)?;
    if archive.len() != expected {
        return Err(ImportError::HwpxUnreadable);
    }
    let mut sections = Vec::new();
    let mut advertised = 0_u64;
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        if let Some(number) = section_number(entry.name()) {
            advertised = advertised.saturating_add(entry.size());
            if advertised > MAX_XML_BYTES {
                return Err(ImportError::HwpxXmlLimit);
            }
            sections.push((number, index));
        }
    }
    if sections.is_empty() {
        return Err(ImportError::HwpxUnreadable);
    }
    sections.sort_unstable_by_key(|section| section.0);
    let mut output = String::new();
    let mut actual = 0_u64;
    for (_, index) in sections {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(MAX_XML_BYTES.saturating_sub(actual).saturating_add(1))
            .read_to_end(&mut bytes)
            .map_err(|_| ImportError::HwpxUnreadable)?;
        actual = actual.saturating_add(bytes.len() as u64);
        if actual > MAX_XML_BYTES {
            return Err(ImportError::HwpxXmlLimit);
        }
        extract_xml(
            std::str::from_utf8(&bytes).map_err(|_| ImportError::HwpxUnreadable)?,
            XmlFlavor::Hwpx,
            &mut output,
        )?;
    }
    finish(output, XmlFlavor::Hwpx)
}

pub(super) fn extract_odt(path: &Path) -> Result<String, ImportError> {
    let file = File::open(path).map_err(|_| ImportError::OdtUnreadable)?;
    let mut archive =
        ZipArchive::new(BufReader::new(file)).map_err(|_| ImportError::OdtUnreadable)?;
    if archive.len() > MAX_ZIP_ENTRIES {
        return Err(ImportError::OdtEntryLimit);
    }
    let mut content = archive
        .by_name("content.xml")
        .map_err(|_| ImportError::OdtUnreadable)?;
    if content.size() > MAX_XML_BYTES {
        return Err(ImportError::OdtXmlLimit);
    }
    let mut bytes = Vec::new();
    content
        .by_ref()
        .take(MAX_XML_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| ImportError::OdtUnreadable)?;
    if bytes.len() as u64 > MAX_XML_BYTES {
        return Err(ImportError::OdtXmlLimit);
    }
    let mut output = String::new();
    extract_xml(
        std::str::from_utf8(&bytes).map_err(|_| ImportError::OdtUnreadable)?,
        XmlFlavor::Odt,
        &mut output,
    )?;
    finish(output, XmlFlavor::Odt)
}

#[derive(Clone, Copy)]
enum XmlFlavor {
    Hwpx,
    Odt,
}

fn extract_xml(xml: &str, flavor: XmlFlavor, output: &mut String) -> Result<(), ImportError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut text_depth = 0_u32;
    let mut paragraph_depth = 0_u32;
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) => match element.local_name().as_ref() {
                "p" | "h" => {
                    paragraph_depth = paragraph_depth.saturating_add(1);
                    if matches!(flavor, XmlFlavor::Odt) {
                        text_depth = text_depth.saturating_add(1);
                    }
                }
                "t" if matches!(flavor, XmlFlavor::Hwpx) => {
                    text_depth = text_depth.saturating_add(1)
                }
                "lineBreak" | "line-break" | "br" if paragraph_depth > 0 => {
                    push(output, "\n", flavor)?
                }
                "tab" if paragraph_depth > 0 => push(output, "\t", flavor)?,
                "s" if paragraph_depth > 0 && matches!(flavor, XmlFlavor::Odt) => {
                    push(output, " ", flavor)?
                }
                _ => {}
            },
            Ok(Event::Empty(element)) => match element.local_name().as_ref() {
                "p" | "h" => push(output, "\n", flavor)?,
                "lineBreak" | "line-break" | "br" if paragraph_depth > 0 => {
                    push(output, "\n", flavor)?
                }
                "tab" if paragraph_depth > 0 => push(output, "\t", flavor)?,
                "s" if paragraph_depth > 0 && matches!(flavor, XmlFlavor::Odt) => {
                    push(output, " ", flavor)?
                }
                _ => {}
            },
            Ok(Event::Text(value)) if text_depth > 0 => push(output, value.as_ref(), flavor)?,
            Ok(Event::CData(value)) if text_depth > 0 => push(output, value.as_ref(), flavor)?,
            Ok(Event::GeneralRef(reference)) if text_depth > 0 => {
                if let Some(character) = reference
                    .resolve_char_ref()
                    .map_err(|_| unreadable(flavor))?
                {
                    let mut encoded = [0_u8; 4];
                    push(output, character.encode_utf8(&mut encoded), flavor)?;
                } else if let Some(entity) =
                    quick_xml::escape::resolve_xml_entity(reference.as_ref())
                {
                    push(output, entity, flavor)?;
                } else {
                    return Err(unreadable(flavor));
                }
            }
            Ok(Event::End(element)) => match element.local_name().as_ref() {
                "t" if matches!(flavor, XmlFlavor::Hwpx) => {
                    text_depth = text_depth.saturating_sub(1)
                }
                "p" | "h" => {
                    if !output.ends_with('\n') {
                        push(output, "\n", flavor)?;
                    }
                    paragraph_depth = paragraph_depth.saturating_sub(1);
                    if matches!(flavor, XmlFlavor::Odt) {
                        text_depth = text_depth.saturating_sub(1);
                    }
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(_) => return Err(unreadable(flavor)),
            _ => {}
        }
        buffer.clear();
    }
    Ok(())
}

fn finish(output: String, flavor: XmlFlavor) -> Result<String, ImportError> {
    let text = normalize(&output);
    if text.len() > MAX_TEXT_BYTES {
        return Err(text_limit(flavor));
    }
    if text.chars().all(char::is_whitespace) {
        return Err(without_text(flavor));
    }
    Ok(text)
}

fn push(output: &mut String, value: &str, flavor: XmlFlavor) -> Result<(), ImportError> {
    if output.len().saturating_add(value.len()) > MAX_TEXT_BYTES {
        return Err(text_limit(flavor));
    }
    output.push_str(value);
    Ok(())
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

fn preflight_entries(file: &mut File) -> Result<usize, ImportError> {
    let file_bytes = file
        .seek(SeekFrom::End(0))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let tail_bytes = file_bytes.min((EOCD_BYTES + MAX_COMMENT_BYTES) as u64);
    file.seek(SeekFrom::End(-(tail_bytes as i64)))
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let mut tail = vec![0; tail_bytes as usize];
    file.read_exact(&mut tail)
        .map_err(|_| ImportError::HwpxUnreadable)?;
    let offset = tail
        .windows(4)
        .rposition(|window| window == [0x50, 0x4b, 0x05, 0x06])
        .ok_or(ImportError::HwpxUnreadable)?;
    let eocd = tail
        .get(offset..)
        .filter(|bytes| bytes.len() >= EOCD_BYTES)
        .ok_or(ImportError::HwpxUnreadable)?;
    let comments = usize::from(u16::from_le_bytes([eocd[20], eocd[21]]));
    if eocd.len() != EOCD_BYTES + comments {
        return Err(ImportError::HwpxUnreadable);
    }
    let count = usize::from(u16::from_le_bytes([eocd[10], eocd[11]]));
    if count == usize::from(u16::MAX) || count > MAX_ZIP_ENTRIES {
        return Err(ImportError::HwpxEntryLimit);
    }
    Ok(count)
}

const fn unreadable(flavor: XmlFlavor) -> ImportError {
    match flavor {
        XmlFlavor::Hwpx => ImportError::HwpxUnreadable,
        XmlFlavor::Odt => ImportError::OdtUnreadable,
    }
}
const fn text_limit(flavor: XmlFlavor) -> ImportError {
    match flavor {
        XmlFlavor::Hwpx => ImportError::HwpxTextLimit,
        XmlFlavor::Odt => ImportError::OdtTextLimit,
    }
}
const fn without_text(flavor: XmlFlavor) -> ImportError {
    match flavor {
        XmlFlavor::Hwpx => ImportError::HwpxWithoutText,
        XmlFlavor::Odt => ImportError::OdtWithoutText,
    }
}
