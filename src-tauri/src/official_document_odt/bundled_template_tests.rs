use super::{command, sha256_hex, transform_template, validate_template, ApprovedTemplateContract, OdtExportDocument};

const HOME_SHA: &str = "8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285";

#[test]
fn embedded_bytes_match_the_existing_home_contract() {
    let bytes = command::bundled_template();
    assert_eq!(sha256_hex(bytes), HOME_SHA);
    let contract = ApprovedTemplateContract::for_sha256(HOME_SHA).expect("existing home contract");
    let manifest = validate_template(bytes, &contract).expect("embedded resource must pass all checks");
    assert_eq!((manifest.bookmarks.len(), manifest.table_count, manifest.frame_count, manifest.style_reference_count), (43, 4, 4, 255));
}

#[test]
fn modified_bundled_bytes_are_rejected_by_the_unchanged_guard() {
    let mut modified = command::bundled_template().to_vec();
    modified.push(0);
    let contract = ApprovedTemplateContract::for_sha256(HOME_SHA).expect("home contract");
    assert_eq!(validate_template(&modified, &contract), Err(super::TemplateContractError::ShaMismatch));
}

#[test]
fn embedded_template_exports_and_atomically_saves_edited_manuscript() {
    use super::save::{replace_validated, FilesystemStager, PlatformAtomicCommitter, SavePolicy};
    let bytes = command::bundled_template();
    let contract = ApprovedTemplateContract::for_sha256(&sha256_hex(bytes)).expect("same product selector");
    let title = "Bundled-title";
    let body = "1. Synthetic edited paragraph\n  가. Second paragraph\n\n붙임  Synthetic attachment 2부.  끝.";
    let output = transform_template(bytes, &contract, OdtExportDocument {
        title, body, attachments: "붙임\n1. Synthetic attachment 2부.\n끝.",
    }).expect("unchanged product transformer");
    let content = super::tests::read_entry(&output, "content.xml");
    assert!(content.contains(title));
    assert_eq!(super::tests::restored_body(&content), body);
    command::validate_staged_output(&output, &contract).expect("all bookmark/style/ZIP guards");
    for entry in ["styles.xml", "settings.xml", "META-INF/manifest.xml"] {
        assert_eq!(super::tests::read_entry(&output, entry), super::tests::read_entry(bytes, entry));
    }
    let directory = tempfile::tempdir().expect("runner temporary directory");
    let destination = directory.path().join("synthetic-bundled.odt");
    replace_validated(&destination, &output, SavePolicy {
        stager: FilesystemStager,
        validate: |staged: &[u8]| command::validate_staged_output(staged, &contract),
        committer: PlatformAtomicCommitter::new(),
    }).expect("existing atomic save");
    assert_eq!(std::fs::read(destination).expect("saved ODT"), output);
}
