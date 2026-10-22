#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(windows)]
pub mod browser_exit;
pub mod cleanup;
pub mod diagnostic;
pub mod ipc;
pub mod lifecycle;
#[cfg(windows)]
pub mod native_window;
pub mod ownership;
pub mod renderer;
pub mod runtime_evidence;
pub mod runtime_guard;
#[cfg(windows)]
pub mod runtime_identity;
#[cfg(windows)]
pub mod runtime_qa;
pub mod udf;

#[cfg(windows)]
pub mod windows_host;

pub const RUNTIME_VERIFICATION: &str = "NOT_VERIFIED";
