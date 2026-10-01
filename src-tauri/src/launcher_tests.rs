use super::{
    build_bogunon_search_result_url, build_bogunon_url, execute_quick_memo_url,
    execute_work_portal_target, normalize_optional_url, parse_web_url,
    reserve_work_portal_auto_open, resolve_bogunon_search_result_target, resolve_quick_memo_url,
    resolve_work_portal_target, BogunonSearchResultKind, WorkPortalAutoOpenDelay,
    WorkPortalAutoOpenState, WorkPortalTarget,
};
use std::cell::Cell;

#[test]
fn accepts_http_and_https_launcher_urls() {
    assert!(parse_web_url("https://example.com/health").is_ok());
    assert!(parse_web_url("http://localhost:3000").is_ok());
}

#[test]
fn rejects_non_web_launcher_urls() {
    assert!(parse_web_url("file:///C:/Windows").is_err());
    assert!(parse_web_url("javascript:alert(1)").is_err());
    assert!(parse_web_url("example.com").is_err());
}

#[test]
fn joins_aed_route_to_base_without_trailing_slash() {
    let url = build_bogunon_url("https://example.com", "/aed");

    assert_eq!(
        url.expect("valid BOGUNON URL").as_str(),
        "https://example.com/aed"
    );
}

#[test]
fn joins_ai_writer_route_to_base_with_trailing_slash() {
    let url = build_bogunon_url("https://example.com/", "/ai-writer");

    assert_eq!(
        url.expect("valid BOGUNON URL").as_str(),
        "https://example.com/ai-writer"
    );
}

#[test]
fn joins_school_settings_route_with_anchor() {
    let url = build_bogunon_url("https://example.com/", "/settings#school-information")
        .expect("school settings URL should be valid");

    assert_eq!(
        url.as_str(),
        "https://example.com/settings#school-information"
    );
}

#[test]
fn normalizes_optional_account_launcher_urls() {
    assert_eq!(
        normalize_optional_url(Some(" https://example.com/path ".to_owned()))
            .expect("valid launcher URL"),
        Some("https://example.com/path".to_owned())
    );
    assert_eq!(normalize_optional_url(None).expect("empty URL"), None);
    assert!(normalize_optional_url(Some("file:///C:/secret".to_owned())).is_err());
}

#[test]
fn resolves_work_portal_target_without_exposing_arbitrary_schemes() {
    assert_eq!(
        resolve_work_portal_target(None),
        WorkPortalTarget::Unavailable("업무포털 주소가 아직 설정되지 않았습니다.")
    );
    assert_eq!(
        resolve_work_portal_target(Some("file:///C:/secret")),
        WorkPortalTarget::Unavailable("저장된 업무포털 주소를 사용할 수 없습니다.")
    );
    assert_eq!(
        resolve_work_portal_target(Some(" https://portal.example.com/login ")),
        WorkPortalTarget::Ready("https://portal.example.com/login".to_owned())
    );
}

#[test]
fn parses_supported_auto_open_delays_and_falls_back_to_off() {
    assert_eq!(
        WorkPortalAutoOpenDelay::from_stored(None),
        WorkPortalAutoOpenDelay::Off
    );
    assert_eq!(
        WorkPortalAutoOpenDelay::from_stored(Some("20s")),
        WorkPortalAutoOpenDelay::After20Seconds
    );
    assert_eq!(
        WorkPortalAutoOpenDelay::from_stored(Some("45s")),
        WorkPortalAutoOpenDelay::After45Seconds
    );
    assert_eq!(
        WorkPortalAutoOpenDelay::from_stored(Some("unexpected")),
        WorkPortalAutoOpenDelay::Off
    );
}

#[test]
fn schedules_only_once_when_delay_and_valid_url_are_configured() {
    let state = WorkPortalAutoOpenState::default();

    assert_eq!(
        reserve_work_portal_auto_open(
            &state,
            WorkPortalAutoOpenDelay::After20Seconds,
            Some("https://portal.example.com/")
        ),
        Some(20)
    );
    assert_eq!(
        reserve_work_portal_auto_open(
            &state,
            WorkPortalAutoOpenDelay::After20Seconds,
            Some("https://portal.example.com/")
        ),
        None
    );
}

#[test]
fn skips_auto_open_when_disabled_missing_or_invalid() {
    assert_eq!(
        reserve_work_portal_auto_open(
            &WorkPortalAutoOpenState::default(),
            WorkPortalAutoOpenDelay::Off,
            Some("https://portal.example.com/")
        ),
        None
    );
    assert_eq!(
        reserve_work_portal_auto_open(
            &WorkPortalAutoOpenState::default(),
            WorkPortalAutoOpenDelay::After20Seconds,
            None
        ),
        None
    );
    assert_eq!(
        reserve_work_portal_auto_open(
            &WorkPortalAutoOpenState::default(),
            WorkPortalAutoOpenDelay::After45Seconds,
            Some("file:///C:/secret")
        ),
        None
    );
}

#[test]
fn preserves_the_selected_auto_open_delay() {
    assert_eq!(
        reserve_work_portal_auto_open(
            &WorkPortalAutoOpenState::default(),
            WorkPortalAutoOpenDelay::After45Seconds,
            Some("https://portal.example.com/")
        ),
        Some(45)
    );
}

#[test]
fn calls_the_opener_once_for_a_valid_target() {
    let calls = Cell::new(0);
    let result = execute_work_portal_target(
        WorkPortalTarget::Ready("https://portal.example.com/".to_owned()),
        |_| {
            calls.set(calls.get() + 1);
            Ok(())
        },
    );

    assert_eq!(result, Ok(None));
    assert_eq!(calls.get(), 1);
}

#[test]
fn does_not_call_the_opener_for_an_invalid_target() {
    let calls = Cell::new(0);
    let result = execute_work_portal_target(
        resolve_work_portal_target(Some("file:///C:/secret")),
        |_| {
            calls.set(calls.get() + 1);
            Ok(())
        },
    );

    assert_eq!(
        result,
        Ok(Some("저장된 업무포털 주소를 사용할 수 없습니다."))
    );
    assert_eq!(calls.get(), 0);
}

#[test]
fn builds_allowlisted_bogunon_search_result_routes() {
    let task = build_bogunon_search_result_url(
        "https://example.com/settings",
        BogunonSearchResultKind::Task,
        "550e8400-e29b-41d4-a716-446655440000",
        Some("2026-09-18"),
    )
    .expect("valid task route");
    let event = build_bogunon_search_result_url(
        "https://example.com/",
        BogunonSearchResultKind::Event,
        "event_123",
        Some("2026-09-19"),
    )
    .expect("valid event route");
    let undated_task = build_bogunon_search_result_url(
        "https://example.com/",
        BogunonSearchResultKind::Task,
        "task-123",
        None,
    )
    .expect("undated task route");

    assert_eq!(task.as_str(), "https://example.com/calendar?date=2026-09-18&highlight=task%3A550e8400-e29b-41d4-a716-446655440000");
    assert_eq!(
        event.as_str(),
        "https://example.com/calendar?date=2026-09-19&highlight=event%3Aevent_123"
    );
    assert_eq!(undated_task.as_str(), "https://example.com/tasks");
}

#[test]
fn rejects_unsafe_search_result_inputs() {
    assert!(build_bogunon_search_result_url(
        "https://example.com/",
        BogunonSearchResultKind::Event,
        "../settings",
        Some("2026-09-18"),
    )
    .is_err());
    assert!(build_bogunon_search_result_url(
        "https://example.com/",
        BogunonSearchResultKind::Task,
        "task-1",
        Some("2026-99-99"),
    )
    .is_err());
    assert!(build_bogunon_search_result_url(
        "https://example.com/",
        BogunonSearchResultKind::Event,
        "event-1",
        None,
    )
    .is_err());
}

#[test]
fn leaves_bogunon_search_result_unavailable_without_a_configured_base_url() {
    assert_eq!(
        resolve_bogunon_search_result_target(
            None,
            BogunonSearchResultKind::Task,
            "task-1",
            Some("2026-09-18"),
        )
        .expect("unset base URL is not an invalid request"),
        None
    );
}

#[test]
fn rejects_unknown_search_result_kinds_at_the_command_boundary() {
    assert!(serde_json::from_str::<BogunonSearchResultKind>("\"arbitrary\"").is_err());
}

#[test]
fn opens_only_valid_http_and_https_quick_memo_urls() {
    assert_eq!(
        resolve_quick_memo_url("https://example.com/path").expect("valid https URL"),
        "https://example.com/path"
    );
    assert_eq!(
        resolve_quick_memo_url("http://school.example.kr/").expect("valid http URL"),
        "http://school.example.kr/"
    );
    assert!(resolve_quick_memo_url("javascript:alert(1)").is_err());
    assert!(resolve_quick_memo_url("file:///C:/secret").is_err());
    assert!(resolve_quick_memo_url("https://").is_err());
}

#[test]
fn calls_the_quick_memo_opener_once_for_a_valid_url() {
    let calls = Cell::new(0);

    let result = execute_quick_memo_url("https://example.com/", |_| {
        calls.set(calls.get() + 1);
        Ok(())
    });

    assert_eq!(result, Ok(()));
    assert_eq!(calls.get(), 1);
}
