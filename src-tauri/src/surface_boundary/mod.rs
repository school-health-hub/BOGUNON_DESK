//! Static contract for the future out-of-process Dashboard Surface.
//! This module grants no Tauri authority and creates no native resources.

mod policy;

pub(crate) use policy::SurfaceBoundaryPolicy;

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
