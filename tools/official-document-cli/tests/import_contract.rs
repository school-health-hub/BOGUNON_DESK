use std::{fs::File, io::Write};

use official_document_cli::import::{extract_document, ImportError, OfficialDocumentFormat};
use tempfile::tempdir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

fn write_zip(path: &std::path::Path, entries: &[(&str, &str)]) {
    let file = File::create(path).expect("fixture file");
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    for (name, contents) in entries {
        archive.start_file(*name, options).expect("zip entry");
        archive
            .write_all(contents.as_bytes())
            .expect("zip contents");
    }
    archive.finish().expect("zip fixture");
}

#[test]
fn extracts_hwpx_in_numeric_section_order_when_package_is_valid() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("ordered.hwpx");
    write_zip(
        &path,
        &[
            ("Contents/section10.xml", "<p><t>third</t></p>"),
            (
                "Contents/section2.xml",
                "<p><t>second&amp;value</t><tab/><t>tab</t><lineBreak/><t>line</t></p>",
            ),
            ("Contents/section0.xml", "<p><t>first</t></p>"),
        ],
    );

    // When
    let result = extract_document(&path).expect("valid HWPX");

    // Then
    assert_eq!(result.format, OfficialDocumentFormat::Hwpx);
    assert_eq!(result.source_name, "ordered.hwpx");
    assert_eq!(result.text, "first\nsecond&value\ttab\nline\nthird");
}

#[test]
fn extracts_odt_controls_and_entities_when_content_is_valid() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("controls.odt");
    write_zip(
        &path,
        &[(
            "content.xml",
            r#"<office:document-content xmlns:office="urn:o" xmlns:text="urn:t"><office:body><office:text><text:h>제목</text:h><text:p>첫 문단<text:tab/>탭<text:line-break/>줄&amp;값<text:s/>끝</text:p></office:text></office:body></office:document-content>"#,
        )],
    );

    // When
    let result = extract_document(&path).expect("valid ODT");

    // Then
    assert_eq!(result.format, OfficialDocumentFormat::Odt);
    assert_eq!(result.text, "제목\n첫 문단\t탭\n줄&값 끝");
}

#[test]
fn returns_stable_korean_error_when_extension_is_unsupported() {
    // Given
    let directory = tempdir().expect("temp directory");
    let path = directory.path().join("private-folder.txt");
    std::fs::write(&path, "unsupported").expect("fixture");

    // When
    let error = extract_document(&path).expect_err("unsupported extension");

    // Then
    assert_eq!(error, ImportError::UnsupportedExtension);
    assert_eq!(
        error.to_string(),
        "PDF, ODT 또는 HWPX 파일만 가져올 수 있습니다."
    );
    assert!(!error
        .to_string()
        .contains(directory.path().to_string_lossy().as_ref()));
}
