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

#[test]
fn given_each_security_failure_when_recorded_then_the_exact_substage_is_preserved() {
    for (stage, failure, expected_stage, expected_failure) in [
        (
            MainStartupStage::SecurityCallerInstall,
            MainStartupFailure::SecurityCallerInstallFailed,
            "security_caller_install",
            "security_caller_install_failed",
        ),
        (
            MainStartupStage::SecurityLifetimeInstall,
            MainStartupFailure::LifetimeOriginMismatch,
            "security_lifetime_install",
            "lifetime_origin_mismatch",
        ),
        (
            MainStartupStage::SecurityEventsInstall,
            MainStartupFailure::SecurityEventsInstallFailed,
            "security_events_install",
            "security_events_install_failed",
        ),
    ] {
        let path = std::env::temp_dir().join(format!("bogunon-s2h8-{expected_stage}.json"));
        let _ = fs::remove_file(&path);
        let diagnostic = QaMainStartupDiagnostic::start_at(path.clone()).unwrap();

        diagnostic.begin(stage).unwrap();
        diagnostic.fail(failure, ChildStatus::NotStarted).unwrap();

        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["currentStage"], expected_stage);
        assert_eq!(value["failureCode"], expected_failure);
        assert_eq!(value["childStatus"], "not_started");
        assert_eq!(value["outcome"], "failed");
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn given_each_lifetime_precondition_failure_when_recorded_then_only_a_fixed_code_is_persisted() {
    for (failure, expected) in [
        (
            MainStartupFailure::LifetimeStateMissing,
            "lifetime_state_missing",
        ),
        (
            MainStartupFailure::LifetimeMainConfigMissing,
            "lifetime_main_config_missing",
        ),
        (
            MainStartupFailure::LifetimeAppUrlInvalid,
            "lifetime_app_url_invalid",
        ),
        (
            MainStartupFailure::LifetimeMainWebviewMissing,
            "lifetime_main_webview_missing",
        ),
        (
            MainStartupFailure::LifetimeWebviewUrlUnavailable,
            "lifetime_webview_url_unavailable",
        ),
        (
            MainStartupFailure::LifetimeOriginMismatch,
            "lifetime_origin_mismatch",
        ),
        (
            MainStartupFailure::LifetimeStateUnavailable,
            "lifetime_state_unavailable",
        ),
        (
            MainStartupFailure::LifetimeAlreadyInstalled,
            "lifetime_already_installed",
        ),
        (
            MainStartupFailure::LifetimeResourceRegistrationFailed,
            "lifetime_resource_registration_failed",
        ),
    ] {
        let path = std::env::temp_dir().join(format!("bogunon-s2h10-{expected}.json"));
        let _ = fs::remove_file(&path);
        let diagnostic = QaMainStartupDiagnostic::start_at(path.clone()).unwrap();

        diagnostic
            .begin(MainStartupStage::SecurityLifetimeInstall)
            .unwrap();
        diagnostic.fail(failure, ChildStatus::NotStarted).unwrap();

        let raw = fs::read_to_string(&path).unwrap();
        let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["failureCode"], expected);
        assert_eq!(value["outcome"], "failed");
        for forbidden in [
            "http://",
            "https://",
            "C:\\\\Users",
            "capability",
            "token",
            "S-1-",
        ] {
            assert!(!raw.contains(forbidden));
        }
        fs::remove_file(path).unwrap();
    }
}
