//! Tauri registry observations only. No OS/WebView2 cleanup proof issuer.
use super::Adapter;
use crate::surface_adapter::{settings::LABEL, Cleanup, Error, Observation};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, Runtime};

/// A builder error exposes no trustworthy resource handle for label-based cleanup.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConstructionOwnership {
    NotAttempted,
    AttemptedUnresolved,
    ReturnedPinned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourcePresence {
    OwnedPresent,
    Unobserved,
    Missing,
    DifferentIdentity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CleanupObservation {
    pub window: ResourcePresence,
    pub webview: ResourcePresence,
    /// Arc identity pins remain in the adapter's one-shot registration tombstone.
    pub backend_registration_retained: bool,
    /// Not observed through the public registry lookup APIs.
    pub webview2_release: Cleanup,
}
impl CleanupObservation {
    pub(super) const fn new(window: ResourcePresence, webview: ResourcePresence) -> Self {
        Self {
            window,
            webview,
            backend_registration_retained: true,
            webview2_release: Cleanup::Unknown,
        }
    }
    pub(super) fn both_owned_present(&self) -> bool {
        self.window == ResourcePresence::OwnedPresent
            && self.webview == ResourcePresence::OwnedPresent
    }
}

pub(super) fn presence(identity: Option<bool>) -> ResourcePresence {
    match identity {
        None => ResourcePresence::Missing,
        Some(true) => ResourcePresence::OwnedPresent,
        Some(false) => ResourcePresence::DifferentIdentity,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_window_does_not_imply_webview_missing_or_cleanup() {
        let observed = CleanupObservation::new(presence(None), presence(Some(true)));
        assert_eq!(observed.window, ResourcePresence::Missing);
        assert_eq!(observed.webview, ResourcePresence::OwnedPresent);
        assert!(!observed.both_owned_present());
        assert_eq!(observed.webview2_release, Cleanup::Unknown);
    }
    #[test]
    fn composite_lookup_absence_cannot_prove_individual_absence() {
        let observed =
            CleanupObservation::new(ResourcePresence::Unobserved, ResourcePresence::Unobserved);
        assert!(!observed.both_owned_present());
        assert_ne!(observed.window, ResourcePresence::Missing);
        assert_ne!(observed.webview, ResourcePresence::Missing);
        assert_eq!(observed.webview2_release, Cleanup::Unknown);
    }
    #[test]
    fn both_missing_never_release_registration_or_issue_cleanup() {
        let observed = CleanupObservation::new(presence(None), presence(None));
        assert!(observed.backend_registration_retained);
        assert_eq!(observed.webview2_release, Cleanup::Unknown);
        assert!(!observed.both_owned_present());
    }
    #[test]
    fn reused_label_is_identity_mismatch_not_owned_cleanup_target() {
        let observed = CleanupObservation::new(presence(Some(false)), presence(Some(false)));
        assert_eq!(observed.window, ResourcePresence::DifferentIdentity);
        assert!(!observed.both_owned_present());
    }
}

impl Adapter {
    pub fn construction_ownership(&self) -> ConstructionOwnership {
        if self.0.owned.get().is_some() {
            ConstructionOwnership::ReturnedPinned
        } else if self.0.construction_attempted.load(Ordering::SeqCst) {
            ConstructionOwnership::AttemptedUnresolved
        } else {
            ConstructionOwnership::NotAttempted
        }
    }
    /// Stable combined lookup cannot prove separate registry absence or OS teardown.
    pub fn observe_cleanup<R: Runtime>(
        &self,
        app: &AppHandle<R>,
    ) -> Result<CleanupObservation, Error> {
        let owned = self.0.owned.get().ok_or(Error::Unknown)?;
        // Individual manager registry lookups require Tauri's unstable feature.
        // The stable composite lookup cannot prove either individual registry absent.
        let observation = match app.get_webview_window(LABEL) {
            Some(window) => {
                let view: &tauri::Webview<R> = window.as_ref();
                CleanupObservation::new(
                    presence(Some(owned.owns_window(&view.window()))),
                    presence(Some(owned.owns_view(view))),
                )
            }
            None => {
                CleanupObservation::new(ResourcePresence::Unobserved, ResourcePresence::Unobserved)
            }
        };
        if !observation.both_owned_present() {
            self.record(&owned.request, Observation::ResourceMissing);
        }
        Ok(observation)
    }
    pub fn observe_missing<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), Error> {
        if self.observe_cleanup(app)?.both_owned_present() {
            Ok(())
        } else {
            Err(Error::Unknown)
        }
    }
}

#[cfg(test)]
mod construction_tests {
    use super::*;
    #[test]
    fn disabled_preflight_has_no_attempted_resource() {
        let adapter = Adapter::default();
        assert_eq!(
            adapter.construction_ownership(),
            ConstructionOwnership::NotAttempted
        );
    }
    #[test]
    fn unreturned_partial_build_is_unresolved_not_resource_absence() {
        let adapter = Adapter::default();
        adapter
            .0
            .construction_attempted
            .store(true, Ordering::SeqCst);
        assert_eq!(
            adapter.construction_ownership(),
            ConstructionOwnership::AttemptedUnresolved
        );
        assert!(adapter.0.owned.get().is_none());
        assert!(!adapter.status().expect("status").replacement_allowed);
    }
}
