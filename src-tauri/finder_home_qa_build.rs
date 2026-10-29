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
    let paths = paths::QaPaths::new(Path::new(&output), project)?;
    if source.len() != 40 || !source.bytes().all(|byte| byte.is_ascii_hexdigit()) {
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
        if !equals(&std::env::var(variable)?, &paths.directory(child)) {
            return Err("Finder QA requires dedicated E: target and temporary directories".into());
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
    let dist = paths.directory("dist");
    if !config["build"]["frontendDist"]
        .as_str()
        .is_some_and(|value| equals(value, &dist))
    {
        return Err("Finder QA frontend must use its E: output root".into());
    }
    let stamp_file = dist.join("qa-build.json");
    paths::reject_links(&stamp_file)?;
    println!("cargo:rerun-if-changed={}", stamp_file.display());
    let stamp: Value = serde_json::from_str(&std::fs::read_to_string(stamp_file)?)?;
    if stamp["sourceSha"] != source
        || stamp["identifier"] != paths::IDENTIFIER
        || stamp["externalConnections"] != false
        || !stamp["frontendDist"]
            .as_str()
            .is_some_and(|value| equals(value, &dist))
        || !stamp["projectRoot"]
            .as_str()
            .is_some_and(|value| equals(value, project))
        || !stamp["sourceDirty"].is_boolean()
    {
        return Err("Finder QA frontend provenance mismatch".into());
    }
    println!("cargo:rustc-env=BOGUNON_FINDER_HOME_QA_SOURCE_SHA={source}");
    println!(
        "cargo:rustc-env=BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT={}",
        paths.root().display()
    );
    println!(
        "cargo:rustc-env=BOGUNON_FINDER_HOME_QA_SOURCE_DIRTY={}",
        stamp["sourceDirty"]
    );
    Ok(())
}
