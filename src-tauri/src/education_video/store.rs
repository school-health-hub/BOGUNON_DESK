use super::model::*;
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

pub fn recover(path: &Path) -> Result<LoadResult, LibraryError> {
    let backup = read(&path.with_extension("backup.json")).map_err(|_| LibraryError::Corrupt)?;
    let library = parse(&backup).map_err(|_| LibraryError::Corrupt)?;
    if path.exists() {
        let quarantine = if path.with_extension("corrupt.json").exists() {
            path.with_extension(format!("corrupt-{}.json", uuid::Uuid::new_v4()))
        } else {
            path.with_extension("corrupt.json")
        };
        fs::copy(path, quarantine).map_err(|_| LibraryError::Io)?;
    }
    atomic(path, backup.as_bytes())?;
    Ok(LoadResult {
        library,
        recovered: true,
    })
}

pub fn load(path: &Path) -> Result<LoadResult, LibraryError> {
    if !path.exists() {
        if path.with_extension("backup.json").exists() {
            return recover(path);
        }
        return Ok(LoadResult {
            library: Library::default(),
            recovered: false,
        });
    }
    match read(path).and_then(|json| parse(&json)) {
        Ok(library) => Ok(LoadResult {
            library,
            recovered: false,
        }),
        Err(_) => recover(path),
    }
}

fn persist(path: &Path, library: &Library) -> Result<(), LibraryError> {
    let json = serde_json::to_string_pretty(library).map_err(|_| LibraryError::Invalid)?;
    parse(&json)?;
    let parent = path.parent().ok_or(LibraryError::Io)?;
    fs::create_dir_all(parent).map_err(|_| LibraryError::Io)?;
    if path.exists() {
        let previous = read(path)?;
        parse(&previous)?;
        atomic(&path.with_extension("backup.json"), previous.as_bytes())?;
    } else {
        atomic(&path.with_extension("backup.json"), json.as_bytes())?;
    }
    atomic(path, json.as_bytes())
}

pub fn save_item(path: &Path, item: LibraryItem) -> Result<LoadResult, LibraryError> {
    item.validate()?;
    let mut result = load(path)?;
    match result
        .library
        .items
        .iter_mut()
        .find(|existing| existing.video_id == item.video_id)
    {
        Some(existing) => *existing = item,
        None => result.library.items.push(item),
    }
    persist(path, &result.library)?;
    Ok(result)
}

pub fn import(path: &Path, json: &str) -> Result<LoadResult, LibraryError> {
    let incoming = parse(json)?;
    let mut result = load(path)?;
    for mut item in incoming.items {
        match result
            .library
            .items
            .iter_mut()
            .find(|existing| existing.video_id == item.video_id)
        {
            Some(existing) => {
                item.notes.clone_from(&existing.notes);
                item.message.clone_from(&existing.message);
                *existing = item;
            }
            None => result.library.items.push(item),
        }
    }
    persist(path, &result.library)?;
    Ok(result)
}

pub fn export(path: &Path) -> Result<String, LibraryError> {
    serde_json::to_string_pretty(&load(path)?.library).map_err(|_| LibraryError::Invalid)
}
