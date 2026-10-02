use super::ChatGptAuthState;

#[test]
fn active_attempt_guard_releases_on_drop() {
    let state = ChatGptAuthState::default();
    {
        let _guard = state.begin_attempt().expect("first attempt");
        assert!(state.begin_attempt().is_err());
        assert!(state.is_active());
    }

    assert!(!state.is_active());
    assert!(state.begin_attempt().is_ok());
}
