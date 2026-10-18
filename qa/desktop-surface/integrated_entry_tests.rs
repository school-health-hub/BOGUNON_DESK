use super::*;

#[test]
fn blocked_without_opt_in_before_argument_evaluation() {
    // Given: an argument producer that must never be invoked.
    let mut accessed = false;
    // When: the explicit opt-in is absent.
    let result = arguments(None, || {
        accessed = true;
        Vec::new()
    });
    // Then: admission is blocked before arguments or paths are accessed.
    assert!(matches!(result, Err(EntryError::OptIn)));
    assert!(!accessed);
}

#[test]
fn missing_embedded_source_is_blocked() {
    // Given: a build with no embedded source binding.
    // When: source admission is checked.
    let result = crate::integrated_source::validate(None);
    // Then: no runtime Git fallback manufactures a source identity.
    assert!(result.is_err());
}

#[test]
fn explicit_paths_and_review_pin_are_required() {
    // Given: explicit opt-in but no arguments.
    // When: command-line admission is parsed.
    let result = arguments(Some(crate::integrated_runner::OPT_IN_VALUE), Vec::new);
    // Then: default paths and implicit approval are rejected.
    assert!(matches!(result, Err(EntryError::Arguments)));
}

fn operator(binding: &[u8]) -> Vec<u8> {
    serde_json::to_vec(
        &serde_json::json!({"decision":"APPROVE", "runner_id":RUNNER_ID,
        "scope":SCOPE, "approval_binding_sha256":approval::digest(binding),
        "approved_at_unix_seconds":1, "operator_reference":"synthetic-operator-reference"}),
    )
    .unwrap()
}
#[test]
fn separate_operator_assertion_is_bound_to_exact_record() {
    // Given: a Synthetic approval assertion and its explicit pin.
    let binding = b"synthetic binding";
    let bytes = operator(binding);
    // When: record facts and binding are checked.
    let result = validate_operator(&bytes, &approval::digest(&bytes), binding);
    // Then: the assertion is accepted without authenticating a human identity.
    assert!(result.is_ok());
}
#[test]
fn different_binding_cannot_reuse_operator_assertion() {
    // Given: an assertion for another immutable binding.
    let bytes = operator(b"original");
    // When: a different binding is supplied.
    let result = validate_operator(&bytes, &approval::digest(&bytes), b"other");
    // Then: the mismatch is blocked before Gate or Native entry.
    assert_eq!(result, Err(EntryError::Approval));
}
#[test]
fn operator_assertion_requires_external_pin() {
    // Given: a valid assertion but a different explicitly supplied pin.
    let bytes = operator(b"binding");
    // When: the assertion is reviewed against that pin.
    let result = validate_operator(&bytes, &"0".repeat(64), b"binding");
    // Then: automatic self-hashing is not substituted for the review input.
    assert_eq!(result, Err(EntryError::Approval));
}
#[test]
fn operator_assertion_rejects_unrecognized_scope() {
    // Given: an assertion naming an existing Runner scope.
    let mut value: serde_json::Value = serde_json::from_slice(&operator(b"binding")).unwrap();
    value["scope"] = serde_json::json!("OWN_WINDOW_OLD_SCOPE");
    let bytes = serde_json::to_vec(&value).unwrap();
    // When: strict operator assertion validation is performed.
    let result = validate_operator(&bytes, &approval::digest(&bytes), b"binding");
    // Then: prior Runner approval cannot authorize this Runner.
    assert_eq!(result, Err(EntryError::Approval));
}
#[test]
fn explicit_entry_arguments_are_preserved() {
    // Given: all explicit metadata paths and an externally supplied review pin.
    let values = [
        "--manifest",
        "C:/qa/manifest.json",
        "--descriptor",
        "C:/qa/descriptor.json",
        "--approval-binding",
        "C:/qa/binding.json",
        "--operator-record",
        "C:/qa/operator.json",
        "--reviewed-record-sha",
        &"a".repeat(64),
    ]
    .map(OsString::from)
    .to_vec();
    // When: the strict CLI contract is parsed.
    let args = arguments(Some(OPT_IN_VALUE), || values).unwrap();
    // Then: no metadata path or review hash is inferred from ambient state.
    assert_eq!(args.manifest, PathBuf::from("C:/qa/manifest.json"));
    assert_eq!(args.reviewed_record_sha, "a".repeat(64));
}
#[test]
fn uppercase_source_identity_is_blocked() {
    // Given: a noncanonical compile-time source identity.
    // When: source admission is checked.
    let result =
        crate::integrated_source::validate(Some("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    // Then: source spelling cannot bypass exact binding comparisons.
    assert!(result.is_err());
}

fn loader_arguments(
    fixture: &crate::integrated_runner::gate_tests::Fixture,
    bytes: &[u8],
) -> Arguments {
    Arguments {
        manifest: fixture.binding.manifest_path.clone(),
        descriptor: fixture.binding.descriptor_path.clone(),
        binding: fixture.binding.approval_path.clone(),
        operator_record: fixture
            .binding
            .descriptor_path
            .with_file_name("separate-operator.json"),
        reviewed_record_sha: approval::digest(bytes),
    }
}
#[test]
fn shared_loader_reaches_gate_and_claim_without_native() {
    // Given: actual Synthetic artifact files and a separately pinned operator assertion.
    let fixture = crate::integrated_runner::gate_tests::Fixture::new();
    let bytes = operator(&fixture.approval);
    let args = loader_arguments(&fixture, &bytes);
    let operator_path = args.operator_record.clone();
    std::fs::write(&operator_path, bytes).unwrap();
    // When: the actual loader feeds the actual Gate without any Native factory.
    let loaded = Loaded::load_checked(
        args,
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fixture.binding.executable_path.clone(),
    )
    .unwrap();
    let permit = gate::evaluate(loaded.input()).unwrap();
    // Then: the exact approved claim exists before any possible Native admission.
    assert!(fixture.binding.claim_path.exists());
    drop(permit);
    drop(loaded);
    std::fs::remove_file(operator_path).unwrap();
}
#[test]
fn shared_loader_rejects_missing_operator_file() {
    // Given: complete binding files but no separate operator assertion file.
    let fixture = crate::integrated_runner::gate_tests::Fixture::new();
    let args = loader_arguments(&fixture, b"absent");
    // When: the actual loader attempts immutable reads.
    let result = Loaded::load_checked(
        args,
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fixture.binding.executable_path.clone(),
    );
    // Then: no Gate claim or Native admission is reached.
    assert!(matches!(result, Err(EntryError::Path)));
    assert!(!fixture.binding.claim_path.exists());
}
#[test]
fn shared_loader_rejects_operator_binding_mismatch() {
    // Given: a real assertion file approving a different Synthetic binding.
    let fixture = crate::integrated_runner::gate_tests::Fixture::new();
    let bytes = operator(b"another binding");
    let args = loader_arguments(&fixture, &bytes);
    let operator_path = args.operator_record.clone();
    std::fs::write(&operator_path, bytes).unwrap();
    // When: the shared actual loader checks the separate authorization assertion.
    let result = Loaded::load_checked(
        args,
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fixture.binding.executable_path.clone(),
    );
    // Then: approval fails without creating a claim.
    assert!(matches!(result, Err(EntryError::Approval)));
    assert!(!fixture.binding.claim_path.exists());
    std::fs::remove_file(operator_path).unwrap();
}
#[test]
fn operator_assertion_rejects_denial_missing_fields_and_blank_reference() {
    // Given: three malformed authorization assertions with independently pinned bytes.
    let original: serde_json::Value = serde_json::from_slice(&operator(b"binding")).unwrap();
    let mut denial = original.clone();
    denial["decision"] = serde_json::json!("DENY");
    let mut missing = original.clone();
    missing
        .as_object_mut()
        .unwrap()
        .remove("approved_at_unix_seconds");
    let mut blank = original;
    blank["operator_reference"] = serde_json::json!("   ");
    for value in [denial, missing, blank] {
        let bytes = serde_json::to_vec(&value).unwrap();
        // When: strict assertion parsing is applied.
        let result = validate_operator(&bytes, &approval::digest(&bytes), b"binding");
        // Then: record presence and matching bytes cannot fabricate authorization.
        assert_eq!(result, Err(EntryError::Approval));
    }
}
