use std::{os::windows::ffi::OsStrExt, path::Path};

use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::CloseHandle,
        Storage::FileSystem::{
            CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
            FILE_FLAG_BACKUP_SEMANTICS, FILE_GENERIC_READ, FILE_SHARE_DELETE, FILE_SHARE_READ,
            FILE_SHARE_WRITE, OPEN_EXISTING,
        },
    },
};

use crate::{runtime_qa::RuntimeQaError, udf::DirectoryIdentity, windows_host::HostError};

pub fn directory_identity(path: &Path) -> Result<DirectoryIdentity, RuntimeQaError> {
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    // SAFETY: wide is NUL-terminated, and the returned handle is checked and closed below.
    let handle = unsafe {
        CreateFileW(
            PCWSTR(wide.as_ptr()),
            FILE_GENERIC_READ.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            None,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            None,
        )
    }
    .map_err(HostError::Com)?;
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: handle is owned and valid; info is writable initialized storage.
    let result = unsafe { GetFileInformationByHandle(handle, &mut info) };
    // SAFETY: handle was returned by CreateFileW and is closed exactly once.
    let _ = unsafe { CloseHandle(handle) };
    result.map_err(HostError::Com)?;
    let file = ((info.nFileIndexHigh as u128) << 32) | info.nFileIndexLow as u128;
    Ok(DirectoryIdentity {
        volume: info.dwVolumeSerialNumber as u64,
        file,
    })
}
