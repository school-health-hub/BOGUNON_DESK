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
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    let mut config: Value = serde_json::from_str(include_str!("tauri.conf.json")).unwrap();
    if let Ok(patch) = std::env::var("TAURI_CONFIG") {
        merge(
            &mut config,
            serde_json::from_str(&patch).expect("Invalid Tauri config overlay"),
        );
    }
    let finance_qa = std::env::var_os("CARGO_FEATURE_MY_FINANCE_QA").is_some();
    let finder_qa = std::env::var_os("CARGO_FEATURE_EDUCATION_VIDEO_QA").is_some();
    assert!(
        !(finance_qa && finder_qa),
        "QA features are mutually exclusive"
    );
    let live_qa = std::env::var_os("CARGO_FEATURE_FINDER_LIVE_QA").is_some();
    assert!(
        !(live_qa && (finance_qa || finder_qa)),
        "QA features are mutually exclusive"
    );
    let id = config["identifier"].as_str().unwrap_or_default();
    if live_qa {
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.finderliveqa",
            "Live QA feature requires isolated config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK FINDER LIVE QA");
        assert_eq!(config["mainBinaryName"], "bogunon-desk-finder-live-qa");
        assert_eq!(config["build"]["frontendDist"], "../dist-finder-live-qa");
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Live QA must not register production integrations"
        );
        let sha = std::env::var("BOGUNON_QA_SOURCE_SHA").expect("QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        println!("cargo:rerun-if-changed=../dist-finder-live-qa/qa-build.json");
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-finder-live-qa/qa-build.json")
                .expect("Build Live QA frontend first"),
        )
        .unwrap();
        assert_eq!(stamp["sourceSha"], sha, "Live QA source mismatch");
        assert_eq!(stamp["baseSha"], "f0981bf965b191ca380d5a97afe9aa61f9a1c3d8");
        assert_eq!(stamp["identifier"], id);
        println!("cargo:rustc-env=BOGUNON_QA_SOURCE_SHA={sha}");
    } else if finance_qa {
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
    } else if finder_qa {
        println!("cargo:rerun-if-changed=../dist-education-video-qa/qa-build.json");
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.educationvideoqa",
            "Finder QA feature requires Finder QA config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK FINDER IPC QA");
        assert_eq!(config["mainBinaryName"], "bogunon-desk-finder-ipc-qa");
        assert_eq!(
            config["build"]["frontendDist"],
            "../dist-education-video-qa"
        );
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Finder QA must not register production integrations"
        );
        let sha = std::env::var("BOGUNON_QA_SOURCE_SHA").expect("QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-education-video-qa/qa-build.json")
                .expect("Build Finder QA frontend first"),
        )
        .unwrap();
        assert_eq!(
            stamp["sourceSha"], sha,
            "Finder QA frontend/native source mismatch"
        );
        assert_eq!(stamp["identifier"], id);
        println!("cargo:rustc-env=BOGUNON_QA_SOURCE_SHA={sha}");
    } else {
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.finderliveqa",
            "Live QA config requires Live QA feature"
        );
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.myfinanceqa",
            "QA config requires QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-my-finance-qa",
            "QA frontend requires QA feature"
        );
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.educationvideoqa",
            "Finder QA config requires Finder QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-education-video-qa",
            "Finder QA frontend requires Finder QA feature"
        );
    }
    tauri_build::build()
}
