mod main_command_manifest;
use serde_json::Value;
fn merge(target: &mut Value, patch: Value) {
    if let Value::Object(patch) = patch {
        if !target.is_object() {
            *target = serde_json::json!({});
        }
        let object = target.as_object_mut().unwrap();
        for (key, value) in patch {
            if value.is_null() {
                object.remove(&key);
            } else {
                merge(object.entry(key).or_insert(Value::Null), value);
            }
        }
    } else {
        *target = patch;
    }
}
fn main() {
    println!("cargo:rerun-if-env-changed=BOGUNON_QA_SOURCE_SHA");
    println!("cargo:rerun-if-env-changed=BOGUNON_SURFACE_QA_SOURCE_SHA");
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    let mut config: Value = serde_json::from_str(include_str!("tauri.conf.json")).unwrap();
    if let Ok(patch) = std::env::var("TAURI_CONFIG") {
        merge(
            &mut config,
            serde_json::from_str(&patch).expect("Invalid Tauri config overlay"),
        );
    }
    let qa = std::env::var_os("CARGO_FEATURE_MY_FINANCE_QA").is_some();
    let surface_qa = std::env::var_os("CARGO_FEATURE_DESKTOP_SURFACE_QA").is_some();
    assert!(
        !(qa && surface_qa),
        "QA flavors must be compiled independently"
    );
    let id = config["identifier"].as_str().unwrap_or_default();
    if qa {
        println!("cargo:rerun-if-changed=../dist-my-finance-qa/qa-build.json");
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.myfinanceqa",
            "QA feature requires QA config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK MY FINANCE QA");
        assert_eq!(config["mainBinaryName"], "bogunon-desk-my-finance-qa");
        assert_eq!(config["build"]["frontendDist"], "../dist-my-finance-qa");
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "QA must not register production integrations"
        );
        let sha = std::env::var("BOGUNON_QA_SOURCE_SHA").expect("QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|b| b.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-my-finance-qa/qa-build.json")
                .expect("Build QA frontend first"),
        )
        .unwrap();
        assert_eq!(
            stamp["sourceSha"], sha,
            "QA frontend/native source mismatch"
        );
        assert_eq!(stamp["identifier"], id);
        println!("cargo:rustc-env=BOGUNON_QA_SOURCE_SHA={sha}");
    } else if surface_qa {
        println!("cargo:rerun-if-changed=../dist-surface-qa-main/qa-build.json");
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.surfaceqa",
            "Desktop Surface QA feature requires its isolated config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK SURFACE QA");
        assert_eq!(config["mainBinaryName"], "bogunon-desk-surface-qa");
        assert_eq!(config["build"]["frontendDist"], "../dist-surface-qa-main");
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Desktop Surface QA must not register production integrations"
        );
        assert_eq!(
            config["bundle"]["active"], false,
            "Desktop Surface QA is packaged only by the portable QA controller"
        );
        let sha = std::env::var("BOGUNON_SURFACE_QA_SOURCE_SHA")
            .expect("Desktop Surface QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-surface-qa-main/qa-build.json")
                .expect("Build the Desktop Surface QA Main frontend first"),
        )
        .expect("Invalid Desktop Surface QA frontend stamp");
        assert_eq!(
            stamp["sourceSha"], sha,
            "Desktop Surface QA frontend/native source mismatch"
        );
        assert_eq!(stamp["identifier"], id);
        assert_eq!(stamp["flavor"], "desktop-surface-qa");
        assert_eq!(stamp["dataPolicy"], "synthetic-only");
        println!("cargo:rustc-env=BOGUNON_SURFACE_QA_SOURCE_SHA={sha}");
    } else {
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.myfinanceqa",
            "QA config requires QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-my-finance-qa",
            "QA frontend requires QA feature"
        );
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.surfaceqa",
            "Desktop Surface QA config requires QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-surface-qa-main",
            "Desktop Surface QA frontend requires QA feature"
        );
    }
    let manifest = if surface_qa {
        tauri_build::AppManifest::new().commands(&[
            "begin_desktop_surface_edit",
            "complete_desktop_surface_edit",
            "cancel_desktop_surface_edit",
        ])
    } else {
        tauri_build::AppManifest::new().commands(main_command_manifest::APP_COMMANDS)
    };
    let attributes = tauri_build::Attributes::new().app_manifest(manifest);
    tauri_build::try_build(attributes).expect("Tauri permission generation failed");
}
