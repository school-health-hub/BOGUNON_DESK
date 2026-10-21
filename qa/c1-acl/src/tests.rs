use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    error::Error,
    fs,
};
use tauri::{
    ipc::Origin,
    utils::acl::{capability::Capability, manifest::Manifest, APP_ACL_KEY},
};

include!(concat!(env!("OUT_DIR"), "/context.rs"));

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Inventory {
    production: Vec<String>,
    qa: Vec<String>,
    all: Vec<String>,
    configuration: String,
    source: String,
    controller: String,
    run: String,
    attempt: String,
    generated_hashes: BTreeMap<String, String>,
}

fn inputs() -> Result<Inventory> {
    Ok(serde_json::from_str(&fs::read_to_string(std::env::var(
        "C1_INVENTORY",
    )?)?)?)
}

fn manifest() -> Result<BTreeMap<String, Manifest>> {
    Ok(serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/acl-manifests.json"
    )))?)
}

#[test]
fn generated_permissions_cover_exact_source_inventories() -> Result<()> {
    let input = inputs()?;
    assert_eq!(input.production.len(), 61);
    assert_eq!(input.qa.len(), 12);
    assert_eq!(input.all.len(), 62);
    assert_eq!(input.source, "ab5eb3f078b63428511d758137ba7747e54396f0");
    assert_eq!(input.attempt, "1");
    let manifests = manifest()?;
    let app = manifests
        .get(APP_ACL_KEY)
        .ok_or("generated app ACL missing")?;
    assert!(app.default_permission.is_none());
    assert_eq!(app.permissions.len(), 124);
    assert_eq!(app.permission_sets.len(), 2);
    for command in &input.all {
        let id = command.replace('_', "-");
        let allow = app
            .permissions
            .get(&format!("allow-{id}"))
            .ok_or("allow permission missing")?;
        let deny = app
            .permissions
            .get(&format!("deny-{id}"))
            .ok_or("deny permission missing")?;
        assert_eq!(allow.commands.allow, [command.clone()]);
        assert!(allow.commands.deny.is_empty());
        assert_eq!(deny.commands.deny, [command.clone()]);
        assert!(deny.commands.allow.is_empty());
    }
    for (name, commands) in [
        ("main-commands", &input.production),
        ("finance-qa-commands", &input.qa),
    ] {
        let actual: BTreeSet<_> = app
            .permission_sets
            .get(name)
            .ok_or("permission set missing")?
            .permissions
            .iter()
            .cloned()
            .collect();
        let expected: BTreeSet<_> = commands
            .iter()
            .map(|name| format!("allow-{}", name.replace('_', "-")))
            .collect();
        assert_eq!(actual, expected);
    }
    Ok(())
}

#[test]
fn actual_generated_context_enforces_main_only_acl_and_reports_plugin_limit() -> Result<()> {
    let input = inputs()?;
    for (name, bytes) in [
        (
            "acl-manifests.json",
            include_bytes!(concat!(env!("OUT_DIR"), "/acl-manifests.json")).as_slice(),
        ),
        (
            "capabilities.json",
            include_bytes!(concat!(env!("OUT_DIR"), "/capabilities.json")).as_slice(),
        ),
    ] {
        assert_eq!(
            input.generated_hashes.get(name),
            Some(&format!("{:x}", Sha256::digest(bytes)))
        );
    }
    let mut context = source_context();
    let qa = match input.configuration.as_str() {
        "production" => false,
        "finance-qa" => true,
        _ => return Err("unknown configuration".into()),
    };
    assert_eq!(
        context.config().identifier,
        if qa {
            "kr.sungandi.schoolhealthdesk.myfinanceqa"
        } else {
            "kr.sungandi.schoolhealthdesk"
        }
    );
    if qa {
        assert!(!context.config().plugins.0.contains_key("updater"));
        assert!(!context.config().plugins.0.contains_key("deep-link"));
    }
    let raw: BTreeMap<String, Capability> =
        serde_json::from_str(include_str!(concat!(env!("OUT_DIR"), "/capabilities.json")))?;
    let effective = tauri::utils::acl::get_capabilities(context.config(), raw, None)?;
    assert_eq!(effective.len(), 1);
    for cap in effective.values() {
        assert!(cap.windows.is_empty());
        assert_eq!(cap.webviews, ["main"]);
        assert!(cap.local);
        assert!(cap.remote.is_none());
    }
    let resolved = tauri::utils::acl::resolved::Resolved::resolve(
        &manifest()?,
        effective.clone(),
        tauri::utils::platform::Target::Windows,
    )?;
    assert!(resolved.has_app_acl);
    let expected = if qa { &input.qa } else { &input.production };
    let actual: BTreeSet<_> = resolved
        .allowed_commands
        .keys()
        .filter(|key| !key.starts_with("plugin:"))
        .cloned()
        .collect();
    assert_eq!(actual, expected.iter().cloned().collect());
    let authority = context.runtime_authority_mut();
    for command in &input.all {
        assert_eq!(
            authority
                .resolve_access(command, "main", "main", &Origin::Local)
                .is_some(),
            expected.contains(command),
            "{command}"
        );
    }
    let remote = Origin::Remote {
        url: "https://example.invalid/".parse()?,
    };
    for command in resolved.allowed_commands.keys() {
        assert!(
            authority
                .resolve_access(command, "main", "main", &Origin::Local)
                .is_some(),
            "Main grant missing: {command}"
        );
        for (window, webview) in [
            ("surface", "surface"),
            ("other", "other"),
            ("main", "surface"),
            ("main", "untrusted"),
        ] {
            assert!(
                authority
                    .resolve_access(command, window, webview, &Origin::Local)
                    .is_none(),
                "nonMain allowed: {command}"
            );
        }
        assert!(authority
            .resolve_access(command, "main", "main", &remote)
            .is_none());
    }
    let plugins: Vec<_> = resolved
        .allowed_commands
        .keys()
        .filter(|key| key.starts_with("plugin:"))
        .collect();
    assert!(!plugins.is_empty(), "core/plugin inventory missing");
    let report = serde_json::json!({
        "schema": 1, "configuration": input.configuration, "sourceSha": input.source,
        "controllerSha": input.controller, "runId": input.run, "attempt": input.attempt,
        "generatedHashes": input.generated_hashes, "effectiveCapabilities": effective,
        "customCommandCount": expected.len(), "uniqueManifestCommands": input.all.len(),
        "generatedContextAcl": "PASS", "nonMainAdmission": "DENIED", "pluginCoreCommands": plugins,
        "pluginCoreGenerationRevocation": "BLOCKED_NOT_IMPLEMENTED",
        "actualWindowsWebviewRuntime": "NOT_VERIFIED",
        "inspectionApi": "Tauri 2.11.5 pinned diagnostic runtime_authority_mut (unstable); not production code"
    });
    fs::write(
        std::env::var("C1_REPORT")?,
        serde_json::to_string_pretty(&report)?,
    )?;
    Ok(())
}
