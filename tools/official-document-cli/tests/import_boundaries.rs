use std::{fs::File, io::Write, path::Path};

use official_document_cli::import::{
    extract_document, ImportError, MAX_FILE_BYTES, MAX_PDF_PAGES, MAX_TEXT_BYTES, MAX_XML_BYTES,
    MAX_ZIP_ENTRIES,
};
use pdf_extract::{dictionary, Document, Object, Stream};
use tempfile::tempdir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

fn write_pdf(path: &Path, page_count: usize) {
    let mut document = Document::with_version("1.7");
    let font = document.add_object(
        dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica" },
    );
    let pages = document.new_object_id();
    let mut page_ids = Vec::new();
    for index in 0..page_count {
        let content = format!("BT /F1 10 Tf 50 750 Td (Readable page {index}) Tj ET");
        let content_id = document.add_object(Stream::new(dictionary! {}, content.into_bytes()));
        let page_id = document.new_object_id();
        document.objects.insert(page_id, Object::Dictionary(dictionary! {
            "Type" => "Page", "Parent" => Object::Reference(pages), "Contents" => Object::Reference(content_id),
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => Object::Reference(font) } },
        }));
        page_ids.push(page_id);
    }
    document.objects.insert(pages, Object::Dictionary(dictionary! {
        "Type" => "Pages", "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
        "Count" => page_ids.len() as i64, "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
    }));
    let catalog = document
        .add_object(dictionary! { "Type" => "Catalog", "Pages" => Object::Reference(pages) });
    document.trailer.set("Root", catalog);
    document.save(path).expect("PDF fixture");
}

fn write_zip(path: &Path, entries: impl IntoIterator<Item = (String, Vec<u8>)>) {
    let file = File::create(path).expect("fixture file");
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    for (name, contents) in entries {
        archive.start_file(name, options).expect("zip entry");
        archive.write_all(&contents).expect("zip contents");
    }
    archive.finish().expect("zip fixture");
}

#[test]
fn rejects_pdf_when_page_count_exceeds_fifty() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("too-many-pages.pdf");
    write_pdf(&path, MAX_PDF_PAGES + 1);

    // When
    let result = extract_document(&path);

    // Then
    assert_eq!(result, Err(ImportError::PdfPageLimit));
}

#[test]
fn accepts_pdf_when_page_count_is_exactly_fifty() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("page-boundary.pdf");
    write_pdf(&path, MAX_PDF_PAGES);

    // When
    let result = extract_document(&path).expect("boundary PDF");

    // Then
    assert!(result.text.contains("Readable page 49"));
}

#[test]
fn rejects_input_when_file_exceeds_fifteen_megabytes() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("oversized.pdf");
    File::create(&path)
        .expect("fixture")
        .set_len(MAX_FILE_BYTES + 1)
        .expect("sparse file");

    // When
    let result = extract_document(&path);

    // Then
    assert_eq!(result, Err(ImportError::FileTooLarge));
}

#[test]
fn rejects_hwpx_when_extracted_text_exceeds_two_megabytes() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("text-limit.hwpx");
    let xml = format!("<p><t>{}</t></p>", "x".repeat(MAX_TEXT_BYTES + 1));
    write_zip(
        &path,
        [("Contents/section0.xml".to_owned(), xml.into_bytes())],
    );

    // When
    let result = extract_document(&path);

    // Then
    assert_eq!(result, Err(ImportError::HwpxTextLimit));
}

#[test]
fn rejects_odt_when_xml_exceeds_eight_megabytes() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("xml-limit.odt");
    write_zip(
        &path,
        [(
            "content.xml".to_owned(),
            vec![b'x'; MAX_XML_BYTES as usize + 1],
        )],
    );

    // When
    let result = extract_document(&path);

    // Then
    assert_eq!(result, Err(ImportError::OdtXmlLimit));
}

#[test]
fn rejects_odt_when_zip_entry_count_exceeds_limit() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("entry-limit.odt");
    let entries = (0..=MAX_ZIP_ENTRIES).map(|index| (format!("entry-{index}"), Vec::new()));
    write_zip(&path, entries);

    // When
    let result = extract_document(&path);

    // Then
    assert_eq!(result, Err(ImportError::OdtEntryLimit));
}

#[test]
fn rejects_malformed_packages_without_exposing_parser_details() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("malformed.hwpx");
    std::fs::write(&path, b"not a zip").expect("fixture");

    // When
    let error = extract_document(&path).expect_err("malformed package");

    // Then
    assert_eq!(error, ImportError::HwpxUnreadable);
    assert_eq!(error.to_string(), "올바른 HWPX 문서를 읽지 못했습니다.");
}
