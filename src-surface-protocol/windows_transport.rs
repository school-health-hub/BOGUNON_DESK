use crate::main_restore::{
    Admission, Capability, ProtocolError, RestoreBinding, RestoreResponse, MAX_REQUEST_BYTES,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::ffi::{c_void, OsStr};
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
use thiserror::Error;
use uuid::Uuid;
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, LocalFree, HANDLE, HLOCAL};
use windows::Win32::Security::Authorization::{
    ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows::Win32::Security::{
    GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
    TOKEN_USER,
};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, ReadFile, WriteFile, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_GENERIC_READ,
    FILE_GENERIC_WRITE, FILE_SHARE_NONE, OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
};
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, GetNamedPipeClientProcessId,
    WaitNamedPipeW, PIPE_READMODE_MESSAGE, PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_MESSAGE,
    PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

const TIMEOUT_MS: u32 = 3_000;
pub const MAX_GRANT_BYTES: usize = 1_024;

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum TransportError {
    #[error("Main restore endpoint is unavailable")]
    Unavailable,
    #[error("Main restore request was rejected")]
    Rejected,
    #[error("Main restore response is invalid")]
    InvalidResponse,
    #[error("Main restore sequence is exhausted")]
    SequenceExhausted,
    #[error("Main restore grant is invalid")]
    InvalidGrant,
}

struct OwnedHandle(HANDLE);
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        // SAFETY: this wrapper exclusively owns a valid Win32 handle and closes it once.
        let _ = unsafe { CloseHandle(self.0) };
    }
}
struct LocalAllocation(HLOCAL);
impl Drop for LocalAllocation {
    fn drop(&mut self) {
        // SAFETY: the allocation came from a Win32 API documented for LocalFree.
        let _ = unsafe { LocalFree(Some(self.0)) };
    }
}

pub struct SurfaceRestoreGrant {
    endpoint: String,
    binding: RestoreBinding,
}
impl std::fmt::Debug for SurfaceRestoreGrant {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SurfaceRestoreGrant([REDACTED])")
    }
}
impl SurfaceRestoreGrant {
    pub fn edit_binding(&self) -> crate::edit_control::EditBinding {
        self.binding.edit_binding()
    }

    pub fn into_parts(self) -> (String, RestoreBinding) {
        (self.endpoint, self.binding)
    }

    pub fn to_memory_bytes(&self) -> Result<Vec<u8>, TransportError> {
        serde_json::to_vec(&GrantWire {
            endpoint: &self.endpoint,
            binding: &self.binding,
        })
        .map_err(|_| TransportError::InvalidGrant)
    }

    pub fn from_memory_bytes(payload: &[u8]) -> Result<Self, TransportError> {
        if payload.len() > MAX_GRANT_BYTES {
            return Err(TransportError::InvalidGrant);
        }
        let wire: OwnedGrantWire =
            serde_json::from_slice(payload).map_err(|_| TransportError::InvalidGrant)?;
        if wire.endpoint.is_empty() || !wire.endpoint.starts_with(r"\\.\pipe\bogunon-main-restore-")
        {
            return Err(TransportError::InvalidGrant);
        }
        Ok(Self {
            endpoint: wire.endpoint,
            binding: wire.binding,
        })
    }
}

#[derive(Serialize)]
struct GrantWire<'a> {
    endpoint: &'a str,
    binding: &'a RestoreBinding,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OwnedGrantWire {
    endpoint: String,
    binding: RestoreBinding,
}

pub struct PipeClient {
    endpoint: Vec<u16>,
    binding: RestoreBinding,
    next_sequence: u64,
}
impl std::fmt::Debug for PipeClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("PipeClient([REDACTED])")
    }
}
impl PipeClient {
    pub fn new(endpoint: &OsStr, binding: RestoreBinding) -> Result<Self, TransportError> {
        let mut endpoint = endpoint.encode_wide().collect::<Vec<_>>();
        if endpoint.is_empty() || endpoint.contains(&0) {
            return Err(TransportError::Unavailable);
        }
        endpoint.push(0);
        Ok(Self {
            endpoint,
            binding,
            next_sequence: 1,
        })
    }
    pub fn open_main(&mut self) -> Result<(), TransportError> {
        let sequence = self.next_sequence;
        let next = sequence
            .checked_add(1)
            .filter(|value| *value != u64::MAX)
            .ok_or(TransportError::SequenceExhausted)?;
        let payload = self
            .binding
            .request(sequence)
            .map_err(|_| TransportError::Rejected)?;
        // SAFETY: endpoint is a live NUL-terminated UTF-16 buffer.
        unsafe { WaitNamedPipeW(PCWSTR(self.endpoint.as_ptr()), TIMEOUT_MS) }
            .ok()
            .map_err(|_| TransportError::Unavailable)?;
        // SAFETY: pointer-backed arguments remain live for this synchronous call.
        let handle = unsafe {
            CreateFileW(
                PCWSTR(self.endpoint.as_ptr()),
                FILE_GENERIC_READ.0 | FILE_GENERIC_WRITE.0,
                FILE_SHARE_NONE,
                None,
                OPEN_EXISTING,
                Default::default(),
                None,
            )
        }
        .map(OwnedHandle)
        .map_err(|_| TransportError::Unavailable)?;
        let mut written = 0;
        // SAFETY: payload and handle remain valid during synchronous I/O.
        unsafe { WriteFile(handle.0, Some(&payload), Some(&mut written), None) }
            .map_err(|_| TransportError::Unavailable)?;
        if written as usize != payload.len() {
            return Err(TransportError::Unavailable);
        }
        let mut response = vec![0_u8; MAX_REQUEST_BYTES];
        let mut read = 0;
        // SAFETY: response is writable and handle remains valid during synchronous I/O.
        unsafe { ReadFile(handle.0, Some(&mut response), Some(&mut read), None) }
            .map_err(|_| TransportError::Unavailable)?;
        response.truncate(read as usize);
        let response: RestoreResponse =
            serde_json::from_slice(&response).map_err(|_| TransportError::InvalidResponse)?;
        if !response.accepted {
            return Err(TransportError::Rejected);
        }
        self.next_sequence = next;
        Ok(())
    }
}

pub struct PipeServer {
    pipe: OwnedHandle,
    admission: Admission,
}
impl PipeServer {
    pub fn create(
        generation: u64,
        attempt: u64,
        surface_pid: u32,
    ) -> Result<(Self, SurfaceRestoreGrant), TransportError> {
        let mut bytes = [0_u8; 32];
        rand::rng().fill_bytes(&mut bytes);
        let binding = RestoreBinding::new(
            generation,
            attempt,
            surface_pid,
            Capability::from_bytes(bytes),
        )
        .ok_or(TransportError::Unavailable)?;
        let endpoint = format!(r"\\.\pipe\bogunon-main-restore-{}", Uuid::new_v4());
        let descriptor_wide = wide(&format!("D:P(A;;GA;;;{})", current_user_sid()?));
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: descriptor_wide is live and NUL-terminated; output is initialized.
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                PCWSTR(descriptor_wide.as_ptr()),
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )
        }
        .map_err(|_| TransportError::Unavailable)?;
        let allocation = LocalAllocation(HLOCAL(descriptor.0));
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: false.into(),
        };
        let endpoint_wide = wide(&endpoint);
        // SAFETY: endpoint and SID-only descriptor remain live for creation.
        let handle = unsafe {
            CreateNamedPipeW(
                PCWSTR(endpoint_wide.as_ptr()),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES,
                MAX_REQUEST_BYTES as u32,
                MAX_REQUEST_BYTES as u32,
                TIMEOUT_MS,
                Some(&attributes),
            )
        };
        drop(allocation);
        if handle.is_invalid() {
            return Err(TransportError::Unavailable);
        }
        Ok((
            Self {
                pipe: OwnedHandle(handle),
                admission: Admission::new(binding.clone()),
            },
            SurfaceRestoreGrant { endpoint, binding },
        ))
    }
    pub fn serve_once<F>(&mut self, open_main: F) -> Result<(), TransportError>
    where
        F: FnOnce() -> Result<(), ()>,
    {
        // SAFETY: pipe is an owned server handle; no OVERLAPPED pointer is used.
        unsafe { ConnectNamedPipe(self.pipe.0, None) }.map_err(|_| TransportError::Unavailable)?;
        let result = self.handle_connected(open_main);
        // SAFETY: pipe remains owned and valid through disconnect.
        let disconnected =
            unsafe { DisconnectNamedPipe(self.pipe.0) }.map_err(|_| TransportError::Unavailable);
        result.and(disconnected)
    }
    fn handle_connected<F>(&mut self, open_main: F) -> Result<(), TransportError>
    where
        F: FnOnce() -> Result<(), ()>,
    {
        let mut os_pid = 0;
        // SAFETY: pipe is connected and output pointer is valid.
        unsafe { GetNamedPipeClientProcessId(self.pipe.0, &mut os_pid) }
            .map_err(|_| TransportError::Unavailable)?;
        let mut payload = vec![0_u8; MAX_REQUEST_BYTES + 1];
        let mut read = 0;
        // SAFETY: payload is writable and pipe is connected.
        unsafe { ReadFile(self.pipe.0, Some(&mut payload), Some(&mut read), None) }
            .map_err(|_| TransportError::Unavailable)?;
        payload.truncate(read as usize);
        let response = match self.admission.admit(&payload, os_pid) {
            Ok(()) if open_main().is_ok() => RestoreResponse::accepted(),
            Ok(()) => RestoreResponse::rejected(ProtocolError::MainUnavailable),
            Err(error) => RestoreResponse::rejected(error),
        };
        let response =
            serde_json::to_vec(&response).map_err(|_| TransportError::InvalidResponse)?;
        let mut written = 0;
        // SAFETY: response is live and pipe is connected.
        unsafe { WriteFile(self.pipe.0, Some(&response), Some(&mut written), None) }
            .map_err(|_| TransportError::Unavailable)?;
        if written as usize != response.len() {
            return Err(TransportError::Unavailable);
        }
        Ok(())
    }
    pub const fn retire_main(&mut self) {
        self.admission.retire_main();
    }
    pub const fn retire_surface(&mut self) {
        self.admission.retire_surface();
    }
}

fn current_user_sid() -> Result<String, TransportError> {
    let mut token = HANDLE::default();
    // SAFETY: process pseudo-handle is valid and token is an output pointer.
    unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) }
        .map_err(|_| TransportError::Unavailable)?;
    let token = OwnedHandle(token);
    let mut required = 0;
    // SAFETY: null buffer with zero length is the documented size query.
    let _ = unsafe { GetTokenInformation(token.0, TokenUser, None, 0, &mut required) };
    if required < size_of::<TOKEN_USER>() as u32 {
        return Err(TransportError::Unavailable);
    }
    let mut buffer = vec![0_usize; (required as usize).div_ceil(size_of::<usize>())];
    // SAFETY: usize storage is aligned and at least the queried byte size.
    unsafe {
        GetTokenInformation(
            token.0,
            TokenUser,
            Some(buffer.as_mut_ptr().cast::<c_void>()),
            required,
            &mut required,
        )
    }
    .map_err(|_| TransportError::Unavailable)?;
    // SAFETY: the API initialized the aligned buffer as TOKEN_USER and it remains live.
    let token_user = unsafe { &*(buffer.as_ptr().cast::<TOKEN_USER>()) };
    let mut sid_text = PWSTR::null();
    // SAFETY: SID is owned by the live buffer and output pointer is valid.
    unsafe { ConvertSidToStringSidW(token_user.User.Sid, &mut sid_text) }
        .map_err(|_| TransportError::Unavailable)?;
    let allocation = LocalAllocation(HLOCAL(sid_text.0.cast::<c_void>()));
    // SAFETY: output is NUL-terminated and live until LocalFree.
    let sid = unsafe { sid_text.to_string() }.map_err(|_| TransportError::Unavailable)?;
    drop(allocation);
    Ok(sid)
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::{SurfaceRestoreGrant, TransportError};
    use crate::main_restore::{Capability, RestoreBinding};

    #[test]
    fn sid_dacl_has_no_world_or_anonymous_ace() {
        let value = format!("D:P(A;;GA;;;{})", "S-1-5-21-1-2-3-1001");
        assert!(!value.contains("WD"));
        assert!(!value.contains("AN"));
    }

    #[test]
    fn grant_memory_transfer_accepts_only_the_fixed_pipe_namespace() {
        let binding = RestoreBinding::new(7, 11, 101, Capability::from_bytes([0x5a; 32]))
            .unwrap_or_else(|| panic!("valid binding"));
        let grant = SurfaceRestoreGrant {
            endpoint: r"\\.\pipe\bogunon-main-restore-test".to_owned(),
            binding,
        };
        let bytes = grant
            .to_memory_bytes()
            .unwrap_or_else(|error| panic!("grant must encode: {error}"));
        let decoded = SurfaceRestoreGrant::from_memory_bytes(&bytes)
            .unwrap_or_else(|error| panic!("grant must decode: {error}"));
        assert!(decoded
            .endpoint
            .starts_with(r"\\.\pipe\bogunon-main-restore-"));

        let wrong = bytes
            .windows(b"bogunon-main-restore".len())
            .position(|part| part == b"bogunon-main-restore")
            .map(|offset| {
                let mut changed = bytes.clone();
                changed[offset] = b'x';
                changed
            })
            .unwrap_or_default();
        assert_eq!(
            SurfaceRestoreGrant::from_memory_bytes(&wrong).err(),
            Some(TransportError::InvalidGrant)
        );
    }
}
