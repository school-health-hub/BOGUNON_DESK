use std::{env, error::Error, fs, path::PathBuf};

fn main() -> Result<(), Box<dyn Error>> {
    let source = PathBuf::from(env::var("C2C2_SOURCE_ROOT")?).canonicalize()?;
    let source_output = PathBuf::from(env::var("C2C2_SOURCE_OUT_DIR")?).canonicalize()?;
    let output = PathBuf::from(env::var("OUT_DIR")?);
    for variable in [
        "C2C2_SOURCE_ROOT",
        "C2C2_SOURCE_OUT_DIR",
        "C2C2_INVENTORY",
        "TAURI_CONFIG",
    ] {
        println!("cargo:rerun-if-env-changed={variable}");
    }
    for file in ["acl-manifests.json", "capabilities.json"] {
        let input = source_output.join(file);
        println!("cargo:rerun-if-changed={}", input.display());
        fs::copy(input, output.join(file))?;
    }
    let config = source.join("src-tauri/tauri.conf.json");
    println!("cargo:rerun-if-changed={}", config.display());
    let path = config.to_str().ok_or("non-UTF8 source config path")?;
    fs::write(output.join("context.rs"), format!(
        "fn source_context() -> tauri::Context<tauri::test::MockRuntime> {{ tauri::generate_context!({path:?}) }}\n"
    ))?;
    Ok(())
}
