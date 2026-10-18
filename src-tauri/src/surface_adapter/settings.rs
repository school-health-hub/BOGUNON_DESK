use super::Error;
use crate::surface_storage::StorageContract;
use std::path::{Path, PathBuf};
use tauri::Url;
pub(super) const LABEL: &str = "desktop-surface";
pub(super) struct Settings {
    pub directory: PathBuf,
    pub url: Url,
}
impl Settings {
    pub fn new(root: &Path) -> Result<Self, Error> {
        if !root.is_absolute()
            || root
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(Error::Isolation);
        }
        Ok(Self {
            directory: root.join(StorageContract.directory_leaf()),
            url: Url::parse("bogunon-surface://localhost/surface.html")
                .map_err(|_| Error::Isolation)?,
        })
    }
}
pub(super) fn local(url: &Url) -> bool {
    url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path() == "/surface.html"
        && matches!(
            (url.scheme(), url.host_str()),
            ("bogunon-surface", Some("localhost")) | ("https", Some("bogunon-surface.localhost"))
        )
}
pub(super) fn acl_valid() -> bool {
    // Check the real build-merged ACL with Tauri's locked public resolver.
    use std::collections::BTreeMap;
    use tauri::utils::{
        acl::{capability::Capability, manifest::Manifest, resolved::Resolved},
        platform::Target,
    };
    let Ok(manifests) = serde_json::from_str::<BTreeMap<String, Manifest>>(include_str!(
        "../../gen/schemas/acl-manifests.json"
    )) else {
        return false;
    };
    let Ok(capabilities) = serde_json::from_str::<BTreeMap<String, Capability>>(include_str!(
        "../../gen/schemas/capabilities.json"
    )) else {
        return false;
    };
    let Ok(resolved) = Resolved::resolve(&manifests, capabilities, Target::Windows) else {
        return false;
    };
    resolved.has_app_acl
        && resolved.allowed_commands.iter().all(|(_, grants)| {
            grants.iter().all(|grant| {
                !grant.windows.iter().any(|p| p.matches(LABEL))
                    && !grant.webviews.iter().any(|p| p.matches(LABEL))
            })
        })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dedicated_udf_origin_and_fixed_navigation_only() {
        let settings = Settings::new(Path::new("C:/synthetic/LocalData")).unwrap();
        assert_eq!(
            settings.directory,
            Path::new("C:/synthetic/LocalData/kr.sungandi.schoolhealthdesk.surface-v1")
        );
        assert_ne!(
            settings.directory,
            Path::new("C:/synthetic/LocalData/kr.sungandi.schoolhealthdesk")
        );
        assert!(local(&settings.url));
        assert!(local(
            &Url::parse("https://bogunon-surface.localhost/surface.html").unwrap()
        ));
        for target in [
            "https://tauri.localhost/surface.html",
            "https://bogunon-surface.localhost/index.html",
            "https://example.com",
            "https://user@bogunon-surface.localhost/surface.html",
            "https://bogunon-surface.localhost/surface.html?x=1",
        ] {
            assert!(!local(&Url::parse(target).unwrap()));
        }
        assert!(Settings::new(Path::new("relative")).is_err());
    }
    #[test]
    fn merged_acl_denies_surface_all_commands_and_plugins() {
        assert!(acl_valid());
    }
}
