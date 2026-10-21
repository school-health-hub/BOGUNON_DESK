use super::{model::*, store::*};
use std::fs;

fn item(id: &str, notes: &str) -> LibraryItem {
    LibraryItem {
        video_id: id.into(),
        title: "합성 교육영상".into(),
        channel_id: "mock-channel".into(),
        channel_title: "합성 채널".into(),
        duration_seconds: 600,
        url: format!("https://www.youtube.com/watch?v={id}"),
        source: VideoSource::Mock,
        education_title: "교육".into(),
        target: "학생".into(),
        schedule: "2026-10-21".into(),
        instructions: String::new(),
        message: "교사 확인 문구".into(),
        notes: notes.into(),
    }
}

#[test]
fn save_roundtrip_and_import_preserves_teacher_notes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "교사 메모")).unwrap();
    let incoming = Library {
        version: 1,
        items: vec![
            item("EVmock00001", "가져온 메모"),
            item("EVmock00002", "새 메모"),
        ],
    };
    let result = import(&path, &serde_json::to_string(&incoming).unwrap()).unwrap();
    assert_eq!(result.library.items.len(), 2);
    assert_eq!(result.library.items[0].notes, "교사 메모");
    assert_eq!(load(&path).unwrap().library, result.library);
}

#[test]
fn corrupt_primary_recovers_backup_without_overwriting_corrupt_evidence() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "first")).unwrap();
    save_item(&path, item("EVmock00002", "second")).unwrap();
    fs::write(&path, "broken JSON").unwrap();
    let result = load(&path).unwrap();
    assert!(result.recovered);
    assert_eq!(result.library.items.len(), 1);
    assert_eq!(
        fs::read_to_string(path.with_extension("corrupt.json")).unwrap(),
        "broken JSON"
    );
}

#[test]
fn invalid_import_and_failed_commit_leave_existing_primary_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "keep")).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(import(&path, r#"{"version":99,"items":[]}"#).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::remove_file(path.with_extension("backup.json")).unwrap();
    fs::create_dir(path.with_extension("backup.json")).unwrap();
    assert!(save_item(&path, item("EVmock00002", "new")).is_err());
    assert_eq!(fs::read(path).unwrap(), before);
}

#[test]
fn malformed_unknown_secret_fields_duplicates_and_unsafe_urls_are_rejected() {
    assert!(parse(r#"{"version":1,"items":[],"accessToken":"secret"}"#).is_err());
    assert!(parse("broken").is_err());
    let mut entry = item("EVmock00001", "");
    entry.url = "https://www.youtube.com.evil.example/watch?v=EVmock00001".into();
    assert!(entry.validate().is_err());
    let duplicate = Library {
        version: 1,
        items: vec![item("EVmock00001", ""), item("EVmock00001", "")],
    };
    assert!(parse(&serde_json::to_string(&duplicate).unwrap()).is_err());
}

#[test]
fn binary_and_oversized_primary_recover_from_valid_backup() {
    for damaged in [vec![0xff, 0xfe], vec![b'x'; MAX_BYTES + 1]] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("library.json");
        save_item(&path, item("EVmock00001", "first")).unwrap();
        save_item(&path, item("EVmock00002", "second")).unwrap();
        fs::write(&path, &damaged).unwrap();
        let result = load(&path).unwrap();
        assert!(result.recovered);
        assert_eq!(result.library.items.len(), 1);
        assert_eq!(
            fs::read(path.with_extension("corrupt.json")).unwrap(),
            damaged
        );
    }
}

#[test]
fn explicit_save_replaces_notes_and_message_without_duplicate_entries() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "before")).unwrap();
    let result = save_item(&path, item("EVmock00001", "teacher edited")).unwrap();
    assert_eq!(result.library.items.len(), 1);
    assert_eq!(result.library.items[0].notes, "teacher edited");
}

#[test]
fn first_saved_library_has_recoverable_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "first")).unwrap();
    fs::write(&path, "truncated").unwrap();
    let result = load(&path).unwrap();
    assert!(result.recovered);
    assert_eq!(result.library.items[0].notes, "first");
}

#[test]
fn export_roundtrips_only_allowed_library_fields() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    save_item(&path, item("EVmock00001", "teacher notes")).unwrap();
    let json = export(&path).unwrap();
    assert_eq!(parse(&json).unwrap().items[0].notes, "teacher notes");
    let mut value: serde_json::Value = serde_json::from_str(&json).unwrap();
    value["items"][0]["accessToken"] = serde_json::json!("not-allowed");
    assert!(parse(&serde_json::to_string(&value).unwrap()).is_err());
}

#[test]
fn both_corrupt_files_are_preserved_and_no_empty_library_is_fabricated() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("library.json");
    fs::write(&path, "broken primary").unwrap();
    fs::write(path.with_extension("backup.json"), "broken backup").unwrap();
    assert!(load(&path).is_err());
    assert_eq!(fs::read_to_string(path).unwrap(), "broken primary");
}
