use super::*;

#[test]
fn given_url_readings_when_classified_then_only_fixed_states_are_returned() {
    // Given trusted, transient and foreign readings, including sensitive URL parts.
    for (raw, allowed, expected) in [
        (
            "http://tauri.localhost/",
            true,
            MainOriginState::ExpectedOrigin,
        ),
        (
            "https://tauri.localhost/",
            true,
            MainOriginState::ExpectedOrigin,
        ),
        (
            "about:blank",
            false,
            MainOriginState::InitialNavigationPending,
        ),
        (
            "about:blank#private-token",
            false,
            MainOriginState::UnexpectedOrigin,
        ),
        (
            "http://tauri.localhost:8080/",
            false,
            MainOriginState::UnexpectedOrigin,
        ),
        (
            "https://foreign.invalid/private?token=secret",
            false,
            MainOriginState::UnexpectedOrigin,
        ),
        (
            "file:///C:/Users/private/index.html",
            false,
            MainOriginState::UnexpectedOrigin,
        ),
    ] {
        // When the exact admission decision is observed without changing it.
        let observation = origin_reading(&Url::parse(raw).unwrap(), allowed);
        // Then no URL material is stored or serialized.
        assert_eq!(observation, expected);
        let serialized = serde_json::to_string(&observation).unwrap();
        for forbidden in ["http:", "https:", "file:", "private", "token", "Users"] {
            assert!(!serialized.contains(forbidden));
        }
    }
}

#[test]
fn given_all_observation_states_when_serialized_then_the_vocabulary_is_closed() {
    // Given every state, including unavailable and parser failures.
    for (state, expected) in [
        (MainOriginState::MainWebviewMissing, "main_webview_missing"),
        (MainOriginState::UrlUnavailable, "url_unavailable"),
        (
            MainOriginState::InitialNavigationPending,
            "initial_navigation_pending",
        ),
        (MainOriginState::ExpectedOrigin, "expected_origin"),
        (MainOriginState::UnexpectedOrigin, "unexpected_origin"),
        (MainOriginState::UrlParseFailed, "url_parse_failed"),
    ] {
        // When serialization crosses the diagnostic boundary.
        let value = serde_json::to_value(state).unwrap();
        // Then only the fixed classification is exposed.
        assert_eq!(value, expected);
    }
}
