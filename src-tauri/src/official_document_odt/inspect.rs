use std::{
    collections::BTreeMap,
    io::{Cursor, Read},
};

use quick_xml::{
    events::{BytesStart, Event},
    Reader, XmlVersion,
};
use sha2::{Digest, Sha256};
use zip::ZipArchive;

use super::{BookmarkKind, BookmarkRule, TemplateContractError, ZipEntryRule};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TemplateManifest {
    pub(crate) zip_entries: Vec<ZipEntryRule>,
    pub(crate) bookmarks: Vec<BookmarkRule>,
    pub(crate) table_count: usize,
    pub(crate) frame_count: usize,
    pub(crate) style_reference_count: usize,
    pub(crate) style_reference_sha256: String,
}

#[derive(Debug)]
struct ElementFrame {
    path: String,
    children: BTreeMap<String, usize>,
}

pub(crate) fn inspect_template(bytes: &[u8]) -> Result<TemplateManifest, TemplateContractError> {
    let zip_entries = inspect_local_headers(bytes)?;
    let mut archive =
        ZipArchive::new(Cursor::new(bytes)).map_err(|_| TemplateContractError::InvalidPackage)?;
    let mut content = String::new();
    archive
        .by_name("content.xml")
        .map_err(|_| TemplateContractError::InvalidPackage)?
        .read_to_string(&mut content)
        .map_err(|_| TemplateContractError::InvalidPackage)?;
    inspect_content(&content, zip_entries)
}

fn inspect_local_headers(bytes: &[u8]) -> Result<Vec<ZipEntryRule>, TemplateContractError> {
    let mut offset = 0_usize;
    let mut entries = Vec::new();
    while bytes.get(offset..offset + 4) == Some(&[0x50, 0x4b, 0x03, 0x04]) {
        let fixed = bytes
            .get(offset..offset + 30)
            .ok_or(TemplateContractError::InvalidPackage)?;
        let flags = u16::from_le_bytes([fixed[6], fixed[7]]);
        let method = u16::from_le_bytes([fixed[8], fixed[9]]);
        let compressed_size = usize::try_from(u32::from_le_bytes([
            fixed[18], fixed[19], fixed[20], fixed[21],
        ]))
        .map_err(|_| TemplateContractError::InvalidPackage)?;
        let name_len = usize::from(u16::from_le_bytes([fixed[26], fixed[27]]));
        let extra_len = usize::from(u16::from_le_bytes([fixed[28], fixed[29]]));
        let name_start = offset + 30;
        let name_end = name_start + name_len;
        let name = std::str::from_utf8(
            bytes
                .get(name_start..name_end)
                .ok_or(TemplateContractError::InvalidPackage)?,
        )
        .map_err(|_| TemplateContractError::InvalidPackage)?
        .to_owned();
        entries.push(ZipEntryRule {
            name,
            method,
            flags,
            extra_len,
        });
        offset = name_end
            .checked_add(extra_len)
            .and_then(|next| next.checked_add(compressed_size))
            .ok_or(TemplateContractError::InvalidPackage)?;
    }
    if entries.is_empty() {
        return Err(TemplateContractError::InvalidPackage);
    }
    Ok(entries)
}

fn inspect_content(
    xml: &str,
    zip_entries: Vec<ZipEntryRule>,
) -> Result<TemplateManifest, TemplateContractError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut stack: Vec<ElementFrame> = Vec::new();
    let mut bookmarks = Vec::new();
    let mut table_count = 0_usize;
    let mut frame_count = 0_usize;
    let mut style_refs: BTreeMap<String, usize> = BTreeMap::new();
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) => visit_element(
                &element,
                true,
                &mut stack,
                &mut bookmarks,
                &mut table_count,
                &mut frame_count,
                &mut style_refs,
            )?,
            Ok(Event::Empty(element)) => visit_element(
                &element,
                false,
                &mut stack,
                &mut bookmarks,
                &mut table_count,
                &mut frame_count,
                &mut style_refs,
            )?,
            Ok(Event::End(_)) => {
                stack.pop();
            }
            Ok(Event::Eof) => break,
            Err(_) => return Err(TemplateContractError::InvalidPackage),
            _ => {}
        }
        buffer.clear();
    }
    let canonical = style_refs
        .iter()
        .map(|(name, count)| format!("{name}={count}"))
        .collect::<Vec<_>>()
        .join("\n");
    let style_reference_sha256 = Sha256::digest(canonical.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect();
    Ok(TemplateManifest {
        zip_entries,
        bookmarks,
        table_count,
        frame_count,
        style_reference_count: style_refs.values().sum(),
        style_reference_sha256,
    })
}

fn visit_element(
    element: &BytesStart<'_>,
    push: bool,
    stack: &mut Vec<ElementFrame>,
    bookmarks: &mut Vec<BookmarkRule>,
    table_count: &mut usize,
    frame_count: &mut usize,
    style_refs: &mut BTreeMap<String, usize>,
) -> Result<(), TemplateContractError> {
    let local = element.local_name().as_ref().to_owned();
    let index = stack
        .last_mut()
        .map(|parent| {
            let index = *parent.children.get(&local).unwrap_or(&0);
            parent.children.insert(local.clone(), index + 1);
            index
        })
        .unwrap_or(0);
    let path = stack
        .last()
        .map(|parent| format!("{}/{}[{}]", parent.path, local, index))
        .unwrap_or_else(|| format!("{}[0]", local));
    match local.as_str() {
        "table" => *table_count += 1,
        "frame" => *frame_count += 1,
        _ => {}
    }
    for attribute in element.attributes() {
        let attribute = attribute.map_err(|_| TemplateContractError::InvalidPackage)?;
        let local_name = attribute.key.local_name();
        let key = local_name.as_ref();
        if key == "style-name" {
            let value = attribute
                .normalized_value(XmlVersion::Implicit1_0)
                .map_err(|_| TemplateContractError::InvalidPackage)?
                .into_owned();
            *style_refs.entry(value).or_default() += 1;
        }
    }
    let kind = match local.as_str() {
        "bookmark" => Some(BookmarkKind::Point),
        "bookmark-start" => Some(BookmarkKind::Start),
        "bookmark-end" => Some(BookmarkKind::End),
        _ => None,
    };
    if let Some(kind) = kind {
        let name = element
            .attributes()
            .find_map(|result| {
                result
                    .ok()
                    .filter(|attribute| attribute.key.local_name().as_ref() == "name")
            })
            .ok_or(TemplateContractError::InvalidPackage)?
            .normalized_value(XmlVersion::Implicit1_0)
            .map_err(|_| TemplateContractError::InvalidPackage)?
            .into_owned();
        bookmarks.push(BookmarkRule {
            kind,
            name,
            path: path.clone(),
        });
    }
    if push {
        stack.push(ElementFrame {
            path,
            children: BTreeMap::new(),
        });
    }
    Ok(())
}
