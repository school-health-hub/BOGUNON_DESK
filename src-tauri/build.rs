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
    assert!(
        !(finance_qa && official_document_qa),
        "QA features are mutually exclusive"
    );
    let id = config["identifier"].as_str().unwrap_or_default();
    if finance_qa {
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
    }
    tauri_build::build()
}
