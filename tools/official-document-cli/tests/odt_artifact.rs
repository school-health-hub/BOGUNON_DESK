use official_document_cli::{
    import::extract_document,
    odt::{sha256_hex, write_bundled_odt, OdtDocument, OdtError},
};
use tempfile::tempdir;

#[test]
fn writer_uses_new_private_path_and_refuses_stale_artifact() {
    // Given
    let directory = tempdir().expect("private temp directory");
    let destination = directory.path().join("generated.odt");
    let document = OdtDocument {
        title: "합성 제목",
        body: "합성 본문  끝.",
        attachments: "",
        has_table_text: false,
    };

    // When
    let artifact = write_bundled_odt(&destination, document).expect("new artifact path");
    let stale_result = write_bundled_odt(&destination, document);

    // Then
    let bytes = std::fs::read(&destination).expect("written artifact");
    assert_eq!(artifact.path, destination);
    assert_eq!(artifact.byte_len, bytes.len());
    assert_eq!(artifact.sha256, sha256_hex(&bytes));
    assert_eq!(stale_result, Err(OdtError::DestinationExists));
    let imported = extract_document(&destination).expect("generated ODT re-import");
    assert!(imported.text.contains("합성 제목"));
    assert!(imported.text.contains("합성 본문  끝."));
}

#[test]
fn writer_leaves_no_artifact_when_render_validation_fails() {
    // Given
    let directory = tempdir().expect("private temp directory");
    let destination = directory.path().join("failed.odt");
    let invalid = OdtDocument {
        title: "합성 제목",
        body: "종료 표시 없음",
        attachments: "",
        has_table_text: false,
    };

    // When
    let result = write_bundled_odt(&destination, invalid);

    // Then
    assert_eq!(result, Err(OdtError::InvalidCanonicalBody));
    assert!(!destination.exists());
}

#[test]
#[ignore = "manual QA writes only an explicitly provided private temporary path"]
fn manual_render_to_explicit_temporary_path() {
    // Given
    let destination = std::env::var_os("ODT_MANUAL_TEMP_PATH").expect("explicit temporary path");
    let destination = std::path::Path::new(&destination);
    let document = OdtDocument {
        title: "합성 수동 검증 제목",
        body: "1. 합성 수동 검증 본문\n  가. 선행 공백\n\n붙임  합성 수동 확인표 1부.  끝.",
        attachments: "붙임\n1. 합성 수동 확인표 1부.\n끝.",
        has_table_text: false,
    };

    // When
    let artifact = write_bundled_odt(destination, document).expect("manual temporary artifact");

    // Then
    println!(
        "{} {} {}",
        artifact.path.display(),
        artifact.byte_len,
        artifact.sha256
    );
}
