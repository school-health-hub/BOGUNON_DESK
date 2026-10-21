/// Immutable C-2B authority declaration for the future Surface process.
#[derive(Clone, Copy)]
pub(crate) struct SurfaceBoundaryPolicy;

impl SurfaceBoundaryPolicy {
    /// No existing Tauri plugin, core or application permission is granted.
    pub(crate) const fn granted_permissions(self) -> &'static [&'static str] {
        &[]
    }

    pub(crate) const fn shares_main_commands(self) -> bool {
        false
    }

    pub(crate) const fn shares_main_channel(self) -> bool {
        false
    }

    /// Native host creation is explicitly outside C-2B.
    pub(crate) const fn creates_native_host(self) -> bool {
        false
    }
}
