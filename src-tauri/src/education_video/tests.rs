use super::{model::*, retention, store, timestamps};
use std::fs;
fn entry(id: &str, notes: &str) -> LibraryEntry {
    LibraryEntry {
        ai: None,
        video_id: id.into(),
        teacher: TeacherData {
            education_title: "교육".into(),
            target: "학생".into(),
            schedule: "기간".into(),
            instructions: "안내".into(),
            message: "교사 수정".into(),
            notes: notes.into(),
        },
        provider: None,
    }
}
#[test]
fn save_import_export_preserve_teacher_and_explicit_edits() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    store::save_entry(&path, entry("EVmock00001", "교사 메모")).unwrap();
    let incoming = Library {
        version: 2,
        entries: vec![
            entry("EVmock00001", "외부 메모"),
            entry("EVmock00002", "신규"),
        ],
    };
    let result = store::import(&path, &serde_json::to_string(&incoming).unwrap()).unwrap();
    assert_eq!(result.library.entries.len(), 2);
    assert_eq!(result.library.entries[0].teacher.notes, "교사 메모");
    let result = store::save_entry(&path, entry("EVmock00001", "직접 수정")).unwrap();
    assert_eq!(result.library.entries.len(), 2);
    assert_eq!(result.library.entries[0].teacher.notes, "직접 수정");
    assert_eq!(
        parse(&store::export(&path).unwrap()).unwrap(),
        result.library
    );
}
#[test]
fn corruption_and_binary_recover_first_save_backup() {
    for bytes in [
        b"broken JSON".to_vec(),
        vec![0xff, 0xfe],
        vec![b'x'; MAX_BYTES + 1],
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.json");
        store::save_entry(&path, entry("EVmock00001", "보존")).unwrap();
        fs::write(&path, &bytes).unwrap();
        let loaded = store::load(&path).unwrap();
        assert!(loaded.recovered);
        assert_eq!(loaded.library.entries[0].teacher.notes, "보존");
        let raw = fs::read_dir(dir.path().join("quarantine"))
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| path.extension().is_some_and(|extension| extension == "raw"))
            .unwrap();
        assert_eq!(fs::read(raw).unwrap(), bytes);
    }
}
#[test]
fn failed_backup_write_and_invalid_import_preserve_primary() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    store::save_entry(&path, entry("EVmock00001", "원본")).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(store::import(&path, r#"{"version":99,"entries":[]}"#).is_err());
    fs::remove_file(path.with_extension("backup.json")).unwrap();
    fs::create_dir(path.with_extension("backup.json")).unwrap();
    assert!(store::save_entry(&path, entry("EVmock00002", "신규")).is_err());
    assert_eq!(fs::read(path).unwrap(), before);
}
#[test]
fn malformed_secret_unknown_version_and_duplicates_rejected() {
    assert!(parse(r#"{"version":2,"entries":[],"accessToken":"secret"}"#).is_err());
    assert!(parse(r#"{"version":1,"entries":[]}"#).is_err());
    let duplicate = Library {
        version: 2,
        entries: vec![entry("EVmock00001", ""), entry("EVmock00001", "")],
    };
    assert!(parse(&serde_json::to_string(&duplicate).unwrap()).is_err());
    let mut json = serde_json::to_value(Library {
        version: 2,
        entries: vec![entry("EVmock00001", "")],
    })
    .unwrap();
    json["entries"][0]["teacher"]["accessToken"] = serde_json::json!("secret");
    assert!(parse(&json.to_string()).is_err());
}
#[test]
fn expired_quarantine_cleanup_only_touches_own_receipted_uuid_files() {
    let dir = tempfile::tempdir().unwrap();
    let q = dir.path().join("quarantine");
    fs::create_dir(&q).unwrap();
    let id = uuid::Uuid::new_v4();
    let raw = q.join(format!("{id}.raw"));
    let receipt = q.join(format!("{id}.retention.json"));
    fs::write(&raw, b"corrupt fixture").unwrap();
    fs::write(
        &receipt,
        format!("{{\"delete_after\":{}}}", timestamps::now_ms().unwrap() - 1),
    )
    .unwrap();
    fs::write(q.join("unrelated.raw"), b"keep").unwrap();
    retention::cleanup(dir.path(), timestamps::now_ms().unwrap()).unwrap();
    assert!(!raw.exists());
    assert!(!receipt.exists());
    assert!(q.join("unrelated.raw").exists());
}

#[test]
fn valid_primary_remains_usable_with_binary_or_oversized_backup() {
    for damage in [vec![0xff, 0xfe], vec![b'x'; MAX_BYTES + 1]] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.json");
        store::save_entry(&path, entry("EVmock00001", "원본 메모")).unwrap();
        fs::write(path.with_extension("backup.json"), damage).unwrap();
        let loaded = store::load(&path).unwrap();
        assert_eq!(loaded.library.entries[0].teacher.notes, "원본 메모");
        assert!(parse(&fs::read_to_string(path.with_extension("backup.json")).unwrap()).is_ok());
    }
}

#[test]
fn teacher_only_import_cannot_delete_fresh_metadata() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    let now = timestamps::now_ms().unwrap();
    let mut item = entry("EVmock00001", "메모 유지");
    item.provider = Some(ProviderMetadata {
        title: "fresh-provider-sentinel".into(),
        channel_id: "channel".into(),
        channel_title: "채널".into(),
        duration_seconds: None,
        url: "https://www.youtube.com/watch?v=EVmock00001".into(),
        source: VideoSource::Live,
        official: false,
        official_evidence: None,
        synthetic: false,
        fetched_at: timestamps::format_iso(now),
        expires_at: timestamps::format_iso(now + timestamps::MAX_TTL_MS),
    });
    store::save_entry(&path, item).unwrap();
    let incoming = Library {
        version: 2,
        entries: vec![entry("EVmock00001", "다른 메모")],
    };
    let loaded = store::import(&path, &serde_json::to_string(&incoming).unwrap()).unwrap();
    assert!(loaded.library.entries[0].provider.is_some());
    assert_eq!(loaded.library.entries[0].teacher.notes, "메모 유지");
}

#[test]
fn damaged_quarantine_receipt_cannot_block_valid_primary_or_delete_ambiguous_raw() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    store::save_entry(&path, entry("EVmock00001", "안전한 원본")).unwrap();
    let q = dir.path().join("quarantine");
    fs::create_dir(&q).unwrap();
    let id = uuid::Uuid::new_v4();
    let raw = q.join(format!("{id}.raw"));
    let receipt = q.join(format!("{id}.retention.json"));
    fs::write(&raw, b"ambiguous recovery bytes").unwrap();
    fs::write(&receipt, b"damaged receipt").unwrap();
    let loaded = store::load(&path).unwrap();
    assert_eq!(loaded.library.entries[0].teacher.notes, "안전한 원본");
    assert!(raw.exists());
    assert!(receipt.exists());
}
