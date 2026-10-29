#[path = "src/finder_home_qa_paths.rs"]
mod paths;

use serde_json::Value;
use std::{error::Error, path::Path};

pub fn validate(config: &Value) -> Result<(), Box<dyn Error>> {
    for variable in [
        "BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT",
        "BOGUNON_FINDER_HOME_QA_SOURCE_SHA",
        "CARGO_TARGET_DIR",
        "TEMP",
        "TMP",
    ] {
        println!("cargo:rerun-if-env-changed={variable}");
    }
    let output = std::env::var("BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT")?;
    let source = std::env::var("BOGUNON_FINDER_HOME_QA_SOURCE_SHA")?;
    let manifest = std::env::var("CARGO_MANIFEST_DIR")?;
    let project = Path::new(&manifest).parent().ok_or(paths::PATH_ERROR)?;
    let root = Path::new(&output);
    let hosted = std::env::var("GITHUB_ACTIONS").as_deref() == Ok("true")
        && std::env::var("CI").as_deref() == Ok("true")
        && std::env::var("RUNNER_TEMP")
            .ok()
            .is_some_and(|temp| root.parent() == Some(Path::new(&temp)))
        && root
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| {
                name.strip_prefix("finder-home-qa-").is_some_and(|suffix| {
                    !suffix.is_empty()
                        && suffix
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                })
            });
    if !hosted {
        paths::runtime_root(root)?;
    }
    paths::reject_links(root)?;
    let owner_file = root.join(".finder-home-qa-owner.json");
    paths::reject_links(&owner_file)?;
    let owner_metadata = std::fs::metadata(&owner_file)?;
    if !owner_metadata.is_file() || owner_metadata.len() > 8192 {
        return Err("Invalid build owner marker".into());
    }
    let owner: Value = serde_json::from_str(&std::fs::read_to_string(owner_file)?)?;
    if owner["identifier"] != paths::IDENTIFIER
        || owner["projectRoot"] != project.to_string_lossy().as_ref()
    {
        return Err("Finder QA build owner mismatch".into());
    }
    if !paths::valid_sha(&source) {
        return Err("Finder QA source SHA must be forty hexadecimal characters".into());
    }
    let equals = |actual: &str, expected: &Path| {
        actual
            .replace('\\', "/")
            .eq_ignore_ascii_case(&expected.to_string_lossy().replace('\\', "/"))
    };
    for (variable, child) in [
        ("CARGO_TARGET_DIR", "target"),
        ("TEMP", "temp"),
        ("TMP", "temp"),
    ] {
        let child = root.join(child);
        paths::reject_links(&child)?;
        if !equals(&std::env::var(variable)?, &child) {
            return Err("Finder QA requires dedicated target and temporary directories".into());
        }
    }
    if config["identifier"] != paths::IDENTIFIER
        || config["productName"] != "BOGUNON DESK FINDER HOME QA"
        || config["mainBinaryName"] != "bogunon-desk-finder-home-qa"
        || config["build"]["devUrl"].is_string()
        || !config["build"]["beforeBuildCommand"].is_null()
        || !config["build"]["beforeDevCommand"].is_null()
        || config["app"]["windows"] != serde_json::json!([])
        || config["bundle"]["active"] != false
        || config["bundle"]["createUpdaterArtifacts"] != false
        || config["plugins"] != serde_json::json!({})
        || config["app"]["security"]["capabilities"]
            != serde_json::json!([{
                "identifier": "finder-home-qa-local-only", "windows": ["finder-home-qa"], "permissions": []
            }])
    {
        return Err("Finder QA config boundary mismatch".into());
    }
    let policy = serde_json::json!({
        "default-src": "'none'", "script-src": "'self'", "style-src": "'self'",
        "style-src-attr": "'unsafe-inline'", "font-src": "'self'", "img-src": "'self' data:",
        "connect-src": "ipc: http://ipc.localhost", "object-src": "'none'", "frame-src": "'none'",
        "frame-ancestors": "'none'", "base-uri": "'none'", "form-action": "'none'", "worker-src": "'none'"
    });
    if config["app"]["security"]["csp"] != policy || config["app"]["security"]["devCsp"] != policy {
        return Err("Finder QA CSP boundary mismatch".into());
    }
    let dist = root.join("dist");
    let reference = config["build"]["frontendDist"]
        .as_str()
        .ok_or("Frontend directory required")?;
    let reference_path = Path::new(reference);
    if reference.contains(':') || reference_path.is_absolute() {
        return Err("Finder QA frontend must be a relative directory, never a URL".into());
    }
    let configured_dist = Path::new(&manifest).join(reference);
    paths::reject_links(&configured_dist)?;
    if std::fs::canonicalize(configured_dist)? != std::fs::canonicalize(&dist)? {
        return Err("Finder QA frontend must use its isolated build output root".into());
    }
    let stamp_file = dist.join("qa-build.json");
    paths::reject_links(&stamp_file)?;
    println!("cargo:rerun-if-changed={}", stamp_file.display());
    let stamp: Value = serde_json::from_str(&std::fs::read_to_string(stamp_file)?)?;
    if stamp["sourceSha"] != source
        || stamp["identifier"] != paths::IDENTIFIER
        || stamp["externalConnections"] != false
        || !stamp["sourceDirty"].is_boolean()
    {
        return Err("Finder QA frontend provenance mismatch".into());
    }
    println!("cargo:rustc-env=BOGUNON_FINDER_HOME_QA_SOURCE_SHA={source}");
    println!(
        "cargo:rustc-env=BOGUNON_FINDER_HOME_QA_SOURCE_DIRTY={}",
        stamp["sourceDirty"]
    );
    Ok(())
}
