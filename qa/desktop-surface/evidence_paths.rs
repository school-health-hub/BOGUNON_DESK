use super::evidence_approval::absolute_disk_path;
use std::{
    fs::{File, OpenOptions},
    io::Read,
    os::windows::fs::{MetadataExt, OpenOptionsExt},
    path::Path,
};

pub fn ordinary_attributes(attributes: u32) -> Result<(), ()> {
    if attributes & 0x400 != 0 {
        Err(())
    } else {
        Ok(())
    }
}

pub fn lock_directories(path: &Path) -> Result<Vec<File>, ()> {
    absolute_disk_path(path)?;
    let mut guards = Vec::new();
    let parent = path.parent().ok_or(())?;
    let ancestors: Vec<_> = parent.ancestors().collect();
    for directory in ancestors.into_iter().rev() {
        let file = OpenOptions::new()
            .access_mode(0x80)
            .share_mode(1)
            .custom_flags(0x02000000 | 0x00200000)
            .open(directory)
            .map_err(|_| ())?;
        let metadata = file.metadata().map_err(|_| ())?;
        ordinary_attributes(metadata.file_attributes())?;
        if !metadata.is_dir() {
            return Err(());
        }
        guards.push(file);
    }
    Ok(guards)
}

pub fn read_locked(path: &Path) -> Result<(File, Vec<u8>), ()> {
    absolute_disk_path(path)?;
    let mut file = OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(path)
        .map_err(|_| ())?;
    let metadata = file.metadata().map_err(|_| ())?;
    ordinary_attributes(metadata.file_attributes())?;
    if !metadata.is_file() || metadata.len() > 8192 {
        return Err(());
    }
    let mut bytes = Vec::new();
    (&mut file)
        .take(8193)
        .read_to_end(&mut bytes)
        .map_err(|_| ())?;
    if bytes.len() > 8192 {
        return Err(());
    }
    Ok((file, bytes))
}
