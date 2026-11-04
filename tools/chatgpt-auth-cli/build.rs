use std::{env, fs, path::Path};
// Compile the audited original core, including its tests. Only remove the Tauri command
// adapter and substitute its runtime task adapter. No copied authentication implementation.
fn copy(source: &Path, target: &Path) {
    fs::create_dir_all(target).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let name = entry.file_name();
        let input = entry.path();
        let output = target.join(&name);
        if input.is_dir() {
            copy(&input, &output);
            continue;
        }
        if input.extension().is_none_or(|ext| ext != "rs") {
            continue;
        }
        println!("cargo:rerun-if-changed={}", input.display());
        let mut text = fs::read_to_string(&input).unwrap();
        if name == "mod.rs" && source.ends_with("chatgpt") {
            assert!(text.contains("pub(crate) mod commands;"));
            text = text
                .replace("pub(crate) mod commands;", "")
                .replace("mod lifecycle;", "pub(crate) mod lifecycle;");
        }
        if name == "lifecycle.rs" {
            assert_eq!(
                text.matches("tauri::async_runtime::spawn_blocking").count(),
                1
            );
            text = text.replace(
                "tauri::async_runtime::spawn_blocking",
                "tokio::task::spawn_blocking",
            );
        }
        // Legacy unit tests used Tauri's block_on; keep tests, swap only their executor.
        if text.contains("tauri::async_runtime::block_on") {
            text = text.replace("tauri::async_runtime::block_on", "crate::test_block_on");
        }
        if name == "plan.rs" {
            text.push_str(
                "\ninclude!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/src/images.rs\"));\n",
            );
        }
        fs::write(output, text).unwrap();
    }
}
fn main() {
    println!("cargo:rerun-if-changed=src/images.rs");
    println!("cargo:rerun-if-changed=../../electron-p0/ai-image-capabilities.json");
    copy(
        Path::new("../../src-tauri/src/chatgpt"),
        &Path::new(&env::var("OUT_DIR").unwrap()).join("chatgpt"),
    );
}
