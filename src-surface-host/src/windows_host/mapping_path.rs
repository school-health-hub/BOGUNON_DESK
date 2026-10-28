use std::path::{Component, Path, PathBuf, Prefix};

use super::HostError;

#[cfg(test)]
#[path = "../windows_host_path_tests.rs"]
mod path_tests;

pub(super) fn resolve_surface_bundle_mapping(bundle_dir: &Path) -> Result<PathBuf, HostError> {
    let canonical = bundle_dir
        .canonicalize()
        .map_err(|_| HostError::InvalidBundle)?;
    if !canonical.join("surface.html").is_file() {
        return Err(HostError::InvalidBundle);
    }
    webview_mapping_path(&canonical)
}

fn webview_mapping_path(path: &Path) -> Result<PathBuf, HostError> {
    if !path.is_absolute() {
        return Err(HostError::InvalidMappingPath);
    }

    let mut components = path.components();
    let prefix = match components.next() {
        Some(Component::Prefix(prefix)) => prefix.kind(),
        _ => return Err(HostError::InvalidMappingPath),
    };
    let mut mapping = match prefix {
        Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => {
            PathBuf::from(format!("{}:\\", char::from(drive)))
        }
        Prefix::UNC(server, share) | Prefix::VerbatimUNC(server, share) => {
            let mut mapping = PathBuf::from(r"\\");
            mapping.push(server);
            mapping.push(share);
            mapping
        }
        Prefix::DeviceNS(_) | Prefix::Verbatim(_) => {
            return Err(HostError::InvalidMappingPath);
        }
    };

    for component in components {
        match component {
            Component::RootDir => {}
            Component::Normal(segment) => mapping.push(segment),
            Component::CurDir | Component::ParentDir | Component::Prefix(_) => {
                return Err(HostError::InvalidMappingPath);
            }
        }
    }
    Ok(mapping)
}
