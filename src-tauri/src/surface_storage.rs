//! Future Windows storage requirements, NOT a WebView builder or execution permit.
//! No paths are resolved/created and Main's storage configuration is never mutated.

/// A draft cannot certify effective WebView2 UDF/profile identity or filesystem aliases.
#[derive(Debug, Clone, Copy)]
pub struct StorageContract;
impl StorageContract {
    /// Explicit sibling of Main's default LocalData/identifier, never its child.
    pub const fn directory_leaf(self) -> &'static str {
        "kr.sungandi.schoolhealthdesk.surface-v1"
    }
    pub const fn protocol(self) -> &'static str {
        "bogunon-surface"
    }
    pub const fn windows_origin(self) -> &'static str {
        "https://bogunon-surface.localhost"
    }
    pub const fn https_scheme(self) -> bool {
        true
    }
    /// InPrivate is not an isolation proof and has a legacy Wry fallback.
    pub const fn relies_on_incognito(self) -> bool {
        false
    }
    pub const fn csp(self) -> &'static str {
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ipc: http://ipc.localhost https://ipc.localhost; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'"
    }
    /// No Surface adapter, runtime verification or execution approval exists here.
    pub const fn creation_enabled(self) -> bool {
        false
    }
    pub const fn development_surface_enabled(self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn main_storage_configuration_is_preserved_and_surface_disabled() {
        // Given the actual configured Main, not operational browser files.
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let windows = config["app"]["windows"].as_array().unwrap();
        // When the future contract is inspected.
        let contract = StorageContract;
        // Then it cannot create a Surface or change Main's default UDF/origin.
        assert_eq!(windows.len(), 1);
        assert!(windows[0].get("dataDirectory").is_none());
        assert!(windows[0].get("incognito").is_none());
        assert!(windows[0].get("useHttpsScheme").is_none());
        assert_ne!(
            contract.directory_leaf(),
            config["identifier"].as_str().unwrap()
        );
        assert!(!contract.creation_enabled());
        assert!(!contract.development_surface_enabled());
    }
    #[test]
    fn separate_origin_and_strict_surface_csp_exclude_main_assets_and_network() {
        // Given an immutable future custom-protocol origin.
        let contract = StorageContract;
        let origin = tauri::Url::parse(contract.windows_origin()).unwrap();
        // When compared with both Main production and development origins.
        for main in ["http://tauri.localhost", "http://localhost:1420"] {
            // Then origin storage is distinct; CSP never grants business network access.
            assert_ne!(origin.origin(), tauri::Url::parse(main).unwrap().origin());
        }
        assert_eq!(contract.protocol(), "bogunon-surface");
        assert!(contract.https_scheme());
        assert!(!contract.relies_on_incognito());
        assert!(contract.csp().contains("default-src 'none'"));
        assert!(contract.csp().contains("frame-src 'none'"));
        assert!(!contract.csp().contains("supabase"));
        assert!(!contract.csp().contains("tauri.localhost"));
        assert!(!contract.csp().contains("unsafe-inline"));
    }
}
