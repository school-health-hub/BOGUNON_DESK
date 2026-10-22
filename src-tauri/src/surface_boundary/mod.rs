//! Static contract for the future out-of-process Dashboard Surface.
//! This module grants no Tauri authority and creates no native resources.

mod cleanup;
mod identity;
mod ownership;
mod policy;
mod udf;

pub(crate) use cleanup::{
    evaluate_cleanup, BrowserExitEvidence, CleanupDecision, CleanupUnknownReason,
};
pub(crate) use identity::{AttemptBinding, DirectoryIdentity, IdentityToken};
pub(crate) use ownership::{Ledger, LedgerError, LedgerState, ResourceKind};
pub(crate) use policy::SurfaceBoundaryPolicy;
pub(crate) use udf::{
    preflight_udf, EffectiveDirectory, EffectiveUdfObservation, EnvironmentObservation,
    ObservedDirectory, OverrideObservation, PathKey, ProfileObservation, UdfError, UdfStatus,
    VerifiedIsolation,
};

#[cfg(test)]
mod tests {
    use super::SurfaceBoundaryPolicy;

    #[test]
    fn boundary_exposes_no_main_or_tauri_authority() {
        // Given the C-2B Surface boundary contract.
        let policy = SurfaceBoundaryPolicy;

        // When its authority is inspected.
        let grants = policy.granted_permissions();

        // Then Main commands, Main Channel, plugins and core APIs remain unavailable.
        assert!(grants.is_empty());
        assert!(!policy.shares_main_commands());
        assert!(!policy.shares_main_channel());
        assert!(!policy.creates_native_host());
    }
}

#[cfg(test)]
#[path = "udf_tests.rs"]
mod udf_tests;

#[cfg(test)]
#[path = "ownership_tests.rs"]
mod ownership_tests;

#[cfg(test)]
#[path = "cleanup_tests.rs"]
mod cleanup_tests;
