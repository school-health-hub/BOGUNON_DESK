use super::{legacy, model::*, retention};
use atomic_write_file::AtomicWriteFile;
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};
fn read(path: &Path) -> Result<String, LibraryError> {
    let file = fs::File::open(path).map_err(|_| LibraryError::Io)?;
    let mut text = String::new();
    file.take((MAX_BYTES + 1) as u64)
        .read_to_string(&mut text)
        .map_err(|_| LibraryError::Corrupt)?;
    if text.len() > MAX_BYTES {
        return Err(LibraryError::Corrupt);
    }
    Ok(text)
}
fn atomic(path: &Path, bytes: &[u8]) -> Result<(), LibraryError> {
    let mut file = AtomicWriteFile::open(path).map_err(|_| LibraryError::Io)?;
    file.write_all(bytes).map_err(|_| LibraryError::Io)?;
    file.commit().map_err(|_| LibraryError::Io)
}
fn serialize(library: &Library) -> Result<String, LibraryError> {
    serde_json::to_string_pretty(library).map_err(|_| LibraryError::Invalid)
}
fn normalized(json: &str, now: i64) -> Result<(Library, bool), LibraryError> {
    let (mut library, migrated) = legacy::parse_any(json, now)?;
    let expired = retention::purge_metadata(&mut library, now)?;
    Ok((library, migrated || expired))
}
fn prune_backup(path: &Path, now: i64, primary: &Library) -> Result<(), LibraryError> {
    let backup = path.with_extension("backup.json");
    if !backup.is_file() {
        return Ok(());
    }
    match read(&backup).and_then(|text| normalized(&text, now)) {
        Ok((library, true)) => atomic(&backup, serialize(&library)?.as_bytes())?,
        Ok((_, false)) => {}
        Err(_) => {
            retention::quarantine(&backup, now)?;
            atomic(&backup, serialize(primary)?.as_bytes())?;
        }
    }
    Ok(())
}
pub fn recover(path: &Path) -> Result<LoadResult, LibraryError> {
    let now = retention::clock()?;
    let backup = read(&path.with_extension("backup.json")).map_err(|_| LibraryError::Corrupt)?;
    let (library, _) = normalized(&backup, now).map_err(|_| LibraryError::Corrupt)?;
    let json = serialize(&library)?;
    if path.exists() {
        retention::quarantine(path, now)?;
    }
    atomic(&path.with_extension("backup.json"), json.as_bytes())?;
    atomic(path, json.as_bytes())?;
    Ok(LoadResult {
        library,
        recovered: true,
    })
}
pub fn load(path: &Path) -> Result<LoadResult, LibraryError> {
    let now = retention::clock()?;
    let directory = path.parent().ok_or(LibraryError::Io)?;
    retention::cleanup(directory, now)?;
    if !path.exists() {
        if path.with_extension("backup.json").exists() {
            return recover(path);
        }
        return Ok(LoadResult {
            library: Library::default(),
            recovered: false,
        });
    }
    match read(path).and_then(|text| normalized(&text, now).map(|value| (text, value))) {
        Ok((original, (library, changed))) => {
            prune_backup(path, now, &library)?;
            if changed {
                let (_, migrated) = legacy::parse_any(&original, now)?;
                if migrated && !path.with_extension("v1-backup.json").exists() {
                    atomic(&path.with_extension("v1-backup.json"), original.as_bytes())?;
                }
                let json = serialize(&library)?;
                atomic(&path.with_extension("backup.json"), json.as_bytes())?;
                atomic(path, json.as_bytes())?;
            }
            Ok(LoadResult {
                library,
                recovered: false,
            })
        }
        Err(_) => recover(path),
    }
}
fn persist(path: &Path, library: &Library) -> Result<(), LibraryError> {
    let mut library = library.clone();
    let now = retention::clock()?;
    retention::purge_metadata(&mut library, now)?;
    let json = serialize(&library)?;
    parse(&json)?;
    fs::create_dir_all(path.parent().ok_or(LibraryError::Io)?).map_err(|_| LibraryError::Io)?;
    if path.exists() {
        let previous = read(path)?;
        let (previous, _) = normalized(&previous, now)?;
        atomic(
            &path.with_extension("backup.json"),
            serialize(&previous)?.as_bytes(),
        )?;
    } else {
        atomic(&path.with_extension("backup.json"), json.as_bytes())?;
    }
    atomic(path, json.as_bytes())
}
pub fn save_entry(path: &Path, mut entry: LibraryEntry) -> Result<LoadResult, LibraryError> {
    entry.validate()?;
    entry.expire(retention::clock()?)?;
    let mut result = load(path)?;
    match result
        .library
        .entries
        .iter_mut()
        .find(|old| old.video_id == entry.video_id)
    {
        Some(old) => *old = entry,
        None => result.library.entries.push(entry),
    }
    persist(path, &result.library)?;
    Ok(result)
}
pub fn import(path: &Path, json: &str) -> Result<LoadResult, LibraryError> {
    let (mut incoming, _) = normalized(json, retention::clock()?)?;
    let mut result = load(path)?;
    for entry in incoming.entries.drain(..) {
        match result
            .library
            .entries
            .iter_mut()
            .find(|old| old.video_id == entry.video_id)
        {
            Some(old) => {
                if entry.provider.is_some() {
                    old.provider = entry.provider;
                }
            }
            None => result.library.entries.push(entry),
        }
    }
    persist(path, &result.library)?;
    Ok(result)
}
pub fn export(path: &Path) -> Result<String, LibraryError> {
    serialize(&load(path)?.library)
}
pub fn delete_metadata(path: &Path, video_id: &str) -> Result<LoadResult, LibraryError> {
    let mut result = load(path)?;
    let entry = result
        .library
        .entries
        .iter_mut()
        .find(|entry| entry.video_id == video_id)
        .ok_or(LibraryError::Invalid)?;
    entry.provider = None;
    persist(path, &result.library)?;
    let backup = path.with_extension("backup.json");
    if backup.is_file() {
        let (mut library, _) = normalized(&read(&backup)?, retention::clock()?)?;
        for entry in &mut library.entries {
            if entry.video_id == video_id {
                entry.provider = None;
            }
        }
        atomic(&backup, serialize(&library)?.as_bytes())?;
    }
    Ok(result)
}
pub fn refresh_metadata(
    path: &Path,
    video_id: &str,
    provider: ProviderMetadata,
) -> Result<LoadResult, LibraryError> {
    provider.validate(video_id)?;
    let mut result = load(path)?;
    let entry = result
        .library
        .entries
        .iter_mut()
        .find(|entry| entry.video_id == video_id)
        .ok_or(LibraryError::Invalid)?;
    entry.provider = Some(provider);
    entry.expire(retention::clock()?)?;
    persist(path, &result.library)?;
    Ok(result)
}
