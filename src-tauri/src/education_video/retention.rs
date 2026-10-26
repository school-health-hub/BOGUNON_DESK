//! Bounded-age raw recovery evidence; only this module's quarantine files are touched.
use super::{
    model::{Library, LibraryError},
    timestamps,
};
use atomic_write_file::AtomicWriteFile;
use std::{fs, io::Write, path::Path};
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    delete_after: i64,
}
pub fn purge_metadata(library: &mut Library, now: i64) -> Result<bool, LibraryError> {
    let mut changed = false;
    for entry in &mut library.entries {
        changed |= entry.expire(now)?;
    }
    Ok(changed)
}
pub fn cleanup(directory: &Path, now: i64) -> Result<(), LibraryError> {
    let quarantine = directory.join("quarantine");
    if !quarantine.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&quarantine).map_err(|_| LibraryError::Io)? {
        let entry = entry.map_err(|_| LibraryError::Io)?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        let Some(id) = name.strip_suffix(".retention.json") else {
            continue;
        };
        if uuid::Uuid::parse_str(id).is_err() {
            continue;
        }
        // An unclassifiable housekeeping receipt cannot make valid teacher data unreadable.
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.len() > 1024 {
            continue;
        }
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        let Ok(receipt) = serde_json::from_slice::<Receipt>(&bytes) else {
            continue;
        };
        if receipt.delete_after <= now {
            let raw = quarantine.join(format!("{id}.raw"));
            if raw.exists() {
                fs::remove_file(raw).map_err(|_| LibraryError::Io)?;
            }
            fs::remove_file(entry.path()).map_err(|_| LibraryError::Io)?;
        }
    }
    Ok(())
}
pub fn quarantine(path: &Path, now: i64) -> Result<(), LibraryError> {
    let directory = path.parent().ok_or(LibraryError::Io)?.join("quarantine");
    fs::create_dir_all(&directory).map_err(|_| LibraryError::Io)?;
    let id = uuid::Uuid::new_v4();
    let receipt = serde_json::to_vec(&Receipt {
        delete_after: now + 24 * 60 * 60 * 1000,
    })
    .map_err(|_| LibraryError::Invalid)?;
    let mut file = AtomicWriteFile::open(directory.join(format!("{id}.retention.json")))
        .map_err(|_| LibraryError::Io)?;
    file.write_all(&receipt).map_err(|_| LibraryError::Io)?;
    file.commit().map_err(|_| LibraryError::Io)?;
    fs::copy(path, directory.join(format!("{id}.raw"))).map_err(|_| LibraryError::Io)?;
    Ok(())
}
pub fn clock() -> Result<i64, LibraryError> {
    timestamps::now_ms()
}
