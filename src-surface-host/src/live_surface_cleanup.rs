pub(super) trait CleanupOperations {
    fn controller(&mut self) -> bool;
    fn window(&mut self) -> bool;
    fn browser_exit(&mut self) -> bool;
    fn subscription(&mut self) -> bool;
    fn environment(&mut self) -> bool;
}

pub(super) fn release_in_order(operations: &mut impl CleanupOperations) -> bool {
    // Every already-owned resource gets its one explicit release attempt, even when
    // an earlier operation fails. This result is local release evidence, not a receipt.
    let results = [
        operations.controller(),
        operations.window(),
        operations.browser_exit(),
        operations.subscription(),
        operations.environment(),
    ];
    results.into_iter().all(|released| released)
}

use super::{
    close_controller, wait_observation, Attempt, BrowserExitSubscription, DirectoryObservation,
    Ledger, LiveSurfaceError, OwnedWindow, Resource, RuntimeBinding, StaGuard, CREATION_TIMEOUT,
};
use crate::windows_host::{BoundController, BoundEnvironment};

/// No receipt or directory deletion is possible from this rejected-admission path.
pub(super) struct RejectedResources {
    pub controller: BoundController,
    pub window: OwnedWindow,
    pub subscription: BrowserExitSubscription,
    pub environment: BoundEnvironment,
    pub sta: StaGuard,
}

pub(super) fn release_rejected(
    resources: RejectedResources,
    ledger: &mut Ledger,
    attempt: Attempt,
    binding: RuntimeBinding,
    expected_browser: Option<u32>,
) -> bool {
    release_in_order(&mut OwnedReleases {
        controller: Some(resources.controller),
        window: Some(resources.window),
        subscription: Some(resources.subscription),
        environment: Some(resources.environment),
        sta: Some(resources.sta),
        ledger,
        attempt,
        binding,
        expected_browser,
    })
}

struct OwnedReleases<'a> {
    controller: Option<BoundController>,
    window: Option<OwnedWindow>,
    subscription: Option<BrowserExitSubscription>,
    environment: Option<BoundEnvironment>,
    sta: Option<StaGuard>,
    ledger: &'a mut Ledger,
    attempt: Attempt,
    binding: RuntimeBinding,
    expected_browser: Option<u32>,
}

impl CleanupOperations for OwnedReleases<'_> {
    fn controller(&mut self) -> bool {
        let Some(controller) = self.controller.take() else {
            return false;
        };
        let closed = close_controller(&controller.controller).is_ok();
        drop(controller);
        if closed {
            let webview = self.ledger.release(self.attempt, Resource::WebView, 6);
            let controller = self.ledger.release(self.attempt, Resource::Controller, 5);
            webview.is_ok() && controller.is_ok()
        } else {
            let webview = self
                .ledger
                .quarantine_release(self.attempt, Resource::WebView, 6);
            let controller = self
                .ledger
                .quarantine_release(self.attempt, Resource::Controller, 5);
            // Errors keep the same ownership unresolved; neither is release proof.
            let _quarantine_results = (webview, controller);
            false
        }
    }

    fn window(&mut self) -> bool {
        let Some(window) = self.window.take() else {
            return false;
        };
        if window.destroy().is_ok() {
            self.ledger
                .release(self.attempt, Resource::Window, 2)
                .is_ok()
        } else {
            let unresolved = self
                .ledger
                .quarantine_release(self.attempt, Resource::Window, 2);
            let _quarantine_result = unresolved;
            false
        }
    }

    fn browser_exit(&mut self) -> bool {
        let Some(subscription) = self.subscription.as_ref() else {
            return false;
        };
        match wait_observation(CREATION_TIMEOUT, subscription) {
            Ok(exit) => {
                exit.binding == self.binding
                    && exit.normal
                    && Some(exit.browser_process_id) == self.expected_browser
                    && exit.browser_process_id != 0
            }
            Err(_) => false,
        }
    }

    fn subscription(&mut self) -> bool {
        let Some(subscription) = self.subscription.take() else {
            return false;
        };
        if subscription.unsubscribe().is_ok() {
            self.ledger
                .release(self.attempt, Resource::EventToken, 4)
                .is_ok()
        } else {
            let unresolved = self
                .ledger
                .quarantine_release(self.attempt, Resource::EventToken, 4);
            let _quarantine_result = unresolved;
            false
        }
    }

    fn environment(&mut self) -> bool {
        drop(self.environment.take());
        let environment = self.ledger.release(self.attempt, Resource::Environment, 3);
        drop(self.sta.take());
        let host = self.ledger.release(self.attempt, Resource::Host, 1);
        environment.is_ok() && host.is_ok()
    }
}

pub(super) fn verify_removal_root(
    path: &std::path::Path,
    owned: &DirectoryObservation,
) -> Result<(), LiveSurfaceError> {
    use std::{fs, os::windows::fs::MetadataExt};
    const REPARSE_POINT: u32 = 0x400;
    let canonical = path
        .canonicalize()
        .map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
    let temp = std::env::temp_dir()
        .canonicalize()
        .map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
    let current = super::observe_directory(path).map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
    if canonical != owned.path
        || canonical.parent() != Some(temp.as_path())
        || current.identity != owned.identity
    {
        return Err(LiveSurfaceError::TemporaryCleanup);
    }
    let mut pending = vec![path.to_path_buf()];
    while let Some(entry) = pending.pop() {
        let metadata =
            fs::symlink_metadata(&entry).map_err(|_| LiveSurfaceError::TemporaryCleanup)?;
        if metadata.file_attributes() & REPARSE_POINT != 0 {
            return Err(LiveSurfaceError::TemporaryCleanup);
        }
        if metadata.is_dir() {
            for child in fs::read_dir(entry).map_err(|_| LiveSurfaceError::TemporaryCleanup)? {
                pending.push(
                    child
                        .map_err(|_| LiveSurfaceError::TemporaryCleanup)?
                        .path(),
                );
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "live_surface_cleanup_tests.rs"]
mod tests;
