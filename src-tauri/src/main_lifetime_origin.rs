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
