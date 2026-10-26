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
#[cfg(test)]
mod ownership_tests;
pub mod renderer;
pub mod renderer_session;
#[cfg(test)]
mod renderer_session_test_support;
#[cfg(test)]
mod renderer_session_tests;
pub mod runtime_evidence;
pub mod runtime_guard;
#[cfg(windows)]
pub mod runtime_identity;
#[cfg(windows)]
pub mod runtime_qa;
pub mod surface_connection;
pub mod udf;

#[cfg(windows)]
pub mod windows_host;

pub const RUNTIME_VERIFICATION: &str = "NOT_VERIFIED";

pub mod runtime_budget;
pub mod runtime_outcome;
