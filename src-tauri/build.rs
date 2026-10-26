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
    println!("cargo:rerun-if-env-changed=BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA");
    println!("cargo:rerun-if-env-changed=BOGUNON_FINDER_INTEGRATION_QA_SOURCE_SHA");
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    let mut config: Value = serde_json::from_str(include_str!("tauri.conf.json")).unwrap();
    if let Ok(patch) = std::env::var("TAURI_CONFIG") {
        merge(
            &mut config,
            serde_json::from_str(&patch).expect("Invalid Tauri config overlay"),
        );
    }
    let finance_qa = std::env::var_os("CARGO_FEATURE_MY_FINANCE_QA").is_some();
    let official_document_qa = std::env::var_os("CARGO_FEATURE_OFFICIAL_DOCUMENT_QA").is_some();
    let finder_qa = std::env::var_os("CARGO_FEATURE_EDUCATION_VIDEO_QA").is_some();
    let live_qa = std::env::var_os("CARGO_FEATURE_FINDER_LIVE_QA").is_some();
    let finder_integration_qa = std::env::var_os("CARGO_FEATURE_FINDER_INTEGRATION_QA").is_some();
    assert!(
        [
            finance_qa,
            official_document_qa,
            finder_qa,
            live_qa,
            finder_integration_qa
        ]
        .into_iter()
        .filter(|enabled| *enabled)
        .count()
            <= 1,
        "QA features are mutually exclusive"
    );
    let id = config["identifier"].as_str().unwrap_or_default();
    if finder_integration_qa {
        assert_eq!(id, "kr.sungandi.schoolhealthdesk.finderintegrationqa");
        assert_eq!(config["productName"], "BOGUNON DESK FINDER INTEGRATION QA");
        assert_eq!(
            config["mainBinaryName"],
            "bogunon-desk-finder-integration-qa"
        );
        assert_eq!(
            config["build"]["frontendDist"],
            "../dist-finder-integration-qa"
        );
        assert!(config["app"]["windows"][0]["dataDirectory"].is_null());
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none()
        );
        assert_eq!(config["bundle"]["active"], false);
        let sha = std::env::var("BOGUNON_FINDER_INTEGRATION_QA_SOURCE_SHA")
            .expect("F-10 source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-finder-integration-qa/qa-build.json")
                .expect("Build F-10 frontend first"),
        )
        .unwrap();
        assert_eq!(stamp["sourceSha"], sha);
        assert_eq!(stamp["identifier"], id);
        assert_eq!(stamp["externalConnections"], false);
        println!("cargo:rustc-env=BOGUNON_FINDER_INTEGRATION_QA_SOURCE_SHA={sha}");
    } else if live_qa {
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.finderliveqa5",
            "Live QA feature requires isolated config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK FINDER LIVE QA5");
        assert_eq!(config["mainBinaryName"], "bogunon-desk-finder-live-qa5");
        assert_eq!(config["build"]["frontendDist"], "../dist-finder-live-qa5");
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Live QA must not register production integrations"
        );
        let sha = std::env::var("BOGUNON_QA_SOURCE_SHA").expect("QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        println!("cargo:rerun-if-changed=../dist-finder-live-qa5/qa-build.json");
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-finder-live-qa5/qa-build.json")
                .expect("Build Live QA frontend first"),
        )
        .unwrap();
        assert_eq!(stamp["sourceSha"], sha, "Live QA source mismatch");
        assert_eq!(stamp["baseSha"], "eed15c31a27e983a36fea2434fcf26dfbbebf4d1");
        assert_eq!(stamp["identifier"], id);
        assert_eq!(stamp["priorEvidenceReceiptsVerified"], true);
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
    } else if official_document_qa {
        println!("cargo:rerun-if-env-changed=BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT");
        let frontend_dist = match std::env::var_os("BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT") {
            Some(root) => {
                let root = std::path::PathBuf::from(root);
                assert!(root.is_absolute(), "QA output root must be absolute");
                root.join("dist-official-document-qa")
            }
            None => std::path::PathBuf::from("../dist-official-document-qa"),
        };
        let stamp_path = frontend_dist.join("qa-build.json");
        println!("cargo:rerun-if-changed={}", stamp_path.display());
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.officialdocumentqa",
            "Official document QA feature requires QA config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK OFFICIAL DOCUMENT QA");
        assert_eq!(
            config["mainBinaryName"],
            "bogunon-desk-official-document-qa"
        );
        assert_eq!(
            config["build"]["frontendDist"],
            frontend_dist.to_string_lossy().as_ref()
        );
        assert!(
            config["app"]["windows"][0]["dataDirectory"].is_null(),
            "Official document QA must use identifier-scoped default WebView2 storage"
        );
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Official document QA must not register production integrations"
        );
        assert_eq!(config["bundle"]["active"], false);
        let sha = std::env::var("BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA")
            .expect("Official document QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string(&stamp_path)
                .expect("Build official document QA frontend first"),
        )
        .unwrap();
        assert_eq!(
            stamp["sourceSha"], sha,
            "QA frontend/native source mismatch"
        );
        assert_eq!(stamp["identifier"], id);
        assert_eq!(stamp["externalConnections"], false);
        if frontend_dist.is_absolute() {
            assert_eq!(
                stamp["frontendDist"],
                frontend_dist.to_string_lossy().as_ref()
            );
        }
        println!("cargo:rustc-env=BOGUNON_OFFICIAL_DOCUMENT_QA_SOURCE_SHA={sha}");
    } else {
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.finderintegrationqa",
            "F-10 config requires F-10 feature"
        );
        assert_ne!(
            id, "kr.sungandi.schoolhealthdesk.finderliveqa5",
            "QA5 config requires Live QA feature"
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
            id, "kr.sungandi.schoolhealthdesk.officialdocumentqa",
            "Official document QA config requires QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-official-document-qa",
            "Official document QA frontend requires QA feature"
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
