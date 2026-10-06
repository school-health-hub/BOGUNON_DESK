use std::fs;

use serde_json::json;

use super::super::*;
use super::fixtures::{
    fixture_path, write_docx, write_hwp, write_hwpx, write_pdf, TEST_HWP_PROPERTY_COMPRESSED,
    TEST_HWP_PROPERTY_PRIVACY_SECURITY,
};

#[test]
fn extracts_mixed_reports_and_failures_when_batch_contains_supported_files() {
    let pdf = write_pdf("source-pdf", &["PDF report text"]);
    let hwpx = write_hwpx("source-hwpx", "HWPX report text");
    let docx = write_docx("source-docx", "DOCX report text");
    let hwp = write_hwp("source-hwp", "HWP report text", 0, 0x0500_0000);
    let corrupt = fixture_path("broken", "pdf");
    fs::write(&corrupt, b"not a pdf").unwrap();

    let batch = extract_reports(vec![
        pdf.clone(),
        hwpx.clone(),
        docx.clone(),
        hwp.clone(),
        corrupt.clone(),
    ]);

    assert_eq!(batch.reports.len(), 4);
    assert_eq!(batch.failures.len(), 1);
    assert_eq!(
        batch.failures[0].source_name,
        corrupt.file_name().unwrap().to_str().unwrap()
    );
    let value = serde_json::to_value(&batch).unwrap();
    assert_eq!(
        value["reports"][0]["sourceName"],
        pdf.file_name().unwrap().to_str().unwrap()
    );
    assert_eq!(value["reports"][1]["format"], json!("hwpx"));
    assert_eq!(value["reports"][2]["text"], json!("DOCX report text"));
    assert_eq!(value["reports"][3]["text"], json!("HWP report text"));
    assert!(value.get("source_name").is_none());

    for path in [pdf, hwpx, docx, hwp, corrupt] {
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn extracts_compressed_hwp_when_header_marks_bodytext_deflated() {
    let hwp = write_hwp(
        "compressed",
        "Compressed HWP text",
        TEST_HWP_PROPERTY_COMPRESSED,
        0x0500_0000,
    );

    let text = hwp::extract_hwp_text(&hwp).unwrap();

    assert_eq!(text, "Compressed HWP text");
    fs::remove_file(hwp).unwrap();
}

#[test]
fn rejects_hwp_security_and_non_version5_before_reading_bodytext() {
    let privacy = write_hwp(
        "privacy",
        "hidden",
        TEST_HWP_PROPERTY_PRIVACY_SECURITY,
        0x0500_0000,
    );
    let old = write_hwp("old-version", "hidden", 0, 0x0400_0000);

    assert_eq!(
        hwp::extract_hwp_text(&privacy),
        Err(ImportError::HwpUnsupportedSecurity)
    );
    assert_eq!(
        hwp::extract_hwp_text(&old),
        Err(ImportError::HwpUnsupportedVersion)
    );

    fs::remove_file(privacy).unwrap();
    fs::remove_file(old).unwrap();
}

#[test]
fn preserves_cancelled_picker_as_empty_batch() {
    let batch = tauri::async_runtime::block_on(extract_selected_reports(None)).unwrap();

    assert!(batch.reports.is_empty());
    assert!(batch.failures.is_empty());
}

#[test]
fn manual_qa_outputs_happy_malformed_protected_and_partial_batch() {
    let hwpx = write_hwpx("qa-happy", "QA happy text");
    let corrupt = fixture_path("qa-malformed", "pdf");
    fs::write(&corrupt, b"not a pdf").unwrap();
    let protected = write_hwp(
        "qa-protected",
        "hidden",
        TEST_HWP_PROPERTY_PRIVACY_SECURITY,
        0x0500_0000,
    );

    let partial = extract_reports(vec![hwpx.clone(), corrupt.clone()]);
    let protected_batch = extract_reports(vec![protected.clone()]);

    println!(
        "MANUAL_QA_PARTIAL={}",
        serde_json::to_string(&partial).unwrap()
    );
    println!(
        "MANUAL_QA_PROTECTED={}",
        serde_json::to_string(&protected_batch).unwrap()
    );
    assert_eq!(partial.reports.len(), 1);
    assert_eq!(partial.failures.len(), 1);
    assert!(protected_batch.reports.is_empty());
    assert_eq!(
        protected_batch.failures[0].message,
        ImportError::HwpUnsupportedSecurity.message()
    );

    for path in [hwpx, corrupt, protected] {
        fs::remove_file(path).unwrap();
    }
}
