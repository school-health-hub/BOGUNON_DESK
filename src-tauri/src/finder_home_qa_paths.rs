use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};
pub const IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.finderhomeqa";
pub const PATH_ERROR: &str = "Finder QA isolated path or ownership check failed";
pub const MARKER: &str = ".finder-home-qa-runtime-owner.json";
#[derive(Clone)]
pub struct QaPaths {
    root: PathBuf,
    source_sha: String,
}
#[cfg(windows)]
fn is_reparse(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}
#[cfg(not(windows))]
fn is_reparse(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}
pub fn reject_links(path: &Path) -> Result<(), &'static str> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if is_reparse(&metadata) => return Err(PATH_ERROR),
            Ok(_) => (),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err(PATH_ERROR),
        }
    }
    Ok(())
}
pub fn valid_sha(sha: &str) -> bool {
    sha.len() == 40
        && sha
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
pub fn runtime_root(root: &Path) -> Result<(), &'static str> {
    let text = root.to_string_lossy().replace('\\', "/");
    let parent = root
        .parent()
        .ok_or(PATH_ERROR)?
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();
    let name = root
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(PATH_ERROR)?
        .to_ascii_lowercase();
    let suffix = name.strip_prefix("finder-home-qa-").ok_or(PATH_ERROR)?;
    let tail = suffix.rsplit('-').next().ok_or(PATH_ERROR)?;
    let reserved = matches!(tail, "con" | "prn" | "aux" | "nul")
        || (tail.len() == 4
            && (tail.starts_with("com") || tail.starts_with("lpt"))
            && matches!(tail.as_bytes()[3], b'1'..=b'9'));
    if !root.is_absolute()
        || !matches!(
            parent.as_str(),
            "e:/bogunon_dev/qa-output" | "d:/bogunon_dev/qa-output"
        )
        || text.contains("..")
        || suffix.is_empty()
        || !suffix
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphanumeric)
        || suffix.len() > 80
        || reserved
        || !suffix
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        || root
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err(PATH_ERROR);
    }
    reject_links(root)
}
impl QaPaths {
    // Runtime has no manifest-dir, runner path or AppData fallback.
    pub fn new(root: &Path, source_sha: &str) -> Result<Self, &'static str> {
        runtime_root(root)?;
        if !valid_sha(source_sha) {
            return Err(PATH_ERROR);
        }
        let paths = Self {
            root: root.to_path_buf(),
            source_sha: source_sha.to_owned(),
        };
        if !root.exists() {
            fs::create_dir_all(root).map_err(|_| PATH_ERROR)?;
        }
        reject_links(root)?;
        let marker = root.join(MARKER);
        reject_links(&marker)?;
        if !marker.exists() {
            // Never adopt an unowned directory or existing HOME-FINDER-3/4 evidence.
            if fs::read_dir(root).map_err(|_| PATH_ERROR)?.next().is_some() {
                return Err(PATH_ERROR);
            }
            let value = serde_json::json!({ "schema": 2, "identifier": IDENTIFIER,
                "sourceSha": source_sha, "purpose": "offline-finder-runtime" });
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&marker)
                .map_err(|_| PATH_ERROR)?;
            file.write_all(value.to_string().as_bytes())
                .map_err(|_| PATH_ERROR)?;
            file.sync_all().map_err(|_| PATH_ERROR)?;
        }
        paths.verify()?;
        Ok(paths)
    }
    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn directory(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }
    pub fn library(&self) -> PathBuf {
        self.root
            .join("data")
            .join(IDENTIFIER)
            .join("education-video")
            .join("library.json")
    }
    pub fn verify(&self) -> Result<(), &'static str> {
        runtime_root(&self.root)?;
        let marker = self.root.join(MARKER);
        reject_links(&marker)?;
        let metadata = fs::symlink_metadata(&marker).map_err(|_| PATH_ERROR)?;
        if !metadata.is_file() || metadata.len() > 8192 || is_reparse(&metadata) {
            return Err(PATH_ERROR);
        }
        let mut raw = String::new();
        fs::File::open(marker)
            .map_err(|_| PATH_ERROR)?
            .take(8193)
            .read_to_string(&mut raw)
            .map_err(|_| PATH_ERROR)?;
        if raw.len() > 8192 {
            return Err(PATH_ERROR);
        }
        let owner: serde_json::Value = serde_json::from_str(&raw).map_err(|_| PATH_ERROR)?;
        if owner["schema"] != 2
            || owner["identifier"] != IDENTIFIER
            || owner["sourceSha"] != self.source_sha
            || owner["purpose"] != "offline-finder-runtime"
        {
            return Err(PATH_ERROR);
        }
        for directory in ["webview", "data"] {
            reject_links(&self.directory(directory))?;
        }
        let library = self.library();
        reject_links(&library)?;
        if let Some(parent) = library.parent() {
            match fs::read_dir(parent) {
                Ok(entries) => {
                    for entry in entries {
                        reject_links(&entry.map_err(|_| PATH_ERROR)?.path())?;
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(_) => return Err(PATH_ERROR),
            }
        }
        Ok(())
    }
}
