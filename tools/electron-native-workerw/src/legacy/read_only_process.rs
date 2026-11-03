use super::{observation::*, observation_reader::Lease};
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{CloseHandle, FILETIME, HANDLE},
        Globalization::{CompareStringOrdinal, CSTR_EQUAL},
        System::{
            RemoteDesktop::ProcessIdToSessionId,
            SystemInformation::GetSystemWindowsDirectoryW,
            Threading::{
                GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
    },
};

pub(super) fn api<T>(value: windows::core::Result<T>, name: &'static str) -> Result<T, QueryError> {
    value.map_err(|e| QueryError::Hresult(name, e.code().0))
}
pub(super) fn normalize_path(value: &[u16]) -> Result<Vec<u16>, QueryError> {
    let text = String::from_utf16(value).map_err(|_| QueryError::InvalidValue("image utf16"))?;
    let normalized = text.replace('/', "\\");
    let normalized = normalized.strip_prefix("\\\\?\\").unwrap_or(&normalized);
    let bytes = normalized.as_bytes();
    if bytes.len() < 3
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || bytes[2] != b'\\'
        || normalized.contains('\0')
        || normalized
            .split('\\')
            .any(|part| part == "." || part == "..")
    {
        return Err(QueryError::InvalidValue("image path"));
    }
    Ok(normalized.encode_utf16().collect())
}
pub(super) fn expected_explorer() -> Result<Vec<u16>, QueryError> {
    let mut buffer = vec![0u16; 32768];
    // SAFETY: FFI category 8/10: initialized writable slice, bounded by its supplied length.
    let count = unsafe { GetSystemWindowsDirectoryW(Some(&mut buffer)) } as usize;
    if count == 0 || count >= buffer.len() {
        return Err(QueryError::InvalidValue("Windows directory"));
    }
    buffer.truncate(count);
    buffer.extend("\\explorer.exe".encode_utf16());
    normalize_path(&buffer)
}
fn close_process(handle: HANDLE) {
    // SAFETY: FFI category 8/12: Lease uniquely owns the successful OpenProcess handle.
    let _ = unsafe { CloseHandle(handle) };
}
pub(super) fn process(pid: u32, expected: &[u16]) -> Result<ProcessIdentity, QueryError> {
    // SAFETY: FFI category 8: query-only rights, no inherited handle or privilege changes.
    let handle = api(
        unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) },
        "OpenProcess",
    )?;
    let lease = Lease::new(handle, close_process as fn(HANDLE));
    let handle = *lease
        .get()
        .ok_or(QueryError::InvalidValue("process lease"))?;
    let (mut created, mut exit, mut kernel, mut user) = (
        FILETIME::default(),
        FILETIME::default(),
        FILETIME::default(),
        FILETIME::default(),
    );
    // SAFETY: FFI category 4/8: live owned handle and initialized, distinct output structures.
    api(
        unsafe { GetProcessTimes(handle, &mut created, &mut exit, &mut kernel, &mut user) },
        "GetProcessTimes",
    )?;
    let mut image = vec![0u16; 32768];
    let mut length =
        u32::try_from(image.len()).map_err(|_| QueryError::InvalidValue("image length"))?;
    // SAFETY: FFI category 8/10: buffer length matches allocated, initialized UTF-16 storage.
    api(
        unsafe {
            QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(image.as_mut_ptr()),
                &mut length,
            )
        },
        "QueryFullProcessImageNameW",
    )?;
    let length = usize::try_from(length).map_err(|_| QueryError::InvalidValue("image length"))?;
    if length == 0 || length >= image.len() {
        return Err(QueryError::InvalidValue("image length"));
    }
    let mut image = normalize_path(&image[..length])?;
    // SAFETY: FFI category 8/10: both UTF-16 slices are bounded well below i32::MAX.
    let comparison = unsafe { CompareStringOrdinal(&image, expected, true) };
    if comparison.0 == 0 {
        return Err(QueryError::InvalidValue("image comparison"));
    }
    if comparison == CSTR_EQUAL {
        image = expected.to_vec();
    }
    let mut session = 0;
    // SAFETY: FFI category 8: initialized writable session ID; PID is query-only.
    api(
        unsafe { ProcessIdToSessionId(pid, &mut session) },
        "ProcessIdToSessionId",
    )?;
    Ok(ProcessIdentity {
        pid,
        created: (u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime),
        session,
        image,
    })
}
