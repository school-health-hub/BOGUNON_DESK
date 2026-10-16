use crate::{observation::QueryError, window_lifecycle::WindowError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowResult {
    Pass,
    Fail,
    Blocked,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Capability {
    Supported,
    Unsupported,
    Fail,
    NotObserved,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Report {
    pub window: WindowResult,
    pub capability: Capability,
}
impl Report {
    pub const fn not_run() -> Self {
        Self {
            window: WindowResult::Blocked,
            capability: Capability::NotObserved,
        }
    }
    pub fn finish(
        window: Result<(), WindowError>,
        capability: Result<(), QueryError>,
        cleanup: Result<(), WindowError>,
    ) -> Self {
        let capability = match capability {
            Ok(()) => Capability::Supported,
            Err(QueryError::NoEligibleWorker) => Capability::Unsupported,
            Err(
                QueryError::Api(..)
                | QueryError::Hresult(..)
                | QueryError::InvalidValue(..)
                | QueryError::IdentityChanged
                | QueryError::ShellIdentity
                | QueryError::TopologyChanged
                | QueryError::AmbiguousWorker
                | QueryError::DpiMismatch,
            ) => Capability::Fail,
        };
        Self {
            window: if window.is_ok() && cleanup.is_ok() {
                WindowResult::Pass
            } else {
                WindowResult::Fail
            },
            capability,
        }
    }
    pub const fn line(self) -> &'static str {
        match (self.window, self.capability) {
            (WindowResult::Pass, Capability::Supported) => "WINDOW=PASS CAPABILITY=SUPPORTED",
            (WindowResult::Pass, Capability::Unsupported) => "WINDOW=PASS CAPABILITY=UNSUPPORTED",
            (WindowResult::Pass, Capability::Fail) => "WINDOW=PASS CAPABILITY=FAIL",
            (WindowResult::Pass, Capability::NotObserved) => "WINDOW=PASS CAPABILITY=NOT_OBSERVED",
            (WindowResult::Fail, Capability::Supported) => "WINDOW=FAIL CAPABILITY=SUPPORTED",
            (WindowResult::Fail, Capability::Unsupported) => "WINDOW=FAIL CAPABILITY=UNSUPPORTED",
            (WindowResult::Fail, Capability::Fail) => "WINDOW=FAIL CAPABILITY=FAIL",
            (WindowResult::Fail, Capability::NotObserved) => "WINDOW=FAIL CAPABILITY=NOT_OBSERVED",
            (WindowResult::Blocked, Capability::Supported) => "WINDOW=BLOCKED CAPABILITY=SUPPORTED",
            (WindowResult::Blocked, Capability::Unsupported) => {
                "WINDOW=BLOCKED CAPABILITY=UNSUPPORTED"
            }
            (WindowResult::Blocked, Capability::Fail) => "WINDOW=BLOCKED CAPABILITY=FAIL",
            (WindowResult::Blocked, Capability::NotObserved) => {
                "WINDOW=BLOCKED CAPABILITY=NOT_OBSERVED"
            }
        }
    }
}
