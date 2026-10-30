use std::io::{Cursor, Read, Write};

use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use super::{
    inspect_template, sha256_hex, transform_template, validate_template, ApprovedTemplateContract,
    BookmarkKind, OdtExportDocument, OdtTransformError, TemplateContractError,
};

const POINT_NAMES: [&str; 41] = [
    "CellField1¡머리표어¡F",
    "CellField2¡로고¡F",
    "CellField3¡발신기관명¡F",
    "CellField4¡심볼¡F",
    "CellField5¡수신¡F",
    "CellField6¡경유¡F",
    "CellField7¡결재제목¡T",
    "CellField8¡관인¡T",
    "CellField9¡발신명의¡F",
    "CellField10¡관인생략¡F",
    "CellField11¡수신처캡션¡F",
    "CellField12¡수신처¡F",
    "CellField13¡서식버전-201212¡F",
    "CellField14¡직위.1¡F",
    "CellField15¡서명.1¡F",
    "CellField16¡직위.2¡F",
    "CellField17¡서명.2¡F",
    "CellField18¡직위.3¡F",
    "CellField19¡서명.3¡F",
    "CellField20¡직위.4¡F",
    "CellField21¡서명.4¡F",
    "CellField22¡협조직위.1¡F",
    "CellField23¡협조.1¡F",
    "CellField24¡협조직위.2¡F",
    "CellField25¡협조.2¡F",
    "CellField26¡협조직위.3¡F",
    "CellField27¡협조.3¡F",
    "CellField28¡협조직위.4¡F",
    "CellField29¡협조.4¡F",
    "CellField30¡문서번호¡F",
    "CellField31¡시행일자¡F",
    "CellField32¡접수번호¡F",
    "CellField33¡접수일자¡F",
    "CellField34¡우편번호¡T",
    "CellField35¡주소¡T",
    "CellField36¡홈페이지¡T",
    "CellField37¡전화¡T",
    "CellField38¡전송¡T",
    "CellField39¡이메일¡T",
    "CellField40¡공개여부¡F",
    "CellField41¡꼬리표어¡T",
];
const BODY: &str = "NormalField1¡본문¡본문을 입력하십시오¡T¡F";

#[test]
fn accepts_exact_synthetic_contract_when_all_observables_match() {
    // Given
    let bytes = fixture(None);
    let contract = contract_for(&bytes);
    // When
    let manifest = validate_template(&bytes, &contract).expect("synthetic contract should pass");
    // Then
    assert_eq!(manifest.bookmarks.len(), 43);
    assert_eq!(
        manifest
            .bookmarks
            .iter()
            .filter(|rule| rule.kind == BookmarkKind::Point)
            .count(),
        41
    );
    assert_eq!((manifest.table_count, manifest.frame_count), (4, 4));
}

#[test]
fn rejects_synthetic_template_when_production_sha_is_required() {
    // Given
    let synthetic = fixture(None);
    // When
    let result = validate_template(&synthetic, &ApprovedTemplateContract::production());
    // Then
    assert_eq!(result, Err(TemplateContractError::ShaMismatch));
}

#[test]
fn production_contract_matches_approved_template_local_headers() {
    // Given
    let contract = ApprovedTemplateContract::production();
    // When
    let entries = contract.zip_entries;
    // Then
    assert_eq!(entries.len(), 6);
    assert!(entries
        .iter()
        .all(|entry| entry.method == 8 && entry.flags == 4 && entry.extra_len == 17));
}

#[test]
fn rejects_missing_duplicate_moved_wrong_type_and_range_mismatch() {
    // Given
    let baseline = fixture(None);
    let contract = contract_for(&baseline);
    for mutation in [
        "missing",
        "duplicate",
        "moved",
        "reordered",
        "wrong-type",
        "range-mismatch",
    ] {
        // When
        let bytes = fixture(Some(mutation));
        let mut injected = contract.clone();
        injected.sha256 = sha256_hex(&bytes);
        // Then
        assert_eq!(
            validate_template(&bytes, &injected),
            Err(TemplateContractError::StructureMismatch(
                "bookmark contract"
            )),
            "mutation {mutation} must fail"
        );
    }
}

#[test]
fn rejects_zip_order_method_flags_and_extra_field_mismatch() {
    // Given
    let bytes = fixture(None);
    let contract = contract_for(&bytes);
    for mutation in ["order", "method", "flags", "extra"] {
        // When
        let mut injected = contract.clone();
        match mutation {
            "order" => injected.zip_entries.swap(0, 1),
            "method" => injected.zip_entries[1].method = 0,
            "flags" => injected.zip_entries[1].flags = 1,
            "extra" => injected.zip_entries[1].extra_len = 1,
            _ => unreachable!(),
        }
        // Then
        assert_eq!(
            validate_template(&bytes, &injected),
            Err(TemplateContractError::StructureMismatch(
                "ZIP entry contract"
            ))
        );
    }
}

#[test]
fn rejects_table_frame_and_style_reference_drift() {
    // Given
    let bytes = fixture(None);
    let contract = contract_for(&bytes);
    for mutation in ["table", "frame", "style"] {
        // When
        let mut injected = contract.clone();
        match mutation {
            "table" => injected.table_count += 1,
            "frame" => injected.frame_count += 1,
            "style" => injected.style_reference_sha256 = "00".repeat(32),
            _ => unreachable!(),
        }
        // Then
        assert!(matches!(
            validate_template(&bytes, &injected),
            Err(TemplateContractError::StructureMismatch(_))
        ));
    }
}

#[test]
fn rejects_malformed_input_without_panicking() {
    // Given
    let bytes = b"not an ODT";
    let mut contract = ApprovedTemplateContract::production();
    contract.sha256 = sha256_hex(bytes);
    // When
    let result = validate_template(bytes, &contract);
    // Then
    assert_eq!(result, Err(TemplateContractError::InvalidPackage));
}

#[test]
fn transforms_only_field_text_while_preserving_the_structural_contract() {
    // Given
    let template = fixture(None);
    let contract = contract_for(&template);
    let body = "1. 관련: 합성 & 교육\n  가. 대상: <합성 학생>\n붙임  합성 계획서 1부.  끝.";
    // When
    let output = transform_template(
        &template,
        &contract,
        OdtExportDocument {
            title: "합성 <보건교육> & 운영 계획",
            body,
            attachments: "붙임\n1. 합성 계획서 1부.\n끝.",
        },
    )
    .expect("valid synthetic document should transform");
    // Then
    let source = inspect_template(&template).expect("source manifest");
    let transformed = inspect_template(&output).expect("output manifest");
    assert_eq!(transformed.bookmarks, source.bookmarks);
    assert_eq!((transformed.table_count, transformed.frame_count), (4, 4));
    assert_eq!(
        transformed.style_reference_sha256,
        source.style_reference_sha256
    );
    let content = read_entry(&output, "content.xml");
    assert!(content.contains("내부결재"));
    assert!(content.contains(
        "text:style-name=\"T5\"></text:span><text:bookmark text:name=\"CellField6¡경유¡F\"/>"
    ));
    assert!(content.contains("text:style-name=\"T6\">합성<text:s/>&lt;보건교육&gt;<text:s/>&amp;<text:s/>운영<text:s/>계획</text:span>"));
    assert!(content.contains("<text:line-break/>"));
    assert_eq!(content.matches("끝.").count(), 1);
    assert_eq!(
        read_entry(&output, "meta.xml"),
        super::transform::CLEAN_META
    );
}

#[test]
fn accepts_zero_one_many_attachments_without_appending_them_again() {
    // Given
    let template = fixture(None);
    let contract = contract_for(&template);
    let cases = [
        ("1. 합성 본문  끝.", "붙임\n1. [확인 필요] 1부.\n끝."),
        (
            "1. 합성 본문\n\n붙임  합성 하나 1부.  끝.",
            "붙임\n1. 합성 하나 1부.\n끝.",
        ),
        (
            "1. 합성 본문\n\n붙임  합성 하나 1부.\n합성 둘 1부.  끝.",
            "붙임\n1. 합성 하나 1부.\n2. 합성 둘 1부.\n끝.",
        ),
    ];
    for (body, attachments) in cases {
        // When
        let output = transform_template(
            &template,
            &contract,
            OdtExportDocument {
                title: "합성 제목",
                body,
                attachments,
            },
        )
        .expect("canonical attachment data should export");
        // Then
        let content = read_entry(&output, "content.xml");
        assert_eq!(content.matches("끝.").count(), 1);
        assert_eq!(
            content.matches("합성 하나").count(),
            usize::from(body.contains("합성 하나"))
        );
        assert_eq!(
            content.matches("합성 둘").count(),
            usize::from(body.contains("합성 둘"))
        );
    }
}

#[test]
fn preserves_multiline_leading_space_and_long_body_inside_the_existing_range() {
    // Given
    let template = fixture(None);
    let contract = contract_for(&template);
    let mut lines = vec!["1. 합성 장문".to_owned(), "  가. 선행 공백".to_owned()];
    lines.extend((0..180).map(|index| format!("{index}. 합성 문장")));
    lines.push("끝.".to_owned());
    let body = lines.join("\n");
    // When
    let output = transform_template(
        &template,
        &contract,
        OdtExportDocument {
            title: "합성 장문 제목",
            body: &body,
            attachments: "",
        },
    )
    .expect("long multiline text should remain editable");
    // Then
    let content = read_entry(&output, "content.xml");
    assert_eq!(content.matches("<text:line-break/>").count(), 182);
    assert!(content.contains("<text:s/><text:s/>가. 선행"));
    assert_eq!(
        inspect_template(&output)
            .expect("output manifest")
            .bookmarks,
        contract.bookmarks
    );
}

#[test]
fn rejects_invalid_end_attachment_unsupported_and_privacy_inputs() {
    // Given
    let template = fixture(None);
    let contract = contract_for(&template);
    let invalid = [
        OdtExportDocument {
            title: "합성",
            body: "끝. 끝.",
            attachments: "",
        },
        OdtExportDocument {
            title: "합성",
            body: "본문  끝.",
            attachments: "붙임\n1. 없는 붙임 1부.\n끝.",
        },
        OdtExportDocument {
            title: "합성",
            body: "본문\t끝.",
            attachments: "",
        },
    ];
    // When / Then
    assert_eq!(
        transform_template(&template, &contract, invalid[0]),
        Err(OdtTransformError::InvalidCanonicalBody)
    );
    assert_eq!(
        transform_template(&template, &contract, invalid[1]),
        Err(OdtTransformError::InvalidCanonicalBody)
    );
    assert_eq!(
        transform_template(&template, &contract, invalid[2]),
        Err(OdtTransformError::UnsupportedFormat("탭 또는 제목 줄바꿈"))
    );

    let unsafe_template = fixture_with_content(
        fixture_content(None).replace("<office:text>", "<office:text><text:tracked-changes/>"),
    );
    let unsafe_contract = contract_for(&unsafe_template);
    let result = transform_template(
        &unsafe_template,
        &unsafe_contract,
        OdtExportDocument {
            title: "합성",
            body: "본문  끝.",
            attachments: "",
        },
    );
    assert_eq!(
        result,
        Err(OdtTransformError::UnsupportedFormat(
            "변경 이력 또는 작성자 정보"
        ))
    );
}

fn read_entry(bytes: &[u8], name: &str) -> String {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).expect("valid output archive");
    let mut value = String::new();
    archive
        .by_name(name)
        .expect("expected output entry")
        .read_to_string(&mut value)
        .expect("UTF-8 XML entry");
    value
}

fn contract_for(bytes: &[u8]) -> ApprovedTemplateContract {
    let manifest = inspect_template(bytes).expect("fixture must be inspectable");
    ApprovedTemplateContract {
        sha256: sha256_hex(bytes),
        zip_entries: manifest.zip_entries,
        bookmarks: manifest.bookmarks,
        table_count: manifest.table_count,
        frame_count: manifest.frame_count,
        style_reference_count: manifest.style_reference_count,
        style_reference_sha256: manifest.style_reference_sha256,
    }
}

fn fixture(mutation: Option<&str>) -> Vec<u8> {
    fixture_with_content(fixture_content(mutation))
}

fn fixture_with_content(content: String) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    for (name, body, options) in [
        ("META-INF/manifest.xml", "<manifest/>", deflated),
        ("content.xml", content.as_str(), deflated),
        ("meta.xml", "<meta/>", deflated),
        (
            "mimetype",
            "application/vnd.oasis.opendocument.text",
            stored,
        ),
        ("settings.xml", "<settings/>", deflated),
        ("styles.xml", "<styles/>", deflated),
    ] {
        writer
            .start_file(name, options)
            .expect("start fixture entry");
        writer
            .write_all(body.as_bytes())
            .expect("write fixture entry");
    }
    writer.finish().expect("finish fixture").into_inner()
}

fn fixture_content(mutation: Option<&str>) -> String {
    let mut points = POINT_NAMES
        .iter()
        .enumerate()
        .map(|(index, name)| {
            let span = if matches!(index, 5 | 6) {
                format!("<text:span text:style-name=\"T{index}\"/>")
            } else {
                format!("<text:span text:style-name=\"T{index}\">기존 값</text:span>")
            };
            format!("<text:p text:style-name=\"P{index}\">{span}<text:bookmark text:name=\"{name}\"/></text:p>")
        })
        .collect::<Vec<_>>();
    match mutation {
        Some("missing") => {
            points.remove(4);
        }
        Some("duplicate") => points.push(points[4].clone()),
        Some("moved") => {
            points[4] = format!("<text:p><text:span>{}</text:span></text:p>", points[4])
        }
        Some("reordered") => points.swap(4, 5),
        Some("wrong-type") => {
            points[4] = points[4].replacen("text:bookmark ", "text:bookmark-start ", 1)
        }
        _ => {}
    }
    let end_name = if mutation == Some("range-mismatch") {
        "NormalField2"
    } else {
        BODY
    };
    format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><office:document-content xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" xmlns:table=\"urn:oasis:names:tc:opendocument:xmlns:table:1.0\" xmlns:draw=\"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0\"><office:body><office:text><table:table table:style-name=\"Table1\"/><table:table table:style-name=\"Table2\"/><table:table table:style-name=\"Table3\"/><table:table table:style-name=\"Table4\"/><draw:frame draw:style-name=\"Frame1\"/><draw:frame draw:style-name=\"Frame2\"/><draw:frame draw:style-name=\"Frame3\"/><draw:frame draw:style-name=\"Frame4\"/>{}<text:p text:style-name=\"Body\"><text:span><text:bookmark-start text:name=\"{BODY}\"/></text:span><text:span>합성 본문</text:span><text:span><text:bookmark-end text:name=\"{end_name}\"/></text:span></text:p></office:text></office:body></office:document-content>", points.join(""))
}
