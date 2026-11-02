use std::io::{Cursor, Read, Write};

use official_document_cli::odt::{
    bundled_template, inspect_template, sha256_hex, transform_template, validate_template,
    ApprovedTemplateContract, OdtDocument, OdtError,
};
use quick_xml::{events::Event, Reader};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const HOME_SHA: &str = "8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285";
const BODY_BOOKMARK: &str = "NormalField1¡본문¡본문을 입력하십시오¡T¡F";

#[test]
fn bundled_template_matches_pinned_provenance_and_contract() {
    // Given
    let template = bundled_template();

    // When
    let manifest = validate_template(template, &ApprovedTemplateContract::home_v1())
        .expect("embedded approved template");

    // Then
    assert_eq!(sha256_hex(template), HOME_SHA);
    assert_eq!(
        (
            manifest.bookmarks.len(),
            manifest.table_count,
            manifest.frame_count
        ),
        (43, 4, 4)
    );
    assert_eq!(manifest.style_reference_count, 255);
}

#[test]
fn transform_preserves_title_body_attachments_spaces_and_structure() {
    // Given
    let title = "합성 <보건교육> & 운영 계획";
    let body = "1. 합성 본문\n  가. 선행 공백\n\n붙임  합성 확인표 1부.  끝.";
    let document = OdtDocument {
        title,
        body,
        attachments: "붙임\n1. 합성 확인표 1부.\n끝.",
        has_table_text: false,
    };

    // When
    let output = transform_template(
        bundled_template(),
        &ApprovedTemplateContract::home_v1(),
        document,
    )
    .expect("valid canonical document");

    // Then
    let content = read_entry(&output, "content.xml");
    assert!(
        content.contains("합성<text:s/>&lt;보건교육&gt;<text:s/>&amp;<text:s/>운영<text:s/>계획")
    );
    let restored = restore_body(&content);
    assert_eq!(restored, body);
    assert_eq!(restored.matches("합성 확인표").count(), 1);
    assert_eq!(
        read_entry(&output, "meta.xml"),
        official_document_cli::odt::CLEAN_META
    );
    let source = inspect_template(bundled_template()).expect("source manifest");
    let observed = inspect_template(&output).expect("output manifest");
    assert_eq!(observed.bookmarks, source.bookmarks);
    assert_eq!(
        observed.style_reference_sha256,
        source.style_reference_sha256
    );
}

#[test]
fn rejects_noncanonical_title_body_attachment_and_tracked_change_inputs() {
    // Given
    let contract = ApprovedTemplateContract::home_v1();
    let cases = [
        (
            OdtDocument {
                title: "line\nbreak",
                body: "본문  끝.",
                attachments: "",
                has_table_text: false,
            },
            OdtError::UnsupportedFormat("tabs or title line breaks"),
        ),
        (
            OdtDocument {
                title: "제목",
                body: "본문 끝. 끝.",
                attachments: "",
                has_table_text: false,
            },
            OdtError::InvalidCanonicalBody,
        ),
        (
            OdtDocument {
                title: "제목",
                body: "본문  끝.\n후행",
                attachments: "",
                has_table_text: false,
            },
            OdtError::InvalidCanonicalBody,
        ),
        (
            OdtDocument {
                title: "제목",
                body: "본문  끝.",
                attachments: "붙임\n1. 없는 파일 1부.\n끝.",
                has_table_text: false,
            },
            OdtError::InvalidCanonicalBody,
        ),
        (
            OdtDocument {
                title: "제목",
                body: "본문  끝.",
                attachments: "",
                has_table_text: true,
            },
            OdtError::UnsupportedFormat("table text"),
        ),
    ];

    // When / Then
    for (document, expected) in cases {
        assert_eq!(
            transform_template(bundled_template(), &contract, document),
            Err(expected)
        );
    }
    let mut tampered = bundled_template().to_vec();
    tampered.push(0);
    assert_eq!(
        transform_template(
            &tampered,
            &contract,
            OdtDocument {
                title: "제목",
                body: "본문  끝.",
                attachments: "",
                has_table_text: false
            }
        ),
        Err(OdtError::HashMismatch)
    );
}

#[test]
fn rejects_tracked_changes_after_the_full_template_contract_passes() {
    // Given
    let unsafe_template = rewrite_content(|content| {
        content.replace("<office:text>", "<office:text><text:tracked-changes/>")
    });
    let manifest = inspect_template(&unsafe_template).expect("inspectable mutated package");
    let contract = ApprovedTemplateContract {
        sha256: sha256_hex(&unsafe_template),
        zip_entries: manifest.zip_entries,
        bookmarks: manifest.bookmarks,
        table_count: manifest.table_count,
        frame_count: manifest.frame_count,
        style_reference_count: manifest.style_reference_count,
        style_reference_sha256: manifest.style_reference_sha256,
    };

    // When
    let result = transform_template(
        &unsafe_template,
        &contract,
        OdtDocument {
            title: "합성 제목",
            body: "합성 본문  끝.",
            attachments: "",
            has_table_text: false,
        },
    );

    // Then
    assert_eq!(
        result,
        Err(OdtError::UnsupportedFormat(
            "tracked changes or author metadata"
        ))
    );
}

fn read_entry(bytes: &[u8], name: &str) -> String {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).expect("valid ODT");
    let mut value = String::new();
    archive
        .by_name(name)
        .expect("entry")
        .read_to_string(&mut value)
        .expect("UTF-8 XML");
    value
}

fn rewrite_content(transform: impl FnOnce(String) -> String) -> Vec<u8> {
    let mut source =
        ZipArchive::new(Cursor::new(bundled_template())).expect("approved template ZIP");
    let mut entries = Vec::with_capacity(source.len());
    for index in 0..source.len() {
        let mut entry = source.by_index(index).expect("template entry");
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).expect("template bytes");
        entries.push((entry.name().to_owned(), bytes));
    }
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let mut transform = Some(transform);
    for (name, bytes) in entries {
        let output = if name == "content.xml" {
            transform.take().expect("one content transform")(
                String::from_utf8(bytes).expect("content UTF-8"),
            )
            .into_bytes()
        } else {
            bytes
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
            .expect("output entry");
        writer.write_all(&output).expect("output bytes");
    }
    writer.finish().expect("output ZIP").into_inner()
}

fn restore_body(xml: &str) -> String {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut output = String::new();
    let mut inside = false;
    loop {
        match reader.read_event().expect("well-formed content XML") {
            Event::Start(element) | Event::Empty(element) => match element.name().as_ref() {
                "text:bookmark-start" | "text:bookmark-end" => {
                    let name = element
                        .try_get_attribute("text:name")
                        .expect("attribute parse");
                    if name.as_ref().map(|value| value.value.as_ref()) == Some(BODY_BOOKMARK) {
                        inside = element.name().as_ref() == "text:bookmark-start";
                    }
                }
                "text:s" if inside => {
                    let count = element
                        .try_get_attribute("text:c")
                        .expect("space attribute")
                        .map(|value| value.value.parse::<usize>().expect("number"))
                        .unwrap_or(1);
                    output.push_str(&" ".repeat(count));
                }
                "text:line-break" if inside => output.push('\n'),
                _ => {}
            },
            Event::Text(text) if inside => output.push_str(text.as_ref()),
            Event::GeneralRef(reference) if inside => {
                if let Some(character) = reference.resolve_char_ref().expect("character reference")
                {
                    output.push(character);
                } else {
                    output.push_str(
                        quick_xml::escape::resolve_xml_entity(reference.as_ref()).expect("entity"),
                    );
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }
    output
}
