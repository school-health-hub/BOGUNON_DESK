use std::{fs, fs::File};

use super::super::*;
use super::fixtures::{
    fixture_path, hwp_empty_record, hwp_text_record, write_hwp_sections, write_hwpx, write_pdf,
    write_zip, write_zip_with_entry_count, TEST_HWP_PROPERTY_COMPRESSED, TEST_MAX_BATCH_FILES,
    TEST_MAX_FILE_BYTES, TEST_MAX_HWP_DECOMPRESSED_BYTES, TEST_MAX_HWP_RECORDS,
    TEST_MAX_HWP_SECTIONS, TEST_MAX_PDF_PAGES, TEST_MAX_TEXT_BYTES, TEST_MAX_XML_BYTES,
    TEST_MAX_ZIP_ENTRIES,
};

#[test]
fn rejects_per_file_size_and_aggregate_source_before_parsing() {
    let oversized = fixture_path("oversized", "pdf");
    File::create(&oversized)
        .unwrap()
        .set_len(TEST_MAX_FILE_BYTES + 1)
        .unwrap();
    let per_file = extract_reports(vec![oversized.clone()]);
    assert!(per_file.reports.is_empty());
    assert_eq!(
        per_file.failures[0].message,
        ImportError::FileTooLarge.message()
    );
    fs::remove_file(oversized).unwrap();

    let paths = (0..=10)
        .map(|index| {
            let path = fixture_path(&format!("aggregate-{index}"), "pdf");
            File::create(&path)
                .unwrap()
                .set_len(TEST_MAX_FILE_BYTES)
                .unwrap();
            path
        })
        .collect::<Vec<_>>();
    let aggregate = extract_reports(paths.clone());
    assert!(aggregate.reports.is_empty());
    assert_eq!(aggregate.failures.len(), 1);
    assert_eq!(aggregate.failures[0].source_name, "선택한 파일");
    assert_eq!(
        aggregate.failures[0].message,
        ImportError::BatchLimit.message()
    );
    for path in paths {
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn rejects_too_many_files_without_parsing() {
    let paths = (0..=TEST_MAX_BATCH_FILES)
        .map(|index| fixture_path(&format!("too-many-{index}"), "pdf"))
        .collect();
    let batch = extract_reports(paths);

    assert!(batch.reports.is_empty());
    assert_eq!(
        batch.failures[0].message,
        "한 번에 최대 50개 파일까지 가져올 수 있습니다."
    );
}

#[test]
fn rejects_text_size_pdf_page_zip_entry_and_xml_limits() {
    let huge_text = "x".repeat(TEST_MAX_TEXT_BYTES + 1);
    let text_limit = write_hwpx("text-limit", &huge_text);
    let text_batch = extract_reports(vec![text_limit.clone()]);
    assert_eq!(
        text_batch.failures[0].message,
        ImportError::TextLimit.message()
    );
    fs::remove_file(text_limit).unwrap();

    let pages = vec!["Readable page"; TEST_MAX_PDF_PAGES + 1];
    let pdf_pages = write_pdf("page-limit", &pages);
    let page_batch = extract_reports(vec![pdf_pages.clone()]);
    assert_eq!(
        page_batch.failures[0].message,
        ImportError::PdfPageLimit.message()
    );
    fs::remove_file(pdf_pages).unwrap();

    let zip_entries = fixture_path("entry-limit", "hwpx");
    let xml = br#"<p><t>entry limit</t></p>"#;
    write_zip_with_entry_count(&zip_entries, TEST_MAX_ZIP_ENTRIES + 1, xml);
    let entry_batch = extract_reports(vec![zip_entries.clone()]);
    assert_eq!(
        entry_batch.failures[0].message,
        ImportError::ZipEntryLimit.message()
    );
    fs::remove_file(zip_entries).unwrap();

    let xml_limit = fixture_path("xml-limit", "hwpx");
    let huge_xml = vec![b'x'; TEST_MAX_XML_BYTES + 1];
    write_zip(&xml_limit, &[("Contents/section0.xml", &huge_xml)]);
    let xml_batch = extract_reports(vec![xml_limit.clone()]);
    assert_eq!(
        xml_batch.failures[0].message,
        ImportError::XmlLimit.message()
    );
    fs::remove_file(xml_limit).unwrap();
}

#[test]
fn rejects_hwp_section_record_and_decompressed_limits() {
    let sections = (0..=TEST_MAX_HWP_SECTIONS)
        .map(|_| hwp_text_record("section"))
        .collect::<Vec<_>>();
    let section_limit = write_hwp_sections("section-limit", &sections, 0, 0x0500_0000);
    assert_eq!(
        hwp::extract_hwp_text(&section_limit),
        Err(ImportError::HwpSectionLimit)
    );
    fs::remove_file(section_limit).unwrap();

    let records = (0..=TEST_MAX_HWP_RECORDS)
        .flat_map(|_| hwp_empty_record())
        .collect::<Vec<_>>();
    let record_limit = write_hwp_sections("record-limit", &[records], 0, 0x0500_0000);
    assert_eq!(
        hwp::extract_hwp_text(&record_limit),
        Err(ImportError::HwpRecordLimit)
    );
    fs::remove_file(record_limit).unwrap();

    let huge_section = vec![0_u8; TEST_MAX_HWP_DECOMPRESSED_BYTES + 1];
    let decompressed_limit = write_hwp_sections(
        "decompressed-limit",
        &[huge_section],
        TEST_HWP_PROPERTY_COMPRESSED,
        0x0500_0000,
    );
    assert_eq!(
        hwp::extract_hwp_text(&decompressed_limit),
        Err(ImportError::HwpDataLimit)
    );
    fs::remove_file(decompressed_limit).unwrap();
}

#[test]
fn applies_hwp_body_limit_across_uncompressed_sections() {
    let sections = [hwp_text_record("alpha"), hwp_text_record("beta")];
    let exact_limit = sections.iter().map(Vec::len).sum::<usize>();
    let hwp = write_hwp_sections("aggregate-uncompressed", &sections, 0, 0x0500_0000);

    assert_eq!(
        hwp::extract_hwp_text_with_body_limit(&hwp, exact_limit - 1),
        Err(ImportError::HwpDataLimit)
    );
    assert_eq!(
        hwp::extract_hwp_text_with_body_limit(&hwp, exact_limit).unwrap(),
        "alpha\nbeta"
    );
    fs::remove_file(hwp).unwrap();
}

#[test]
fn applies_hwp_body_limit_to_aggregate_decompressed_bytes() {
    let sections = [hwp_text_record("alpha"), hwp_text_record("beta")];
    let exact_limit = sections.iter().map(Vec::len).sum::<usize>();
    let hwp = write_hwp_sections(
        "aggregate-compressed",
        &sections,
        TEST_HWP_PROPERTY_COMPRESSED,
        0x0500_0000,
    );

    assert_eq!(
        hwp::extract_hwp_text_with_body_limit(&hwp, exact_limit - 1),
        Err(ImportError::HwpDataLimit)
    );
    assert_eq!(
        hwp::extract_hwp_text_with_body_limit(&hwp, exact_limit).unwrap(),
        "alpha\nbeta"
    );
    fs::remove_file(hwp).unwrap();
}

#[test]
fn rejected_batch_text_does_not_consume_budget_for_later_reports() {
    let first = write_hwpx("batch-text-first", "12345678");
    let rejected = write_hwpx("batch-text-rejected", "12345");
    let last = write_hwpx("batch-text-last", "xy");

    let batch =
        extract_reports_with_text_limit(vec![first.clone(), rejected.clone(), last.clone()], 10);

    assert_eq!(batch.reports.len(), 2);
    assert_eq!(
        batch
            .reports
            .iter()
            .map(|report| report.text.len())
            .sum::<usize>(),
        10
    );
    assert_eq!(batch.failures.len(), 1);
    assert_eq!(
        batch.failures[0].message,
        ImportError::BatchTextLimit.message()
    );
    assert_ne!(
        ImportError::BatchLimit.message(),
        ImportError::BatchTextLimit.message()
    );

    for path in [first, rejected, last] {
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn worker_panic_returns_stable_record_helper_error() {
    let result = tauri::async_runtime::block_on(run_extraction_worker::<(), _>(|| {
        panic!("sensitive worker detail")
    }));

    assert_eq!(result.unwrap_err(), EXTRACTION_WORKER_ERROR);
}
