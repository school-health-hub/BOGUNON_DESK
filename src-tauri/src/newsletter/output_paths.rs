use std::{fs, path::Path};

pub(super) fn safe_target(target: &Path) -> Result<std::path::PathBuf, String> {
    let metadata = fs::symlink_metadata(target)
        .map_err(|_| "선택한 출력 위치를 사용할 수 없습니다.".to_owned())?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        return Err("선택한 출력 위치를 사용할 수 없습니다.".to_owned());
    }
    let canonical = fs::canonicalize(target)
        .map_err(|_| "선택한 출력 위치를 사용할 수 없습니다.".to_owned())?;
    inspect_ancestors(&canonical)?;
    Ok(canonical)
}

pub(super) fn reject_existing_link(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "출력 파일을 확인할 수 없습니다.".to_owned())?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) || !metadata.is_file() {
        Err("출력 파일을 안전하게 저장할 수 없습니다.".to_owned())
    } else {
        Ok(())
    }
}

fn inspect_ancestors(path: &Path) -> Result<(), String> {
    for ancestor in path.ancestors() {
        if ancestor.as_os_str().is_empty() {
            continue;
        }
        let metadata = fs::symlink_metadata(ancestor)
            .map_err(|_| "선택한 출력 위치를 사용할 수 없습니다.".to_owned())?;
        if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
            return Err("선택한 출력 위치를 사용할 수 없습니다.".to_owned());
        }
    }
    Ok(())
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
const fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
