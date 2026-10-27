use tauri::Url;
pub(super) fn matches_origin(url: &Url, expected: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.username().is_empty()
        && url.password().is_none()
        && url.origin() == expected.origin()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(feature = "desktop-surface-qa")]
    #[test]
    fn portable_qa_uses_embedded_origin_mode_without_a_dev_server() {
        // Given the feature used by direct Cargo portable QA builds.
        // When the linked Tauri feature graph selects the origin mode.
        // Then a missing devUrl cannot make every local-origin check fail.
        assert!(!tauri::is_dev());
    }

    #[test]
    fn exact_origin_accepts_local_routes() {
        // Given the effective development origin.
        let expected = Url::parse("http://localhost:1420").unwrap();
        // When a route on that origin is considered.
        let actual = Url::parse("http://localhost:1420/settings?q=1#tab").unwrap();
        // Then it is local.
        assert!(matches_origin(&actual, &expected));
    }
    #[test]
    fn embedded_origin_requires_the_exact_selected_scheme() {
        // Given either configured embedded origin.
        for scheme in ["http", "https"] {
            let expected = Url::parse(&format!("{scheme}://tauri.localhost")).unwrap();
            // When a local route on the exact origin is checked.
            let actual = Url::parse(&format!("{scheme}://tauri.localhost/index.html?q=1")).unwrap();
            // Then it is allowed; a foreign authority is not.
            assert!(matches_origin(&actual, &expected));
            assert!(!matches_origin(
                &Url::parse("http://localhost:1420").unwrap(),
                &expected
            ));
        }
    }
    #[test]
    fn foreign_authorities_and_schemes_are_rejected() {
        // Given a production origin.
        let expected = Url::parse("http://tauri.localhost").unwrap();
        // When lookalike and foreign authorities are considered.
        for candidate in [
            "http://tauri.localhost:8080",
            "http://user@tauri.localhost",
            "http://user:pass@tauri.localhost",
            "http://tauri.localhost.evil",
            "https://tauri.localhost",
            "file:///index.html",
            "data:text/html,hello",
            "about:blank",
            "http://evil/?tauri.localhost",
        ] {
            // Then each candidate is rejected.
            assert!(
                !matches_origin(&Url::parse(candidate).unwrap(), &expected),
                "{candidate}"
            );
        }
    }
    #[test]
    fn development_requires_effective_origin() {
        // Given the configured development origin.
        let expected = Url::parse("http://localhost:1420").unwrap();
        // When a different port, host, or scheme is considered.
        for candidate in [
            "http://localhost:1421",
            "http://127.0.0.1:1420",
            "https://localhost:1420",
            "http://user@localhost:1420",
        ] {
            // Then admission is rejected.
            assert!(!matches_origin(&Url::parse(candidate).unwrap(), &expected));
        }
    }
}
