use super::{model::*, store, timestamps, wire::*};
use std::fs;

fn entry() -> LibraryEntry {
    LibraryEntry {
        recommendation_reason: None,
        candidate_record: None,
        ai: None,
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
fn recommendation_reason_roundtrip_preserves_edits_and_explicit_deletion() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let mut item = entry();
    item.recommendation_reason = Some(RecommendationReason::TeacherEdited {
        text: "교사 최종 이유".into(),
    });
    let saved = store::save_entry(&path, item).unwrap();
    assert_eq!(
        saved.library.entries[0].recommendation_reason,
        Some(RecommendationReason::TeacherEdited {
            text: "교사 최종 이유".into()
        })
    );
    let mut deleted = entry();
    deleted.recommendation_reason = Some(RecommendationReason::Deleted);
    let saved = store::save_entry(&path, deleted).unwrap();
    assert_eq!(
        saved.library.entries[0].recommendation_reason,
        Some(RecommendationReason::Deleted)
    );
    assert_eq!(
        parse(&store::export(&path).unwrap()).unwrap(),
        saved.library
    );
    let mut padded = entry();
    padded.recommendation_reason = Some(RecommendationReason::TeacherEdited {
        text: " padded ".into(),
    });
    assert!(padded.validate().is_err());
}
#[test]
fn candidate_record_roundtrip_survives_ai_expiry_and_rejects_unconfirmed_values() {
    use super::ai_metadata::{CandidateProvenance, FactVerificationStatus, MetadataVerification};
    let mut item = entry();
    let saved_at = timestamps::format_iso(timestamps::now_ms().unwrap());
    item.candidate_record = Some(CandidateRecord {
        provenance: CandidateProvenance::TeacherSupplied,
        title: Some("교사 확인 제목".into()),
        publisher: None,
        duration_seconds: Some(600),
        metadata_verification: MetadataVerification {
            title: FactVerificationStatus::TeacherConfirmed,
            publisher: FactVerificationStatus::Unverified,
            duration_seconds: FactVerificationStatus::TeacherConfirmed,
        },
        saved_at,
    });
    item.validate().unwrap();
    let encoded = serde_json::to_string(&Library {
        version: 2,
        entries: vec![item.clone()],
    })
    .unwrap();
    let restored = parse(&encoded).unwrap();
    assert_eq!(restored.entries[0].candidate_record, item.candidate_record);
    let mut invalid = item;
    invalid.candidate_record.as_mut().unwrap().publisher = Some("AI 추정 기관".into());
    assert!(invalid.validate().is_err());
}
#[test]
fn legacy_v2_import_cannot_downgrade_confirmed_candidate_facts() {
    use super::ai_metadata::{
        AiMetadata, AiSource, CandidateProvenance, FactVerificationStatus, MetadataVerification,
    };
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let checked_at = timestamps::format_iso(timestamps::now_ms().unwrap());
    let mut confirmed = entry();
    confirmed.ai = Some(AiMetadata {
        video_id: confirmed.video_id.clone(),
        url: format!("https://www.youtube.com/watch?v={}", confirmed.video_id),
        title: "교사 확인 제목".into(),
        publisher: Some("교육기관".into()),
        duration_seconds: Some(600),
        description: "합성 설명".into(),
        relevance: "관련성".into(),
        reason: "이유".into(),
        sources: vec![AiSource {
            url: format!("https://www.youtube.com/watch?v={}", confirmed.video_id),
            title: "출처".into(),
        }],
        checked_at: checked_at.clone(),
        needs_review: true,
        provenance: CandidateProvenance::TeacherConfirmed,
        metadata_verification: MetadataVerification {
            title: FactVerificationStatus::TeacherConfirmed,
            publisher: FactVerificationStatus::TeacherConfirmed,
            duration_seconds: FactVerificationStatus::TeacherConfirmed,
        },
    });
    store::save_entry(&path, confirmed).unwrap();

    let mut legacy = entry();
    legacy.provider = None;
    legacy.ai = Some(AiMetadata {
        video_id: legacy.video_id.clone(),
        url: format!("https://www.youtube.com/watch?v={}", legacy.video_id),
        title: "검증되지 않은 제목".into(),
        publisher: None,
        duration_seconds: None,
        description: "합성 설명".into(),
        relevance: "관련성".into(),
        reason: "이유".into(),
        sources: vec![AiSource {
            url: format!("https://www.youtube.com/watch?v={}", legacy.video_id),
            title: "출처".into(),
        }],
        checked_at,
        needs_review: true,
        provenance: CandidateProvenance::Unverified,
        metadata_verification: MetadataVerification::default(),
    });
    let imported = store::import(
        &path,
        &serde_json::to_string(&Library {
            version: 2,
            entries: vec![legacy],
        })
        .unwrap(),
    )
    .unwrap();
    let restored = &imported.library.entries[0];
    assert_eq!(
        restored.candidate_record.as_ref().unwrap().title.as_deref(),
        Some("교사 확인 제목")
    );
    assert_eq!(restored.ai.as_ref().unwrap().title, "교사 확인 제목");
    assert_eq!(
        restored.ai.as_ref().unwrap().provenance,
        CandidateProvenance::TeacherConfirmed
    );
}
#[test]
fn import_allows_verified_provenance_upgrade_but_not_confirmed_downgrade() {
    use super::ai_metadata::{AiMetadata, AiSource, CandidateProvenance, MetadataVerification};
    fn metadata(provenance: CandidateProvenance) -> AiMetadata {
        let video_id = "EVmock00001".to_owned();
        AiMetadata {
            video_id: video_id.clone(),
            url: format!("https://www.youtube.com/watch?v={video_id}"),
            title: "합성 제목".into(),
            publisher: None,
            duration_seconds: None,
            description: "합성 설명".into(),
            relevance: "관련성".into(),
            reason: "이유".into(),
            sources: vec![AiSource {
                url: format!("https://www.youtube.com/watch?v={video_id}"),
                title: "출처".into(),
            }],
            checked_at: timestamps::format_iso(timestamps::now_ms().unwrap()),
            needs_review: true,
            provenance,
            metadata_verification: MetadataVerification::default(),
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let mut initial = entry();
    initial.ai = Some(metadata(CandidateProvenance::Unverified));
    store::save_entry(&path, initial).unwrap();
    let mut incoming = entry();
    incoming.provider = None;
    incoming.ai = Some(metadata(CandidateProvenance::WebSearchVerified));
    let imported = store::import(
        &path,
        &serde_json::to_string(&Library {
            version: 2,
            entries: vec![incoming],
        })
        .unwrap(),
    )
    .unwrap();
    assert_eq!(
        imported.library.entries[0].ai.as_ref().unwrap().provenance,
        CandidateProvenance::WebSearchVerified
    );
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

#[test]
fn ai_evidence_roundtrip_preserves_teacher_and_expires_metadata() {
    let mut saved = entry();
    let now = timestamps::now_ms().unwrap();
    let checked = saved.provider.as_ref().unwrap().fetched_at.clone();
    saved.ai = Some(super::ai_metadata::AiMetadata {
        video_id: saved.video_id.clone(),
        url: format!("https://www.youtube.com/watch?v={}", saved.video_id),
        title: "합성 출처 제목".into(),
        publisher: None,
        duration_seconds: None,
        description: "공개 소개정보 기반 합성 요약".into(),
        relevance: "교육 관련성".into(),
        reason: "선정 이유".into(),
        sources: vec![super::ai_metadata::AiSource {
            url: format!("https://www.youtube.com/watch?v={}", saved.video_id),
            title: "합성 출처 제목".into(),
        }],
        checked_at: checked,
        needs_review: true,
        provenance: super::ai_metadata::CandidateProvenance::WebSearchVerified,
        metadata_verification: super::ai_metadata::MetadataVerification::default(),
    });
    saved.candidate_record = Some(CandidateRecord {
        provenance: super::ai_metadata::CandidateProvenance::WebSearchVerified,
        title: None,
        publisher: None,
        duration_seconds: None,
        metadata_verification: super::ai_metadata::MetadataVerification::default(),
        saved_at: timestamps::format_iso(now),
    });
    saved.validate().unwrap();
    saved.candidate_record.as_mut().unwrap().provenance =
        super::ai_metadata::CandidateProvenance::TeacherSupplied;
    assert!(saved.validate().is_err());
    saved.candidate_record.as_mut().unwrap().provenance =
        super::ai_metadata::CandidateProvenance::WebSearchVerified;
    let encoded = serde_json::to_string(&Library {
        version: 2,
        entries: vec![saved.clone()],
    })
    .unwrap();
    let parsed = super::model::parse(&encoded).unwrap();
    assert_eq!(parsed.entries[0].ai, saved.ai);
    saved.expire(now + timestamps::MAX_TTL_MS + 1).unwrap();
    assert!(saved.ai.is_none());
    assert!(saved.candidate_record.is_some());
    assert_eq!(saved.teacher.notes, "교사 메모");
}

#[test]
fn ai_evidence_rejects_private_source_and_unknown_fields() {
    let json = serde_json::json!({"videoId":"EVmock00001","url":"https://www.youtube.com/watch?v=EVmock00001","title":"합성","publisher":null,"durationSeconds":null,"description":"소개","relevance":"관련","reason":"추천","sources":[{"url":"http://localhost/private","title":"출처"}],"checkedAt":"2026-01-01T00:00:00.000Z","needsReview":true});
    let metadata: super::ai_metadata::AiMetadata = serde_json::from_value(json.clone()).unwrap();
    assert!(metadata.validate("EVmock00001").is_err());
    let mut extra = json;
    extra["accessToken"] = serde_json::json!("synthetic-forbidden-field");
    assert!(serde_json::from_value::<super::ai_metadata::AiMetadata>(extra).is_err());
}

#[test]
fn ai_evidence_legacy_defaults_never_promote_provenance_or_facts() {
    let json = serde_json::json!({"videoId":"EVmock00001","url":"https://www.youtube.com/watch?v=EVmock00001","title":"기존 제목","publisher":null,"durationSeconds":null,"description":"소개","relevance":"관련","reason":"추천","sources":[{"url":"https://www.youtube.com/watch?v=EVmock00001","title":"출처"}],"checkedAt":"2026-01-01T00:00:00.000Z","needsReview":true});
    let metadata: super::ai_metadata::AiMetadata = serde_json::from_value(json).unwrap();
    assert_eq!(
        metadata.provenance,
        super::ai_metadata::CandidateProvenance::Unverified
    );
    assert_eq!(
        metadata.metadata_verification,
        super::ai_metadata::MetadataVerification::default()
    );
}

#[test]
fn ai_evidence_rejects_partially_upgraded_verification_contract() {
    let base = serde_json::json!({"videoId":"EVmock00001","url":"https://www.youtube.com/watch?v=EVmock00001","title":"기존 제목","publisher":null,"durationSeconds":null,"description":"소개","relevance":"관련","reason":"추천","sources":[{"url":"https://www.youtube.com/watch?v=EVmock00001","title":"출처"}],"checkedAt":"2026-01-01T00:00:00.000Z","needsReview":true});
    let mut provenance_only = base.clone();
    provenance_only["provenance"] = serde_json::json!("teacher-supplied");
    assert!(serde_json::from_value::<super::ai_metadata::AiMetadata>(provenance_only).is_err());
    let mut verification_only = base;
    verification_only["metadataVerification"] = serde_json::json!({"title":"unverified","publisher":"unverified","durationSeconds":"unverified"});
    assert!(serde_json::from_value::<super::ai_metadata::AiMetadata>(verification_only).is_err());
}

#[test]
fn ai_evidence_rejects_explicit_null_verification_contract() {
    let base = serde_json::json!({"videoId":"EVmock00001","url":"https://www.youtube.com/watch?v=EVmock00001","title":"기존 제목","publisher":null,"durationSeconds":null,"description":"소개","relevance":"관련","reason":"추천","sources":[{"url":"https://www.youtube.com/watch?v=EVmock00001","title":"출처"}],"checkedAt":"2026-01-01T00:00:00.000Z","needsReview":true});
    for (provenance, verification) in [
        (serde_json::Value::Null, serde_json::Value::Null),
        (
            serde_json::Value::Null,
            serde_json::json!({"title":"unverified","publisher":"unverified","durationSeconds":"unverified"}),
        ),
        (serde_json::json!("unverified"), serde_json::Value::Null),
    ] {
        let mut candidate = base.clone();
        candidate["provenance"] = provenance;
        candidate["metadataVerification"] = verification;
        assert!(serde_json::from_value::<super::ai_metadata::AiMetadata>(candidate).is_err());
    }
}

#[test]
fn ai_evidence_keeps_provenance_separate_and_rejects_confirmation_without_a_value() {
    let base = serde_json::json!({"videoId":"EVmock00001","url":"https://www.youtube.com/watch?v=EVmock00001","title":"제목","publisher":null,"durationSeconds":null,"description":"소개","relevance":"관련","reason":"추천","sources":[{"url":"https://www.youtube.com/watch?v=EVmock00001","title":"출처"}],"checkedAt":"2026-01-01T00:00:00.000Z","needsReview":true,"provenance":"teacher-confirmed","metadataVerification":{"title":"unverified","publisher":"unverified","durationSeconds":"unverified"}});
    let metadata: super::ai_metadata::AiMetadata = serde_json::from_value(base.clone()).unwrap();
    assert!(metadata.validate("EVmock00001").is_ok());
    let mut confirmed_title = base.clone();
    confirmed_title["provenance"] = serde_json::json!("teacher-supplied");
    confirmed_title["metadataVerification"]["title"] = serde_json::json!("teacher-confirmed");
    let metadata: super::ai_metadata::AiMetadata = serde_json::from_value(confirmed_title).unwrap();
    assert!(metadata.validate("EVmock00001").is_ok());
    let mut invalid_null = base;
    invalid_null["metadataVerification"]["publisher"] = serde_json::json!("teacher-confirmed");
    let metadata: super::ai_metadata::AiMetadata = serde_json::from_value(invalid_null).unwrap();
    assert!(metadata.validate("EVmock00001").is_err());
}

#[test]
fn legacy_teacher_save_preserves_ai_evidence_until_explicit_delete() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let mut saved = entry();
    let checked = saved.provider.as_ref().unwrap().fetched_at.clone();
    let source_url = format!("https://www.youtube.com/watch?v={}", saved.video_id);
    saved.ai = Some(super::ai_metadata::AiMetadata {
        video_id: saved.video_id.clone(),
        url: source_url.clone(),
        title: "합성 출처".into(),
        publisher: None,
        duration_seconds: None,
        description: "소개 정보".into(),
        relevance: "관련성".into(),
        reason: "추천 이유".into(),
        sources: vec![super::ai_metadata::AiSource {
            url: source_url,
            title: "합성 출처".into(),
        }],
        checked_at: checked,
        needs_review: true,
        provenance: super::ai_metadata::CandidateProvenance::WebSearchVerified,
        metadata_verification: super::ai_metadata::MetadataVerification::default(),
    });
    store::save_entry(&path, saved.clone()).unwrap();
    let mut legacy = saved.clone();
    legacy.ai = None;
    legacy.teacher.notes = "수정 메모".into();
    store::save_entry(&path, legacy).unwrap();
    let loaded = store::load(&path).unwrap();
    assert_eq!(loaded.library.entries[0].ai, saved.ai);
    assert_eq!(loaded.library.entries[0].teacher.notes, "수정 메모");
    store::delete_metadata(&path, &saved.video_id).unwrap();
    for location in [&path, &path.with_extension("backup.json")] {
        let library = super::model::parse(&fs::read_to_string(location).unwrap()).unwrap();
        assert!(library.entries[0].ai.is_none());
    }
}
