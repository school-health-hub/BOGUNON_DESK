//! Disconnected source adapter. No startup, IPC or production enablement path.
mod assets;
mod identity;
mod model;
mod runtime;
mod settings;
pub use model::{Cleanup, CleanupConfirmed, Error, Observation, Phase};
pub(crate) use runtime::navigation as runtime_navigation;
pub use runtime::{configure, Adapter, Status};
#[cfg(test)]
mod tests;
