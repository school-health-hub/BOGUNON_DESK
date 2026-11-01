use super::*;

#[test]
fn reference_order_does_not_change_style_digest() {
    let original = fixture_content(None);
    let reordered = original
        .replace("table:style-name=\"Table1\"", "table:style-name=\"Temporary\"")
        .replace("table:style-name=\"Table2\"", "table:style-name=\"Table1\"")
        .replace("table:style-name=\"Temporary\"", "table:style-name=\"Table2\"");
    let baseline = inspect_template(&fixture_with_content(original)).expect("synthetic manifest");
    let observed = inspect_template(&fixture_with_content(reordered)).expect("synthetic manifest");
    assert_eq!(baseline.style_reference_count, observed.style_reference_count);
    assert_eq!(baseline.style_reference_sha256, observed.style_reference_sha256);
}

#[test]
fn renamed_style_with_same_count_is_rejected_by_structure_contract() {
    let baseline = fixture(None);
    let contract = contract_for(&baseline);
    let bytes = fixture_with_content(fixture_content(None).replace(
        "text:style-name=\"P0\"", "text:style-name=\"Renamed\""));
    let manifest = inspect_template(&bytes).expect("synthetic manifest");
    assert_eq!(manifest.style_reference_count, contract.style_reference_count);
    assert_ne!(manifest.style_reference_sha256, contract.style_reference_sha256);
    assert_eq!(contract.validate(&manifest), Err(TemplateContractError::StructureMismatch("style references")));
}

#[test]
fn canonical_style_digest_matches_independent_sorted_frequency_model() {
    let bytes = fixture_with_content(String::from(
        "<document-content><body><text><p style-name=\"B\"/><p style-name=\"A\"/><p style-name=\"B\"/></text></body></document-content>"));
    let manifest = inspect_template(&bytes).expect("synthetic manifest");
    assert_eq!(manifest.style_reference_count, 3);
    assert_eq!(manifest.style_reference_sha256, sha256_hex(b"A=1\nB=2"));
}

#[test]
fn bookmark_name_type_path_and_order_mutations_remain_blocked() {
    let baseline = fixture(None);
    let contract = contract_for(&baseline);
    for mutation in ["missing", "duplicate", "moved", "reordered", "wrong-type", "range-mismatch"] {
        let bytes = fixture(Some(mutation));
        let manifest = inspect_template(&bytes).expect("synthetic mutation parses");
        assert_eq!(contract.validate(&manifest), Err(TemplateContractError::StructureMismatch("bookmark contract")));
    }
}

#[test]
fn unapproved_template_returns_guidance_and_no_output_bytes() {
    let result = transform_template(&fixture(None), &ApprovedTemplateContract::production(),
        OdtExportDocument { title: "Synthetic", body: "Synthetic body  끝.", attachments: "" });
    assert_eq!(result, Err(OdtTransformError::Template(TemplateContractError::ShaMismatch)));
    assert_eq!(TemplateContractError::ShaMismatch.to_string(), "선택한 표준서식의 SHA-256이 승인된 값과 다릅니다.");
}

#[test]
fn replacement_preserves_all_inspected_structure_and_style_references() {
    let template = fixture(None);
    let contract = contract_for(&template);
    let output = transform_template(&template, &contract,
        OdtExportDocument { title: "Synthetic title", body: "Synthetic body  끝.", attachments: "" })
        .expect("synthetic transform");
    let observed = inspect_template(&output).expect("output manifest");
    assert_eq!(observed.bookmarks, contract.bookmarks);
    assert_eq!(observed.table_count, contract.table_count);
    assert_eq!(observed.frame_count, contract.frame_count);
    assert_eq!(observed.style_reference_count, contract.style_reference_count);
    assert_eq!(observed.style_reference_sha256, contract.style_reference_sha256);
}
