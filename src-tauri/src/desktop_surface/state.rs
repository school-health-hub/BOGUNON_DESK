use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DesktopSurfaceState {
    NormalWindow,
    ProbeAvailable,
    ProbeUnavailable,
}

pub(crate) struct DesktopSurfaceCoordinator {
    state: Mutex<DesktopSurfaceState>,
}

impl Default for DesktopSurfaceCoordinator {
    fn default() -> Self {
        Self {
            state: Mutex::new(DesktopSurfaceState::NormalWindow),
        }
    }
}

impl DesktopSurfaceCoordinator {
    #[cfg(test)]
    pub(crate) fn current(&self) -> DesktopSurfaceState {
        *self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    pub(crate) fn record_probe(&self, supported: bool) -> DesktopSurfaceState {
        let next = if supported {
            DesktopSurfaceState::ProbeAvailable
        } else {
            DesktopSurfaceState::ProbeUnavailable
        };
        *self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = next;
        next
    }
}
