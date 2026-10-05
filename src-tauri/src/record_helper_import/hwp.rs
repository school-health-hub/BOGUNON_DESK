use std::{fs::File, io::Read, path::Path};

use cfb::CompoundFile;
use flate2::read::DeflateDecoder;

use super::{
    hwp_text::parse_para_text_payload,
    util::{ensure_has_text, normalize_extracted_text, push_limited, ImportError},
};

const FILE_HEADER_SIGNATURE: &[u8] = b"HWP Document File";
const FILE_HEADER_BYTES: usize = 256;
const HWP_VERSION_OFFSET: usize = 32;
const HWP_PROPERTIES_OFFSET: usize = 36;
const HWP_MAJOR_VERSION: u32 = 5;
const HWP_PROPERTY_COMPRESSED: u32 = 1;
const HWP_PROPERTY_PASSWORD: u32 = 1 << 1;
const HWP_PROPERTY_DISTRIBUTION: u32 = 1 << 2;
const HWP_PROPERTY_DRM: u32 = 1 << 4;
const HWP_PROPERTY_CERTIFICATE: u32 = 1 << 8;
const HWP_PROPERTY_CERTIFICATE_DRM: u32 = 1 << 10;
const HWP_PROPERTY_PRIVACY_SECURITY: u32 = 1 << 13;
const HWP_SECTION_LIMIT: usize = 64;
const HWP_RECORD_LIMIT: usize = 100_000;
const HWP_DECOMPRESSED_BYTES: usize = 8 * 1024 * 1024;
const HWP_TAG_PARA_TEXT: u16 = 67;
const HWP_RECORD_EXTENDED_SIZE: usize = 0x0fff;

fn read_stream(
    compound: &mut CompoundFile<File>,
    name: &str,
    limit: usize,
    limit_error: ImportError,
) -> Result<Vec<u8>, ImportError> {
    let stream = compound
        .open_stream(name)
        .map_err(|_| ImportError::Unreadable)?;
    let mut bytes = Vec::new();
    let read_limit = u64::try_from(limit)
        .map_err(|_| ImportError::Unreadable)?
        .saturating_add(1);
    stream
        .take(read_limit)
        .read_to_end(&mut bytes)
        .map_err(|_| ImportError::Unreadable)?;
    if bytes.len() > limit {
        return Err(limit_error);
    }
    Ok(bytes)
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ImportError> {
    let Some(value) = bytes.get(offset..offset.saturating_add(4)) else {
        return Err(ImportError::Unreadable);
    };
    let value: [u8; 4] = value.try_into().map_err(|_| ImportError::Unreadable)?;
    Ok(u32::from_le_bytes(value))
}

fn read_header(compound: &mut CompoundFile<File>) -> Result<u32, ImportError> {
    let bytes = read_stream(
        compound,
        "FileHeader",
        FILE_HEADER_BYTES,
        ImportError::Unreadable,
    )?;
    if bytes.len() < FILE_HEADER_BYTES || !bytes.starts_with(FILE_HEADER_SIGNATURE) {
        return Err(ImportError::Unreadable);
    }
    let version = read_u32(&bytes, HWP_VERSION_OFFSET)?;
    if version >> 24 != HWP_MAJOR_VERSION {
        return Err(ImportError::HwpUnsupportedVersion);
    }
    let properties = read_u32(&bytes, HWP_PROPERTIES_OFFSET)?;
    let unsupported = HWP_PROPERTY_PASSWORD
        | HWP_PROPERTY_DISTRIBUTION
        | HWP_PROPERTY_DRM
        | HWP_PROPERTY_CERTIFICATE
        | HWP_PROPERTY_CERTIFICATE_DRM
        | HWP_PROPERTY_PRIVACY_SECURITY;
    if properties & unsupported != 0 {
        return Err(ImportError::HwpUnsupportedSecurity);
    }
    Ok(properties)
}

fn section_paths(compound: &CompoundFile<File>) -> Result<Vec<String>, ImportError> {
    let mut sections = Vec::new();
    for entry in compound
        .walk_storage("BodyText")
        .map_err(|_| ImportError::Unreadable)?
    {
        let Some(name) = entry.path().file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(number) = name
            .strip_prefix("Section")
            .and_then(|value| value.parse::<u32>().ok())
        else {
            continue;
        };
        sections.push((number, format!("BodyText/{name}")));
    }
    if sections.is_empty() {
        return Err(ImportError::Unreadable);
    }
    if sections.len() > HWP_SECTION_LIMIT {
        return Err(ImportError::HwpSectionLimit);
    }
    sections.sort_unstable_by_key(|(number, _)| *number);
    Ok(sections.into_iter().map(|(_, path)| path).collect())
}

fn inflate_raw_deflate(bytes: &[u8], limit: usize) -> Result<Vec<u8>, ImportError> {
    let mut decoder = DeflateDecoder::new(bytes);
    let mut output = Vec::new();
    let read_limit = u64::try_from(limit)
        .map_err(|_| ImportError::Unreadable)?
        .saturating_add(1);
    decoder
        .by_ref()
        .take(read_limit)
        .read_to_end(&mut output)
        .map_err(|_| ImportError::Unreadable)?;
    if output.len() > limit {
        return Err(ImportError::HwpDataLimit);
    }
    Ok(output)
}

fn parse_records(
    bytes: &[u8],
    output: &mut String,
    records_seen: &mut usize,
) -> Result<(), ImportError> {
    let mut offset = 0_usize;
    while offset + 4 <= bytes.len() {
        *records_seen = records_seen.saturating_add(1);
        if *records_seen > HWP_RECORD_LIMIT {
            return Err(ImportError::HwpRecordLimit);
        }
        let header = u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]);
        offset += 4;
        let tag = u16::try_from(header & 0x03ff).map_err(|_| ImportError::Unreadable)?;
        let mut size =
            usize::try_from((header >> 20) & 0x0fff).map_err(|_| ImportError::Unreadable)?;
        if size == HWP_RECORD_EXTENDED_SIZE {
            if offset + 4 > bytes.len() {
                return Err(ImportError::Unreadable);
            }
            size = usize::try_from(u32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]))
            .map_err(|_| ImportError::Unreadable)?;
            offset += 4;
        }
        let end = offset
            .checked_add(size)
            .filter(|end| *end <= bytes.len())
            .ok_or(ImportError::Unreadable)?;
        if tag == HWP_TAG_PARA_TEXT {
            let payload = &bytes[offset..end];
            parse_para_text_payload(payload, output)?;
            if !output.ends_with('\n') {
                push_limited(output, "\n")?;
            }
        }
        offset = end;
    }
    if offset != bytes.len() {
        return Err(ImportError::Unreadable);
    }
    Ok(())
}

pub(super) fn extract_hwp_text_with_body_limit(
    path: &Path,
    body_limit: usize,
) -> Result<String, ImportError> {
    let file = File::open(path).map_err(|_| ImportError::Unreadable)?;
    let mut compound = CompoundFile::open(file).map_err(|_| ImportError::Unreadable)?;
    let properties = read_header(&mut compound)?;
    let sections = section_paths(&compound)?;
    let compressed = properties & HWP_PROPERTY_COMPRESSED != 0;
    let mut output = String::new();
    let mut records_seen = 0_usize;
    let mut remaining_body_bytes = body_limit;
    for section in sections {
        let section_bytes = if compressed {
            let bytes = read_stream(
                &mut compound,
                &section,
                HWP_DECOMPRESSED_BYTES,
                ImportError::HwpDataLimit,
            )?;
            inflate_raw_deflate(&bytes, remaining_body_bytes)?
        } else {
            read_stream(
                &mut compound,
                &section,
                remaining_body_bytes,
                ImportError::HwpDataLimit,
            )?
        };
        remaining_body_bytes = remaining_body_bytes
            .checked_sub(section_bytes.len())
            .ok_or(ImportError::HwpDataLimit)?;
        parse_records(&section_bytes, &mut output, &mut records_seen)?;
    }
    ensure_has_text(normalize_extracted_text(&output))
}

pub fn extract_hwp_text(path: &Path) -> Result<String, ImportError> {
    extract_hwp_text_with_body_limit(path, HWP_DECOMPRESSED_BYTES)
}
