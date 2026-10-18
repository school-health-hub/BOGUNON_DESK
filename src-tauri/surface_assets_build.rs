use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub fn generate() -> Result<(), Box<dyn std::error::Error>> {
    let manifest = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").ok_or("manifest missing")?);
    let root = manifest.join("../dist-surface");
    let output = PathBuf::from(std::env::var_os("OUT_DIR").ok_or("output missing")?);
    println!("cargo:rerun-if-changed=surface_assets_build.rs");
    println!("cargo:rerun-if-changed={}", root.display());
    let captured = capture(&root).unwrap_or_default();
    let mut source = String::from("static EMBEDDED: &[(&str, &[u8])] = &[\n");
    for (index, (name, bytes)) in captured.iter().enumerate() {
        let snapshot = output.join(format!("surface-snapshot-{index}"));
        fs::write(&snapshot, bytes)?;
        source.push_str(&format!("({name:?}, include_bytes!({:?})),\n", snapshot));
    }
    source.push_str("];\n");
    fs::write(output.join("surface_assets.rs"), source)?;
    Ok(())
}

fn capture(root: &Path) -> io::Result<Vec<(String, Vec<u8>)>> {
    plain(root, true)?;
    plain(&root.join("assets"), true)?;
    plain(&root.join(".vite"), true)?;
    let mut names = vec![
        "surface.html".to_owned(),
        ".vite/surface-isolation.json".to_owned(),
    ];
    for entry in fs::read_dir(root.join("assets"))? {
        let entry = entry?;
        let name = entry.file_name().into_string().map_err(|_| invalid())?;
        if !name.starts_with("surface-")
            || !(name.ends_with(".js") || name.ends_with(".css"))
            || !name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        {
            return Err(invalid());
        }
        names.push(format!("assets/{name}"));
    }
    if names.len() < 4 || names.len() > 16 {
        return Err(invalid());
    }
    names.sort();
    let mut total = 0usize;
    names
        .into_iter()
        .map(|name| {
            let path = root.join(&name);
            plain(&path, false)?;
            let length = usize::try_from(fs::metadata(&path)?.len()).map_err(|_| invalid())?;
            total = total
                .checked_add(length)
                .filter(|n| *n <= 4 * 1024 * 1024)
                .ok_or_else(invalid)?;
            Ok((name, fs::read(path)?))
        })
        .collect()
}

fn plain(path: &Path, directory: bool) -> io::Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err(invalid());
        }
    }
    if metadata.file_type().is_symlink() || metadata.is_dir() != directory {
        return Err(invalid());
    }
    Ok(())
}
fn invalid() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "surface assets unavailable")
}
