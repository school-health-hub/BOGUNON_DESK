use std::{
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
};

pub const IDENTIFIER: &str = "kr.sungandi.schoolhealthdesk.finderhomeqa";
pub const PATH_ERROR: &str = "Finder QA E: isolation check failed";
pub const MARKER: &str = ".finder-home-qa-owner.json";

#[derive(Clone)]
pub struct QaPaths {
    root: PathBuf,
    project_root: PathBuf,
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

fn same_path(left: &Path, right: &Path) -> bool {
    left.to_string_lossy()
        .replace('\\', "/")
        .eq_ignore_ascii_case(&right.to_string_lossy().replace('\\', "/"))
}

impl QaPaths {
    pub fn new(root: &Path, project_root: &Path) -> Result<Self, &'static str> {
        let text = root.to_string_lossy().replace('\\', "/");
        let safe_name = root
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
        if !root.is_absolute()
            || !safe_name
            || !text
                .to_ascii_lowercase()
                .starts_with("e:/bogunon_dev/qa-output/finder-home-qa-")
            || root
                .parent()
                .is_none_or(|parent| !same_path(parent, Path::new("E:/BOGUNON_DEV/qa-output")))
            || root
                .components()
                .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
        {
            return Err(PATH_ERROR);
        }
        let paths = Self {
            root: root.to_path_buf(),
            project_root: project_root.to_path_buf(),
        };
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
        reject_links(&self.root.join(MARKER))?;
        if !self.root.is_dir() {
            return Err(PATH_ERROR);
        }
        let mut marker = String::new();
        fs::File::open(self.root.join(MARKER))
            .map_err(|_| PATH_ERROR)?
            .take(8193)
            .read_to_string(&mut marker)
            .map_err(|_| PATH_ERROR)?;
        if marker.len() > 8192 {
            return Err(PATH_ERROR);
        }
        let owner: serde_json::Value = serde_json::from_str(&marker).map_err(|_| PATH_ERROR)?;
        let project = owner["projectRoot"].as_str().ok_or(PATH_ERROR)?;
        if owner["identifier"] != IDENTIFIER || !same_path(Path::new(project), &self.project_root) {
            return Err(PATH_ERROR);
        }
        for directory in ["dist", "cache", "temp", "logs", "target", "webview", "data"] {
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
