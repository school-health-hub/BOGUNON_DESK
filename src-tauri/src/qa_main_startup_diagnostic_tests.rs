use crate::{
    qa_main_startup_diagnostic::{
        ChildStatus, MainStartupFailure, MainStartupStage, QaMainStartupDiagnostic,
    },
    surface_runtime::{classify_child_before_grant, ChildBeforeGrant},
};
use std::fs;

#[test]
fn given_fixed_stages_when_startup_fails_then_first_failure_is_preserved_without_sensitive_data() {
    let path = std::env::temp_dir().join("bogunon-s2h5-main-diagnostic-contract.json");
    let _ = fs::remove_file(&path);
    let diagnostic = QaMainStartupDiagnostic::start_at(path.clone()).unwrap();

    diagnostic.complete(MainStartupStage::MainEntry).unwrap();
    diagnostic.begin(MainStartupStage::HostSpawn).unwrap();
    diagnostic
        .fail(
            MainStartupFailure::HostExitedBeforeGrant,
            ChildStatus::ExitedBeforeGrant,
        )
        .unwrap();
    diagnostic
        .fail(MainStartupFailure::TauriRuntimeFailed, ChildStatus::Unknown)
        .unwrap();

    let raw = fs::read_to_string(&path).unwrap();
    let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(value["currentStage"], "host_spawn");
    assert_eq!(value["failureCode"], "host_exited_before_grant");
    assert_eq!(value["childStatus"], "exited_before_grant");
    assert_eq!(value["outcome"], "failed");
    for forbidden in [
        "S-1-5-21-private",
        "secret-capability",
        "private-token",
        "C:\\Users\\person",
    ] {
        assert!(!raw.contains(forbidden));
    }
    fs::remove_file(path).unwrap();
}

#[test]
fn given_child_exit_before_grant_when_classified_then_startup_stays_failed_closed() {
    assert_eq!(classify_child_before_grant(true), ChildBeforeGrant::Exited);
    assert_eq!(
        classify_child_before_grant(false),
        ChildBeforeGrant::Running
    );
}
