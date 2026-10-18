//! Registered-Main publisher API; deliberately no IPC command or data producer.
//! Caller checks use actual Tauri resources. A published value is not delivery ACK.
use super::{state, MainLifetime};
use crate::main_caller::{self, CommandError};
use tauri::{AppHandle, Manager, Runtime, Webview};

/// Cannot be constructed from JS, labels or generation numbers.
/// ```compile_fail
/// use school_health_desk_lib::main_projection::PublisherLease;
/// let forged = PublisherLease::from_label("main");
/// ```
pub struct PublisherLease(state::PublisherLease);
/// Reserved for a future trusted source with auth/permission revocation wiring.
/// No issuer or variants exist: this stage cannot enable operational publication.
/// ```compile_fail
/// use school_health_desk_lib::main_projection::ProducerConnection;
/// let connection = ProducerConnection {};
/// ```
pub enum ProducerConnection {}
/// Immutable allowlist. This is a value, not Native or cleanup evidence.
/// ```compile_fail
/// use school_health_desk_lib::main_projection::Projection;
/// let bad = Projection { revision: 1, title: "private" };
/// ```
/// ```compile_fail
/// use school_health_desk_lib::{main_projection, surface_broker};
/// fn promote(value: surface_broker::Projection) -> main_projection::Projection { value }
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Projection {
    revision: u64,
}
impl From<state::ApprovedProjection> for Projection {
    fn from(value: state::ApprovedProjection) -> Self {
        Self {
            revision: value.revision(),
        }
    }
}
impl Projection {
    pub const fn revision(self) -> u64 {
        self.revision
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    CallerDenied,
    Unavailable,
    StalePublisher,
    StaleRevision,
    PublisherClosed,
}
impl From<state::ProjectionError> for Error {
    fn from(error: state::ProjectionError) -> Self {
        match error {
            state::ProjectionError::Unavailable => Self::Unavailable,
            state::ProjectionError::StalePublisher => Self::StalePublisher,
            state::ProjectionError::StaleRevision => Self::StaleRevision,
            state::ProjectionError::PublisherClosed => Self::PublisherClosed,
        }
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Main projection admission failed")
    }
}
impl std::error::Error for Error {}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Revocation {
    Logout,
    PermissionChanged,
}

fn with_main<R: Runtime, T>(
    app: &AppHandle<R>,
    action: impl FnOnce(&mut state::Lifetime) -> Result<T, Error>,
) -> Result<T, Error> {
    let registry = app.try_state::<MainLifetime>().ok_or(Error::Unavailable)?;
    let mut state = registry.state.lock().map_err(|_| Error::Unavailable)?;
    if !registry.valid(app) {
        return Err(Error::Unavailable);
    }
    action(state.as_mut().ok_or(Error::Unavailable)?)
}
fn guarded<R: Runtime, T>(
    caller: &Webview<R>,
    action: impl FnOnce() -> Result<T, Error>,
) -> Result<T, Error> {
    main_caller::run(caller, action).map_err(|error| match error {
        CommandError::Caller { .. } => Error::CallerDenied,
        CommandError::Existing(error) => error,
    })
}
/// Capture before beginning producer work. Reusable only within its epoch/generation.
pub fn capture<R: Runtime>(
    caller: &Webview<R>,
    _connection: &ProducerConnection,
) -> Result<PublisherLease, Error> {
    guarded(caller, || {
        with_main(caller.app_handle(), |state| {
            state
                .publisher_lease()
                .map(PublisherLease)
                .map_err(Error::from)
        })
    })
}
/// Reject invalid authority/revision without replacing the last valid publication.
pub fn publish<R: Runtime>(
    caller: &Webview<R>,
    lease: &PublisherLease,
    revision: u64,
) -> Result<Projection, Error> {
    guarded(caller, || {
        with_main(caller.app_handle(), |state| {
            state
                .publish_projection(&lease.0, revision)
                .map(Projection::from)
                .map_err(Error::from)
        })
    })
}
/// Future Main auth/permission notifications must call this before refreshing trust.
/// No existing login/logout implementation or operational producer is connected here.
pub fn revoke<R: Runtime>(caller: &Webview<R>, reason: Revocation) -> Result<(), Error> {
    guarded(caller, || {
        with_main(caller.app_handle(), |state| {
            state.revoke_projection(match reason {
                Revocation::Logout => state::ProjectionRevocation::Logout,
                Revocation::PermissionChanged => state::ProjectionRevocation::PermissionChanged,
            });
            Ok(())
        })
    })
}
/// Read-only cache for a future authenticated Surface adapter; never queries Main data.
/// Missing/retired Main or missing publication returns Unavailable; never default zero.
pub fn read<R: Runtime>(app: &AppHandle<R>) -> Result<Projection, Error> {
    with_main(app, |state| {
        state
            .projection()
            .map(Projection::from)
            .map_err(Error::from)
    })
}

#[cfg(test)]
#[path = "main_projection_caller_tests.rs"]
mod tests;
