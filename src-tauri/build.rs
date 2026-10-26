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
    println!("cargo:rerun-if-env-changed=NEWSLETTER_QA_SOURCE_SHA");
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    let mut config: Value = serde_json::from_str(include_str!("tauri.conf.json")).unwrap();
    if let Ok(patch) = std::env::var("TAURI_CONFIG") {
        merge(
            &mut config,
            serde_json::from_str(&patch).expect("Invalid Tauri config overlay"),
        );
    }
    let finance_qa = std::env::var_os("CARGO_FEATURE_MY_FINANCE_QA").is_some();
    let newsletter_qa = std::env::var_os("CARGO_FEATURE_NEWSLETTER_STORAGE_QA").is_some();
    assert!(
        !(finance_qa && newsletter_qa),
        "QA flavors are mutually exclusive"
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
    } else if newsletter_qa {
        println!("cargo:rerun-if-changed=../dist-newsletter-storage-qa/qa-build.json");
        assert_eq!(
            id, "kr.sungandi.schoolhealthdesk.newsletterqa",
            "Newsletter QA feature requires Newsletter QA config"
        );
        assert_eq!(config["productName"], "BOGUNON DESK Newsletter Storage QA");
        assert_eq!(
            config["mainBinaryName"],
            "bogunon-desk-newsletter-storage-qa"
        );
        assert_eq!(
            config["build"]["frontendDist"],
            "../dist-newsletter-storage-qa"
        );
        assert!(
            config["plugins"].get("updater").is_none()
                && config["plugins"].get("deep-link").is_none(),
            "Newsletter QA must not register production integrations"
        );
        let sha =
            std::env::var("NEWSLETTER_QA_SOURCE_SHA").expect("Newsletter QA source SHA required");
        assert!(sha.len() == 40 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()));
        let stamp: Value = serde_json::from_str(
            &std::fs::read_to_string("../dist-newsletter-storage-qa/qa-build.json")
                .expect("Build Newsletter QA frontend first"),
        )
        .expect("Invalid Newsletter QA frontend stamp");
        assert_eq!(stamp["sourceSha"], sha, "Newsletter QA source mismatch");
        assert_eq!(stamp["identifier"], id);
        assert_eq!(stamp["entrypoint"], "storage.html");
        println!("cargo:rustc-env=NEWSLETTER_QA_SOURCE_SHA={sha}");
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
            id, "kr.sungandi.schoolhealthdesk.newsletterqa",
            "Newsletter QA config requires Newsletter QA feature"
        );
        assert_ne!(
            config["build"]["frontendDist"], "../dist-newsletter-storage-qa",
            "Newsletter QA frontend requires Newsletter QA feature"
        );
    }
    tauri_build::build()
}
