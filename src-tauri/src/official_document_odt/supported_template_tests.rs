use super::*;

const HOME_SHA: &str = "8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285";

#[test]
fn original_and_home_versions_have_separate_pinned_contracts() {
    let original = ApprovedTemplateContract::production();
    let legacy = ApprovedTemplateContract::for_sha256(&original.sha256).expect("legacy supported");
    let home = ApprovedTemplateContract::for_sha256(HOME_SHA).expect("home supported");
    assert_eq!(legacy.sha256, original.sha256);
    assert_eq!(legacy.style_reference_sha256, original.style_reference_sha256);
    assert_eq!(home.sha256, HOME_SHA);
    assert_eq!(home.style_reference_sha256, "95162FDFF6196124FB6A01108DFFD13178A18261F2B581996B565D5FB465F028");
    assert_eq!(home.bookmarks, original.bookmarks);
    assert_eq!(home.zip_entries, original.zip_entries);
    assert_eq!((home.table_count, home.frame_count, home.style_reference_count), (4, 4, 255));
}

#[test]
fn unknown_and_hancom_modified_templates_remain_unsupported() {
    for hash in ["", "71F49707CF8441B81FA98556CD021AF06E4027F3A7313166E3713E5DEA79E9AB", &"0".repeat(64)] {
        assert!(matches!(ApprovedTemplateContract::for_sha256(hash), Err(TemplateContractError::ShaMismatch)));
    }
}

#[test]
fn home_contract_rejects_modified_bytes_before_transformation() {
    let contract = ApprovedTemplateContract::for_sha256(HOME_SHA).expect("home contract");
    let result = transform_template(&fixture(None), &contract,
        OdtExportDocument { title: "Synthetic", body: "Synthetic  끝.", attachments: "" });
    assert_eq!(result, Err(OdtTransformError::Template(TemplateContractError::ShaMismatch)));
}

#[test]
fn home_contract_still_checks_bookmarks_and_style_fingerprint() {
    let contract = ApprovedTemplateContract::for_sha256(HOME_SHA).expect("home contract");
    let mut manifest = inspect_template(&fixture(None)).expect("synthetic manifest");
    manifest.zip_entries = contract.zip_entries.clone();
    manifest.bookmarks = contract.bookmarks.clone();
    manifest.style_reference_count = contract.style_reference_count;
    manifest.style_reference_sha256 = contract.style_reference_sha256.clone();
    assert_eq!(contract.validate(&manifest), Ok(()));
    manifest.style_reference_sha256 = "0".repeat(64);
    assert_eq!(contract.validate(&manifest), Err(TemplateContractError::StructureMismatch("style references")));
    manifest.style_reference_sha256 = contract.style_reference_sha256.clone();
    manifest.bookmarks.swap(0, 1);
    assert_eq!(contract.validate(&manifest), Err(TemplateContractError::StructureMismatch("bookmark contract")));
}

// Opt-in, offline console harness: never runs in CI and never opens the app.
// Uses the same selector, transformer, staged validator and atomic saver as the UI.
#[test]
#[ignore = "requires private local template; never upload it"]
fn export_private_home_template_with_product_functions() {
    use crate::official_document_odt::save::{replace_validated, FilesystemStager, PlatformAtomicCommitter, SavePolicy};
    let source = std::env::var_os("P11_PRIVATE_TEMPLATE").expect("explicit private template path");
    let destination = std::env::var_os("P11_PRIVATE_OUTPUT").expect("explicit new output path");
    let destination = std::path::Path::new(&destination);
    let directory = destination.parent().expect("dedicated new output directory");
    std::fs::create_dir(directory).expect("exclusively create new output directory; never reuse one");
    assert!(!destination.exists(), "never overwrite an existing output");
    let bytes = std::fs::read(source).expect("read private template");
    assert_eq!(sha256_hex(&bytes), HOME_SHA);
    let contract = ApprovedTemplateContract::for_sha256(&sha256_hex(&bytes)).expect("supported version");
    let output = transform_template(&bytes, &contract, OdtExportDocument {
        title: "합성 보건교육 운영 계획", body: "1. 관련: 합성 교육 계획\n2. 개인정보 없는 합성 공문입니다.\n  가. 대상: 합성 대상\n  나. 내용: ODT 제품 출력 확인\n\n붙임  합성 확인표 1부.  끝.", attachments: "붙임\n1. 합성 확인표 1부.\n끝.",
    }).expect("product transform");
    replace_validated(destination, &output, SavePolicy {
        stager: FilesystemStager,
        validate: |staged: &[u8]| crate::official_document_odt::command::validate_staged_output(staged, &contract),
        committer: PlatformAtomicCommitter::new(),
    }).expect("product atomic save");
    assert_eq!(std::fs::read(destination).expect("saved output"), output);
    println!("Product output validated; SHA256={}", sha256_hex(&output));
}
