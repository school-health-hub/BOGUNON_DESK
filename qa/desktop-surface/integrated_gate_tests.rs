use super::{
    approval::{self, Binding, Error, OperatorReview},
    gate::{self, Input},
    *,
};
use serde_json::json;
use std::{
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(1);
pub(crate) struct Fixture {
    pub binding: Binding,
    pub manifest: Vec<u8>,
    pub descriptor: Vec<u8>,
    pub approval: Vec<u8>,
    pub review: String,
}
impl Fixture {
    pub(crate) fn new() -> Self {
        let parent =
            std::path::Path::new("C:/Users/Public/Documents/BOGUNON-9b3jb-output/synthetic-temp");
        std::fs::create_dir_all(parent).unwrap();
        let root = parent.join(format!(
            "bogunon-9b3jb-gate-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&root).unwrap();
        let sha = "a".repeat(40);
        let manifest = serde_json::to_vec(&json!({"runner_id":RUNNER_ID,"scope":SCOPE,
            "executable_sha256":approval::digest(b"artifact"),"executable_path":root.join("artifact.exe"),
            "source_head":sha,"source_sha":sha,"native_api_scope":API_SCOPE,"window_count":1,"run_count":1})).unwrap();
        let descriptor = serde_json::to_vec(&json!({"runner_id":RUNNER_ID,"evidence_namespace":EVIDENCE_NAMESPACE,
            "manifest_sha256":approval::digest(&manifest),"manifest_path":root.join("manifest.json"),
            "approval_path":root.join("operator-record.json"),"evidence_path":root.join("integrated-evidence.json"),
            "staging_path":root.join("integrated-evidence.staging.json"),"claim_path":root.join("integrated-run.claim")})).unwrap();
        let binding = Binding {
            runner_id: RUNNER_ID.into(),
            scope: SCOPE.into(),
            evidence_namespace: EVIDENCE_NAMESPACE.into(),
            executable_sha256: approval::digest(b"artifact"),
            source_head: sha.clone(),
            source_sha: sha,
            manifest_sha256: approval::digest(&manifest),
            descriptor_sha256: approval::digest(&descriptor),
            executable_path: root.join("artifact.exe"),
            manifest_path: root.join("manifest.json"),
            descriptor_path: root.join("descriptor.json"),
            approval_path: root.join("operator-record.json"),
            evidence_path: root.join("integrated-evidence.json"),
            staging_path: root.join("integrated-evidence.staging.json"),
            claim_path: root.join("integrated-run.claim"),
            native_api_scope: approval::NativeApiScope::SyncOwnWindowAb,
            window_count: 1,
            run_count: 1,
        };
        let mut value = Self {
            binding,
            manifest,
            descriptor,
            approval: Vec::new(),
            review: String::new(),
        };
        value.refresh();
        value
    }
    pub(crate) fn refresh(&mut self) {
        self.approval = serde_json::to_vec(&self.binding).unwrap();
        self.review = approval::digest(&self.approval);
        std::fs::write(&self.binding.executable_path, b"artifact").unwrap();
        std::fs::write(&self.binding.manifest_path, &self.manifest).unwrap();
        std::fs::write(&self.binding.descriptor_path, &self.descriptor).unwrap();
        std::fs::write(&self.binding.approval_path, &self.approval).unwrap();
    }
    pub(crate) fn attempt(&self) -> gate::Attempt {
        gate::evaluate(self.input()).unwrap().consume()
    }
    pub(crate) fn input(&self) -> Input<'_> {
        Input {
            executable: b"artifact",
            manifest: &self.manifest,
            descriptor: &self.descriptor,
            approval_record: &self.approval,
            executable_path: &self.binding.executable_path,
            manifest_path: &self.binding.manifest_path,
            descriptor_path: &self.binding.descriptor_path,
            approval_path: &self.binding.approval_path,
            source_head: &self.binding.source_head,
            source_sha: &self.binding.source_sha,
            opt_in: Some(OPT_IN_VALUE),
            operator_review: OperatorReview::VerifiedRecord {
                record_sha256: &self.review,
            },
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Only uniquely created fixture files; no recursive deletion or existing artifact access.
        for path in [
            &self.binding.claim_path,
            &self.binding.evidence_path,
            &self.binding.staging_path,
            &self.binding.executable_path,
            &self.binding.manifest_path,
            &self.binding.descriptor_path,
            &self.binding.approval_path,
        ] {
            let _ = std::fs::remove_file(path);
        }
        if let Some(parent) = self.binding.descriptor_path.parent() {
            let _ = std::fs::remove_dir(parent);
        }
    }
}
#[test]
fn normal_gate_claim_is_persistent_and_attempt_is_bound() {
    let f = Fixture::new();
    let attempt = gate::evaluate(f.input()).unwrap().consume();
    assert_eq!(attempt.binding(), &f.binding);
    drop(attempt);
    assert!(matches!(gate::evaluate(f.input()), Err(Error::ClaimExists)));
}
#[test]
fn old_scope_is_rejected_before_claim() {
    let mut f = Fixture::new();
    f.binding.scope = "9B2O_OWN_WINDOWS_NO_SHELL".into();
    f.refresh();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Scope)));
    assert!(!f.binding.claim_path.exists());
}
#[test]
fn wrong_runner_is_rejected() {
    let mut f = Fixture::new();
    f.binding.runner_id = "other".into();
    f.refresh();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Scope)));
}
#[test]
fn wrong_executable_hash_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.executable = b"other";
    assert!(matches!(gate::evaluate(input), Err(Error::Artifact)));
}
#[test]
fn wrong_source_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.source_sha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    assert!(matches!(gate::evaluate(input), Err(Error::Source)));
}
#[test]
fn wrong_manifest_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.manifest = b"{}";
    assert!(matches!(gate::evaluate(input), Err(Error::Manifest)));
}
#[test]
fn wrong_descriptor_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.descriptor = b"{}";
    assert!(matches!(gate::evaluate(input), Err(Error::Descriptor)));
}
#[test]
fn missing_opt_in_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.opt_in = None;
    assert!(matches!(gate::evaluate(input), Err(Error::OptIn)));
}
#[test]
fn unreviewed_record_is_not_human_approval() {
    let f = Fixture::new();
    let mut input = f.input();
    input.operator_review = OperatorReview::NotVerified;
    assert!(matches!(gate::evaluate(input), Err(Error::Approval)));
}
#[test]
fn missing_record_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.approval_record = b"";
    assert!(matches!(gate::evaluate(input), Err(Error::Approval)));
}
#[test]
fn changed_record_is_rejected() {
    let f = Fixture::new();
    let mut input = f.input();
    input.operator_review = OperatorReview::VerifiedRecord {
        record_sha256: "bad",
    };
    assert!(matches!(gate::evaluate(input), Err(Error::Approval)));
}
#[test]
fn alternate_descriptor_path_is_not_an_approval_bypass() {
    let f = Fixture::new();
    let alternate = PathBuf::from("C:/different/descriptor.json");
    let mut input = f.input();
    input.descriptor_path = &alternate;
    assert!(matches!(gate::evaluate(input), Err(Error::Path)));
}
#[test]
fn alternate_claim_is_not_an_approval_bypass() {
    let mut f = Fixture::new();
    f.binding.claim_path = f.binding.claim_path.with_file_name("other.claim");
    f.refresh();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Path)));
}
#[test]
fn existing_output_blocks_gate() {
    let f = Fixture::new();
    std::fs::write(&f.binding.evidence_path, b"preserve").unwrap();
    assert!(matches!(gate::evaluate(f.input()), Err(Error::Path)));
    assert_eq!(
        std::fs::read(&f.binding.evidence_path).unwrap(),
        b"preserve"
    );
}
#[test]
fn gate_failure_never_calls_native_seam() {
    let f = Fixture::new();
    let mut input = f.input();
    input.opt_in = None;
    let mut calls = 0;
    let result = gate::with_attempt(input, |_attempt| {
        calls += 1;
    });
    assert_eq!(result, Err(Error::OptIn));
    assert_eq!(calls, 0);
}
