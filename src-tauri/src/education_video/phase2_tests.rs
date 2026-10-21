use super::{model::*, store, timestamps, wire::*};
use std::fs;

fn entry() -> LibraryEntry {
    LibraryEntry {
        video_id: "EVmock00001".into(),
        teacher: TeacherData {
            education_title: "교육".into(),
            target: "학생".into(),
            schedule: "기간".into(),
            instructions: "안내".into(),
            message: "교사 수정".into(),
            notes: "교사 메모".into(),
        },
        provider: Some(ProviderMetadata {
            title: "합성 영상".into(),
            channel_id: "mock-channel".into(),
            channel_title: "합성 채널".into(),
            duration_seconds: None,
            url: "https://www.youtube.com/watch?v=EVmock00001".into(),
            source: VideoSource::SyntheticMock,
            official: false,
            official_evidence: None,
            synthetic: true,
            fetched_at: "2026-10-22T00:00:00.000Z".into(),
            expires_at: "2026-11-21T00:00:00.000Z".into(),
        }),
    }
}
#[test]
fn expiration_keeps_teacher_and_validates_calendar() {
    let mut item = entry();
    let now = timestamps::parse_iso("2026-11-21T00:00:00.000Z").unwrap();
    item.expire(now).unwrap();
    assert!(item.provider.is_none());
    assert_eq!(item.teacher.notes, "교사 메모");
    assert!(timestamps::parse_iso("2026-02-30T00:00:00.000Z").is_err());
    assert_eq!(
        timestamps::format_iso(timestamps::parse_iso("2024-02-29T12:34:56.789Z").unwrap()),
        "2024-02-29T12:34:56.789Z"
    );
}
#[test]
fn ttl_above_thirty_days_is_rejected() {
    let mut item = entry();
    item.provider.as_mut().unwrap().expires_at = "2026-11-22T00:00:00.000Z".into();
    assert!(item.validate().is_err());
}
#[test]
fn v1_migration_preserves_original_and_teacher_data() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let v1 = r#"{"version":1,"items":[{"videoId":"EVmock00001","title":"합성","channelId":"mock","channelTitle":"합성","durationSeconds":600,"url":"https://www.youtube.com/watch?v=EVmock00001","source":"mock","educationTitle":"교육","target":"대상","schedule":"기간","instructions":"안내","message":"수정문","notes":"메모"}]}"#;
    fs::write(&path, v1).unwrap();
    let loaded = store::load(&path).unwrap();
    assert_eq!(loaded.library.version, 2);
    assert_eq!(loaded.library.entries[0].teacher.notes, "메모");
    assert_eq!(
        fs::read_to_string(path.with_extension("v1-backup.json")).unwrap(),
        v1
    );
    assert!(
        loaded.library.entries[0]
            .provider
            .as_ref()
            .unwrap()
            .synthetic
    );
}
#[test]
fn metadata_delete_preserves_teacher_and_unknown_duration() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let mut item = entry();
    item.provider = None;
    store::save_entry(&path, item).unwrap();
    let result = store::delete_metadata(&path, "EVmock00001").unwrap();
    assert_eq!(result.library.entries[0].teacher.message, "교사 수정");
    assert!(result.library.entries[0].provider.is_none());
}
#[test]
fn wire_allows_empty_unknown_duration_and_rejects_bad_metadata() {
    let empty = r#"{"source":"live","notice":"조회 완료","results":[]}"#;
    assert!(parse_response(empty.as_bytes()).is_ok());
    let response = serde_json::json!({"source":"live","notice":"조회 완료","results":[{"videoId":"EVmock00001","title":"영상","channelId":"UCchannel","channelTitle":"채널","durationSeconds":null,"url":"https://www.youtube.com/watch?v=EVmock00001","official":false,"officialEvidence":null,"synthetic":false,"fetchedAt":timestamps::format_iso(timestamps::now_ms().unwrap())}]});
    assert!(parse_response(response.to_string().as_bytes())
        .unwrap()
        .results[0]
        .duration_seconds
        .is_none());
    let mut invalid = response;
    invalid["results"][0]["durationSeconds"] = serde_json::json!(0);
    assert!(parse_response(invalid.to_string().as_bytes()).is_err());
}

#[test]
fn far_future_import_cannot_extend_retention() {
    let mut item = entry();
    let p = item.provider.as_mut().unwrap();
    p.fetched_at = "2099-01-01T00:00:00.000Z".into();
    p.expires_at = "2099-01-02T00:00:00.000Z".into();
    assert!(item.validate().is_err());
}
#[test]
fn expiry_physically_purges_primary_backup_export_but_keeps_teacher() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let now = timestamps::now_ms().unwrap();
    let mut item = entry();
    let p = item.provider.as_mut().unwrap();
    p.source = VideoSource::Live;
    p.synthetic = false;
    p.title = "expired-provider-sentinel".into();
    p.fetched_at = timestamps::format_iso(now - timestamps::MAX_TTL_MS - 1000);
    p.expires_at = timestamps::format_iso(now - 1000);
    let library = Library {
        version: 2,
        entries: vec![item],
    };
    let raw = serde_json::to_string(&library).unwrap();
    fs::write(&path, &raw).unwrap();
    fs::write(path.with_extension("backup.json"), &raw).unwrap();
    let result = store::load(&path).unwrap();
    assert_eq!(result.library.entries[0].teacher.notes, "교사 메모");
    assert!(result.library.entries[0].provider.is_none());
    for json in [
        fs::read_to_string(&path).unwrap(),
        fs::read_to_string(path.with_extension("backup.json")).unwrap(),
        store::export(&path).unwrap(),
    ] {
        assert!(!json.contains("expired-provider-sentinel"));
        assert!(json.contains("교사 메모"));
    }
}

#[test]
fn official_live_fixture_and_refresh_keep_teacher_data() {
    let json = include_bytes!("fixtures/official-live-response.json");
    let response = parse_response(json).unwrap();
    assert!(response.results[0].official);
    assert_eq!(
        response.results[0].official_evidence.as_deref(),
        Some("https://moe.go.kr/main.do")
    );
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let mut saved = entry();
    saved.provider = None;
    store::save_entry(&path, saved).unwrap();
    let now = timestamps::now_ms().unwrap();
    let mut provider = entry().provider.unwrap();
    provider.source = VideoSource::Live;
    provider.synthetic = false;
    provider.channel_id = "UCexUyFaq9YH7XJfCQzVR_jg".into();
    provider.official = true;
    provider.official_evidence = Some("https://moe.go.kr/main.do".into());
    provider.fetched_at = timestamps::format_iso(now);
    provider.expires_at = timestamps::format_iso(now + timestamps::MAX_TTL_MS);
    let loaded = store::refresh_metadata(&path, "EVmock00001", provider).unwrap();
    assert_eq!(loaded.library.entries[0].teacher.notes, "교사 메모");
    assert_eq!(loaded.library.entries[0].teacher.message, "교사 수정");
    assert!(
        loaded.library.entries[0]
            .provider
            .as_ref()
            .unwrap()
            .official
    );
    let deleted = store::delete_metadata(&path, "EVmock00001").unwrap();
    assert!(deleted.library.entries[0].provider.is_none());
    let backup = fs::read_to_string(path.with_extension("backup.json")).unwrap();
    assert!(!backup.contains("moe.go.kr"));
    assert!(backup.contains("교사 메모"));
}
