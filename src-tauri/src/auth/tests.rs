use std::collections::BTreeMap;

use super::{
    parse_oauth_url, protect, read_entries, read_entries_for_update, unprotect, valid_storage_key,
    write_entries,
};

#[test]
fn accepts_supabase_oauth_authorize_url() {
    let result = parse_oauth_url(
        "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize?provider=google&redirect_to=school-health-desk%3A%2F%2Fauth%2Fcallback%3Fsb_flow_id%3D11111111111111111111111111111111",
    );

    assert!(result.is_ok());
}

#[test]
fn rejects_non_https_or_unexpected_oauth_paths() {
    assert!(parse_oauth_url("http://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize").is_err());
    assert!(parse_oauth_url("https://xxownwxxajzrviuvvfiu.supabase.co/rest/v1/data").is_err());
    assert!(parse_oauth_url("https://example.com/auth/v1/authorize").is_err());
    assert!(parse_oauth_url(
        "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize?provider=github&redirect_to=school-health-desk%3A%2F%2Fauth%2Fcallback%3Fsb_flow_id%3D11111111111111111111111111111111"
    )
    .is_err());
    assert!(parse_oauth_url(
        "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fexample.com%3Fsb_flow_id%3D11111111111111111111111111111111"
    )
    .is_err());
    assert!(parse_oauth_url("javascript:alert(1)").is_err());
}

#[test]
fn rejects_a_different_supabase_project_origin() {
    assert!(parse_oauth_url(
        "https://another-project.supabase.co/auth/v1/authorize?provider=google&redirect_to=school-health-desk%3A%2F%2Fauth%2Fcallback%3Fsb_flow_id%3D11111111111111111111111111111111"
    )
    .is_err());
}

#[test]
fn rejects_oauth_urls_without_a_valid_flow_identifier() {
    assert!(parse_oauth_url(
        "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize?provider=google&redirect_to=school-health-desk%3A%2F%2Fauth%2Fcallback"
    )
    .is_err());
    assert!(parse_oauth_url(
        "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1/authorize?provider=google&redirect_to=school-health-desk%3A%2F%2Fauth%2Fcallback%3Fsb_flow_id%3Dshort"
    )
    .is_err());
}

#[test]
fn accepts_only_bounded_storage_keys() {
    assert!(valid_storage_key("sb-project-auth-token-code-verifier"));
    assert!(!valid_storage_key(""));
    assert!(!valid_storage_key("unrelated-key"));
    assert!(!valid_storage_key("token/path"));
    assert!(!valid_storage_key(&"a".repeat(513)));
}

#[cfg(windows)]
#[test]
fn windows_dpapi_round_trip_preserves_session_payload() {
    let entries = BTreeMap::from([("sb-project-auth-token", "session-json")]);
    let plaintext = serde_json::to_vec(&entries).expect("serialize entries");
    let encrypted = protect(&plaintext).expect("protect session");

    assert_ne!(encrypted, plaintext);
    assert_eq!(unprotect(&encrypted).expect("unprotect session"), plaintext);
}

#[cfg(windows)]
#[test]
fn corrupted_session_file_can_be_replaced_during_new_login() {
    let path = std::env::temp_dir().join(format!(
        "school-health-desk-auth-{}-{}.bin",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock")
            .as_nanos()
    ));
    std::fs::write(&path, b"not-a-dpapi-payload").expect("write corrupt fixture");

    let mut entries = read_entries_for_update(&path).expect("recover corrupt storage");
    entries.insert("sb-project-auth-token".to_owned(), "new-session".to_owned());
    write_entries(&path, &entries).expect("replace corrupt storage");

    assert_eq!(read_entries(&path).expect("read replacement"), entries);
    std::fs::remove_file(path).expect("remove fixture");
}
