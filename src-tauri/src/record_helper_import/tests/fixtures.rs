use std::{
    fs::File,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use flate2::{write::DeflateEncoder, Compression};
use pdf_extract::{dictionary, Document, Object, Stream};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

pub(super) const TEST_FILE_HEADER_BYTES: usize = 256;
pub(super) const TEST_FILE_HEADER_SIGNATURE: &[u8] = b"HWP Document File";
pub(super) const TEST_HWP_VERSION_OFFSET: usize = 32;
pub(super) const TEST_HWP_PROPERTIES_OFFSET: usize = 36;
pub(super) const TEST_HWP_PROPERTY_COMPRESSED: u32 = 1;
pub(super) const TEST_HWP_PROPERTY_PRIVACY_SECURITY: u32 = 1 << 13;
pub(super) const TEST_HWP_TAG_PARA_TEXT: u32 = 67;
pub(super) const TEST_MAX_FILE_BYTES: u64 = 15 * 1024 * 1024;
pub(super) const TEST_MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;
pub(super) const TEST_MAX_BATCH_FILES: usize = 50;
pub(super) const TEST_MAX_HWP_SECTIONS: usize = 64;
pub(super) const TEST_MAX_HWP_RECORDS: usize = 100_000;
pub(super) const TEST_MAX_HWP_DECOMPRESSED_BYTES: usize = 8 * 1024 * 1024;
pub(super) const TEST_MAX_ZIP_ENTRIES: usize = 1024;
pub(super) const TEST_MAX_XML_BYTES: usize = 8 * 1024 * 1024;
pub(super) const TEST_MAX_PDF_PAGES: usize = 50;

pub(super) fn fixture_path(name: &str, extension: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("record-helper-{nonce}-{name}.{extension}"))
}

pub(super) fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
    let file = File::create(path).unwrap();
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    for (name, contents) in entries {
        archive.start_file(*name, options).unwrap();
        archive.write_all(contents).unwrap();
    }
    archive.finish().unwrap();
}

pub(super) fn write_zip_with_entry_count(path: &Path, entry_count: usize, section_xml: &[u8]) {
    let file = File::create(path).unwrap();
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    archive
        .start_file("Contents/section0.xml", options)
        .unwrap();
    archive.write_all(section_xml).unwrap();
    for index in 1..entry_count {
        archive
            .start_file(format!("Metadata/entry{index}.bin"), options)
            .unwrap();
        archive.write_all(b"x").unwrap();
    }
    archive.finish().unwrap();
}

pub(super) fn write_hwpx(name: &str, text: &str) -> PathBuf {
    let path = fixture_path(name, "hwpx");
    let xml = format!(
        r#"<hp:section xmlns:hp="urn:test"><hp:p><hp:run><hp:t>{text}</hp:t></hp:run></hp:p></hp:section>"#
    );
    write_zip(&path, &[("Contents/section0.xml", xml.as_bytes())]);
    path
}

pub(super) fn write_docx(name: &str, text: &str) -> PathBuf {
    let path = fixture_path(name, "docx");
    let xml = format!(
        r#"<w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"#
    );
    write_zip(&path, &[("word/document.xml", xml.as_bytes())]);
    path
}

pub(super) fn write_pdf(name: &str, pages: &[&str]) -> PathBuf {
    let path = fixture_path(name, "pdf");
    let mut document = Document::with_version("1.7");
    let font_id = document.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica", "Encoding" => "WinAnsiEncoding",
    });
    let pages_id = document.new_object_id();
    let mut page_ids = Vec::new();
    for page_text in pages {
        let escaped = page_text
            .replace('\\', "\\\\")
            .replace('(', "\\(")
            .replace(')', "\\)");
        let content_id = document.add_object(Stream::new(
            dictionary! {},
            format!("BT /F1 10 Tf 50 750 Td ({escaped}) Tj ET").into_bytes(),
        ));
        let page_id = document.new_object_id();
        document.objects.insert(page_id, Object::Dictionary(dictionary! {
            "Type" => "Page", "Parent" => Object::Reference(pages_id), "Contents" => Object::Reference(content_id),
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => Object::Reference(font_id) } },
        }));
        page_ids.push(page_id);
    }
    document.objects.insert(pages_id, Object::Dictionary(dictionary! {
        "Type" => "Pages", "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
        "Count" => i64::try_from(page_ids.len()).unwrap(), "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
    }));
    let catalog_id = document
        .add_object(dictionary! { "Type" => "Catalog", "Pages" => Object::Reference(pages_id) });
    document.trailer.set("Root", catalog_id);
    document.save(&path).unwrap();
    path
}

pub(super) fn hwp_text_record(text: &str) -> Vec<u8> {
    let units = text.encode_utf16().collect::<Vec<_>>();
    hwp_text_record_from_units(&units)
}

pub(super) fn hwp_text_record_from_units(units: &[u16]) -> Vec<u8> {
    let payload = units
        .iter()
        .copied()
        .flat_map(u16::to_le_bytes)
        .collect::<Vec<_>>();
    hwp_record_from_payload(TEST_HWP_TAG_PARA_TEXT, &payload)
}

pub(super) fn hwp_record_from_payload(tag: u32, payload: &[u8]) -> Vec<u8> {
    let payload_len = u32::try_from(payload.len()).unwrap();
    let header = tag | (payload_len << 20);
    let mut record = header.to_le_bytes().to_vec();
    record.extend_from_slice(payload);
    record
}

pub(super) fn hwp_empty_record() -> Vec<u8> {
    1_u32.to_le_bytes().to_vec()
}

pub(super) fn write_hwp(name: &str, text: &str, properties: u32, version: u32) -> PathBuf {
    write_hwp_sections(name, &[hwp_text_record(text)], properties, version)
}

pub(super) fn write_hwp_sections(
    name: &str,
    sections: &[Vec<u8>],
    properties: u32,
    version: u32,
) -> PathBuf {
    let path = fixture_path(name, "hwp");
    let mut compound = cfb::create(&path).unwrap();
    let mut header = [0_u8; TEST_FILE_HEADER_BYTES];
    header[..TEST_FILE_HEADER_SIGNATURE.len()].copy_from_slice(TEST_FILE_HEADER_SIGNATURE);
    header[TEST_HWP_VERSION_OFFSET..TEST_HWP_VERSION_OFFSET + 4]
        .copy_from_slice(&version.to_le_bytes());
    header[TEST_HWP_PROPERTIES_OFFSET..TEST_HWP_PROPERTIES_OFFSET + 4]
        .copy_from_slice(&properties.to_le_bytes());
    compound
        .create_stream("FileHeader")
        .unwrap()
        .write_all(&header)
        .unwrap();
    compound.create_storage("BodyText").unwrap();
    for (index, section) in sections.iter().enumerate() {
        let bytes = if properties & TEST_HWP_PROPERTY_COMPRESSED == 0 {
            section.clone()
        } else {
            let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
            encoder.write_all(section).unwrap();
            encoder.finish().unwrap()
        };
        compound
            .create_stream(format!("BodyText/Section{index}"))
            .unwrap()
            .write_all(&bytes)
            .unwrap();
    }
    path
}
