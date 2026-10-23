use std::fs;

use serde_json::{json, Value};
use tempfile::tempdir;

use super::super::validation::{canonical_hash, parse_document};
use super::{NewsletterRepository, RepositoryError};

fn project(id: &str, revision: u64, text: &str) -> Value {
    let topics = (1..=6)
        .map(|index| json!({"id": format!("topic-{index}"), "title": format!("Topic {index}")}))
        .collect::<Vec<_>>();
    let sections = (1..=6).map(|index| {
        let ai = json!({"text": format!("{text}-{index}"), "generatedAt": "2026-01-01T00:00:00.000Z"});
        json!({"id": format!("section-{index}"), "topicId": format!("topic-{index}"), "aiGenerated": ai, "revision": revision, "semanticHash": canonical_hash(&ai)})
    }).collect::<Vec<_>>();
    let canonical = json!({"sections": sections});
    let history = (1..=revision)
        .map(|entry_revision| {
            json!({
                "revision": entry_revision,
                "createdAt": "2026-01-01T00:00:00.000Z",
                "changedSectionIds": [],
                "snapshot": canonical
            })
        })
        .collect::<Vec<_>>();
    let cards = std::iter::once(json!({"kind": "cover", "title": "Cover"})).chain((1..=6).map(|index| json!({"kind": "topic", "topicId": format!("topic-{index}"), "sectionRef": format!("section-{index}")}))).collect::<Vec<_>>();
    json!({
        "schemaVersion": 1,
        "projectId": id,
        "title": "Synthetic",
        "projectRevision": revision,
        "topics": topics,
        "canonicalCopy": canonical,
        "a4Layout": {"sectionRefs": (1..=6).map(|index| format!("section-{index}")).collect::<Vec<_>>()},
        "cardLayouts": cards,
        "revisionHistory": history,
        "outputHistory": []
    })
}

fn advance(mut previous: Value, text: &str) -> Value {
    let revision = previous["projectRevision"].as_u64().expect("revision") + 1;
    let sections = previous["canonicalCopy"]["sections"]
        .as_array_mut()
        .expect("sections");
    for (index, section) in sections.iter_mut().enumerate() {
        let ai = json!({"text": format!("{text}-{}", index + 1), "generatedAt": "2026-01-02T00:00:00.000Z"});
        section["aiGenerated"] = ai.clone();
        section["revision"] = Value::from(revision);
        section["semanticHash"] = Value::from(canonical_hash(&ai));
    }
    previous["projectRevision"] = Value::from(revision);
    let snapshot = previous["canonicalCopy"].clone();
    previous["revisionHistory"].as_array_mut().expect("history").push(json!({
        "revision": revision, "createdAt": "2026-01-02T00:00:00.000Z",
        "changedSectionIds": (1..=6).map(|index| format!("section-{index}")).collect::<Vec<_>>(),
        "snapshot": snapshot
    }));
    previous
}

fn stored_bytes(value: Value) -> Vec<u8> {
    serde_json::to_vec_pretty(&parse_document(value).expect("valid stored project"))
        .expect("stored bytes")
}

#[test]
fn lifecycle_when_project_is_created_saved_restored_and_cloned() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());

    // When
    let first = project("spring-news", 1, "first");
    let created = repository.create(first.clone()).expect("create");
    let saved = repository.save(advance(first, "second")).expect("save");
    let restored = repository
        .restore("spring-news", 1, "2026-02-01T00:00:00.000Z")
        .expect("restore");
    let cloned = repository
        .clone_project("spring-news", "spring-copy", "2026-02-02T00:00:00.000Z")
        .expect("clone");

    // Then
    assert_eq!(created.project_revision, 1);
    assert_eq!(saved.project_revision, 2);
    assert_eq!(restored.project_revision, 3);
    assert_eq!(
        restored.fields["canonicalCopy"]["sections"][0]["aiGenerated"]["text"],
        "first-1"
    );
    assert_eq!(cloned.project_id, "spring-copy");
    assert_eq!(cloned.project_revision, 1);
    assert_eq!(
        cloned.fields["cloneProvenance"]["sourceProjectId"],
        "spring-news"
    );
    assert_eq!(
        restored.fields["revisionHistory"][2]["createdAt"],
        "2026-02-01T00:00:00.000Z"
    );
    assert_eq!(
        restored.fields["revisionHistory"][2]["changedSectionIds"]
            .as_array()
            .expect("restore IDs")
            .len(),
        6
    );
    assert_eq!(
        cloned.fields["revisionHistory"][0]["createdAt"],
        "2026-02-02T00:00:00.000Z"
    );
    assert_eq!(
        cloned.fields["revisionHistory"][0]["changedSectionIds"]
            .as_array()
            .expect("clone IDs")
            .len(),
        6
    );
    assert_eq!(
        repository
            .history("spring-news")
            .expect("history")
            .as_array()
            .expect("history array")
            .len(),
        3
    );
}

#[test]
fn get_recovers_when_current_is_corrupted() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    repository
        .create(project("recovery", 1, "safe"))
        .expect("create");
    let current = root.path().join("projects/recovery/current.json");
    fs::write(&current, b"{private-student-data").expect("corrupt current");

    // When
    let recovered = repository.get("recovery").expect("recover");

    // Then
    assert_eq!(recovered.project_revision, 1);
    assert_eq!(
        fs::read(&current).expect("original bytes"),
        b"{private-student-data"
    );
    let quarantined = fs::read_dir(root.path().join("projects/recovery/quarantine"))
        .expect("quarantine")
        .count();
    assert_eq!(quarantined, 1);
}

#[test]
fn get_recovers_when_current_has_semantic_hash_corruption() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    repository
        .create(project("semantic", 1, "safe"))
        .expect("create");
    let current = root.path().join("projects/semantic/current.json");
    let mut corrupted: Value =
        serde_json::from_slice(&fs::read(&current).expect("current")).expect("json");
    corrupted["canonicalCopy"]["sections"][0]["semanticHash"] = Value::from("0".repeat(64));
    let corrupted_bytes = serde_json::to_vec_pretty(&corrupted).expect("encode corruption");
    fs::write(&current, &corrupted_bytes).expect("write corruption");

    // When
    let recovered = repository
        .get("semantic")
        .expect("recover semantic corruption");

    // Then
    assert_eq!(recovered.project_revision, 1);
    assert_eq!(
        fs::read(current).expect("corrupt retained"),
        corrupted_bytes
    );
}

#[test]
fn traversal_and_future_versions_are_rejected_without_path_disclosure() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());

    // When
    let traversal = repository
        .create(project("../outside", 1, "x"))
        .expect_err("reject traversal");
    let future = repository
        .create(json!({"schemaVersion": 2, "projectId": "future", "revision": 1}))
        .expect_err("reject future");

    // Then
    assert_eq!(traversal, RepositoryError::InvalidProject);
    assert_eq!(future, RepositoryError::UnsupportedVersion);
    assert!(!traversal
        .to_string()
        .contains(root.path().to_string_lossy().as_ref()));
    assert!(!root.path().join("outside").exists());
}

#[test]
fn malformed_and_stale_documents_do_not_replace_last_good_bytes() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    repository
        .create(project("stable", 1, "safe"))
        .expect("create");
    let current = root.path().join("projects/stable/current.json");
    let before = fs::read(&current).expect("read current");

    // When
    let malformed = repository.save(json!({"schemaVersion": 1, "projectId": "stable"}));
    let stale = repository.save(project("stable", 1, "overwrite"));

    // Then
    assert_eq!(
        malformed.expect_err("malformed"),
        RepositoryError::InvalidProject
    );
    assert_eq!(stale.expect_err("stale"), RepositoryError::Conflict);
    assert_eq!(fs::read(current).expect("current unchanged"), before);
}

#[test]
fn interrupted_current_write_preserves_last_known_good_and_allows_retry() {
    // Given
    let root = tempdir().expect("temporary repository");
    let setup = NewsletterRepository::new(root.path());
    let baseline = project("interrupted", 1, "safe");
    setup.create(baseline.clone()).expect("create");
    let repository = NewsletterRepository::with_current_write_failure(root.path());
    let directory = root.path().join("projects/interrupted");
    let current = directory.join("current.json");
    let last_known_good = directory.join("last-known-good.json");
    let safe_bytes = fs::read(&last_known_good).expect("last known good");
    let current_before = fs::read(&current).expect("current before");

    // When
    let retry = advance(baseline, "unsafe");
    let result = repository.save(retry.clone());

    // Then
    assert_eq!(
        result.expect_err("write must fail"),
        RepositoryError::Unavailable
    );
    assert_eq!(fs::read(last_known_good).expect("preserved"), safe_bytes);
    assert_eq!(
        fs::read(&current).expect("current preserved"),
        current_before
    );
    assert!(!directory.join("revisions/2.json").exists());
    NewsletterRepository::new(root.path())
        .save(retry)
        .expect("retry");
}

#[test]
fn failed_last_known_good_write_leaves_current_and_revision_retryable() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let baseline = project("lkg-failure", 1, "safe");
    repository.create(baseline.clone()).expect("create");
    let directory = root.path().join("projects/lkg-failure");
    let current = directory.join("current.json");
    let last_known_good = directory.join("last-known-good.json");
    let current_before = fs::read(&current).expect("current before");
    fs::remove_file(&last_known_good).expect("remove backup");
    fs::create_dir(&last_known_good).expect("block backup write");

    // When
    let retry = advance(baseline, "new");
    let result = repository.save(retry.clone());

    // Then
    assert_eq!(
        result.expect_err("LKG failure"),
        RepositoryError::Unavailable
    );
    assert_eq!(
        fs::read(current).expect("current unchanged"),
        current_before
    );
    assert!(!directory.join("revisions/2.json").exists());
    fs::remove_dir(last_known_good).expect("remove blocking directory");
    repository.save(retry).expect("retry after LKG repair");
}

#[test]
fn both_corrupt_snapshots_fail_without_overwriting_either() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    repository
        .create(project("both-corrupt", 1, "safe"))
        .expect("create");
    let directory = root.path().join("projects/both-corrupt");
    let current = directory.join("current.json");
    let last_known_good = directory.join("last-known-good.json");
    fs::write(&current, b"current-corrupt").expect("corrupt current");
    fs::write(&last_known_good, b"backup-corrupt").expect("corrupt backup");

    // When
    let result = repository.get("both-corrupt");

    // Then
    assert_eq!(
        result.expect_err("both corrupt"),
        RepositoryError::Corrupted
    );
    assert_eq!(
        fs::read(current).expect("current retained"),
        b"current-corrupt"
    );
    assert_eq!(
        fs::read(last_known_good).expect("backup retained"),
        b"backup-corrupt"
    );
}

#[test]
fn separator_and_encoded_separator_project_ids_are_rejected() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());

    // When
    let results =
        ["/absolute", "C:\\absolute", "a/b", "a\\b", "a%2fb", "a%5Cb"].map(|id| repository.get(id));

    // Then
    assert!(results
        .into_iter()
        .all(|result| result.expect_err("invalid id") == RepositoryError::InvalidProject));
}

#[test]
fn schema_invariants_reject_counts_ids_layouts_outputs_and_snapshots() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let mut invalid = Vec::new();
    let mut wrong_count = project("wrong-count", 1, "x");
    wrong_count["topics"].as_array_mut().expect("topics").pop();
    invalid.push(wrong_count);
    let mut duplicate = project("duplicate", 1, "x");
    duplicate["topics"][1]["id"] = duplicate["topics"][0]["id"].clone();
    invalid.push(duplicate);
    let mut card = project("bad-card", 1, "x");
    card["cardLayouts"][1]["sectionRef"] = Value::from("section-6");
    invalid.push(card);
    let mut a4 = project("bad-a4", 1, "x");
    a4["a4Layout"]["sectionRefs"][0] = Value::from("section-6");
    invalid.push(a4);
    let mut output = project("bad-output", 1, "x");
    output["outputHistory"] = json!([{"projectRevision": 2}]);
    invalid.push(output);
    let mut snapshot = project("bad-snapshot", 1, "x");
    snapshot["revisionHistory"][0]["snapshot"]["sections"][0]["semanticHash"] =
        Value::from("0".repeat(64));
    invalid.push(snapshot);
    let mut title = project("bad-title", 1, "x");
    title["title"] = Value::from("   ");
    invalid.push(title);
    let mut topic_title = project("bad-topic-title", 1, "x");
    topic_title["topics"][0]["title"] = Value::from("");
    invalid.push(topic_title);
    let mut cover_title = project("bad-cover-title", 1, "x");
    cover_title["cardLayouts"][0]["title"] = Value::from(" ");
    invalid.push(cover_title);
    let mut date = project("bad-date", 1, "x");
    date["canonicalCopy"]["sections"][0]["aiGenerated"]["generatedAt"] = Value::from("yesterday");
    invalid.push(date);
    let mut output_fields = project("bad-output-fields", 1, "x");
    output_fields["outputHistory"] =
        json!([{"id":"Output_ID","projectRevision":1,"format":"pdf","createdAt":"never"}]);
    invalid.push(output_fields);

    // When
    let results = invalid.into_iter().map(|value| repository.create(value));

    // Then
    assert!(results
        .into_iter()
        .all(|result| result.expect_err("invalid schema") == RepositoryError::InvalidProject));
}

#[test]
fn clone_and_restore_reject_invalid_timestamps_before_writing() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let baseline = project("timestamp", 1, "one");
    repository.create(baseline.clone()).expect("create");
    repository.save(advance(baseline, "two")).expect("save");

    // When
    let clone = repository.clone_project("timestamp", "timestamp-copy", "not-a-date");
    let restore = repository.restore("timestamp", 1, "not-a-date");

    // Then
    assert_eq!(
        clone.expect_err("clone timestamp"),
        RepositoryError::InvalidProject
    );
    assert_eq!(
        restore.expect_err("restore timestamp"),
        RepositoryError::InvalidProject
    );
    assert!(!root.path().join("projects/timestamp-copy").exists());
    assert_eq!(
        repository
            .get("timestamp")
            .expect("unchanged")
            .project_revision,
        2
    );
}

#[test]
fn restored_from_revision_requires_positive_earlier_integer_when_present() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let invalid_values = [
        Value::String("1".to_owned()),
        Value::from(-1),
        Value::Null,
        json!([]),
        json!({}),
        Value::from(0),
        Value::from(2),
    ];

    // When
    let results = invalid_values
        .into_iter()
        .enumerate()
        .map(|(index, invalid)| {
            let id = format!("invalid-restore-{index}");
            let baseline = project(&id, 1, "x");
            repository.create(baseline.clone()).expect("baseline");
            let mut value = advance(baseline, "y");
            value["revisionHistory"][1]["restoredFromRevision"] = invalid;
            repository.save(value)
        });

    // Then
    assert!(results
        .into_iter()
        .all(|result| result.expect_err("invalid restoredFromRevision")
            == RepositoryError::InvalidProject));
    let baseline = project("valid-restore", 1, "x");
    repository.create(baseline.clone()).expect("valid baseline");
    let mut valid = advance(baseline, "y");
    valid["revisionHistory"][1]["restoredFromRevision"] = Value::from(1);
    assert_eq!(
        repository
            .save(valid)
            .expect("valid earlier revision")
            .project_revision,
        2
    );
}

#[test]
fn restart_quarantines_revision_only_prepare_and_allows_same_revision_retry() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let baseline = project("restart-orphan", 1, "one");
    repository.create(baseline.clone()).expect("create");
    let next = advance(baseline, "two");
    let directory = root.path().join("projects/restart-orphan");
    fs::write(
        directory.join("revisions/2.json"),
        stored_bytes(next.clone()),
    )
    .expect("simulate revision boundary");

    // When
    let restarted = NewsletterRepository::new(root.path());
    let recovered = restarted.get("restart-orphan").expect("restart recovery");

    // Then
    assert_eq!(recovered.project_revision, 1);
    assert!(!directory.join("revisions/2.json").exists());
    assert_eq!(
        fs::read_dir(directory.join("quarantine"))
            .expect("prepared quarantine")
            .count(),
        1
    );
    assert_eq!(
        restarted
            .save(next)
            .expect("same revision retry")
            .project_revision,
        2
    );
}

#[test]
fn restart_promotes_matching_lkg_and_revision_after_second_boundary() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let baseline = project("restart-promote", 1, "one");
    repository.create(baseline.clone()).expect("create");
    let next = advance(baseline, "two");
    let bytes = stored_bytes(next.clone());
    let directory = root.path().join("projects/restart-promote");
    fs::write(directory.join("revisions/2.json"), &bytes).expect("revision boundary");
    fs::write(directory.join("last-known-good.json"), &bytes).expect("LKG boundary");

    // When
    let restarted = NewsletterRepository::new(root.path());
    let recovered = restarted.get("restart-promote").expect("promote LKG");

    // Then
    assert_eq!(recovered.project_revision, 2);
    assert_eq!(
        fs::read(directory.join("current.json")).expect("promoted current"),
        bytes
    );
    assert_eq!(
        restarted
            .save(advance(next, "three"))
            .expect("next save")
            .project_revision,
        3
    );
}

#[test]
fn restart_quarantines_initial_revision_prepare_and_allows_create_retry() {
    // Given
    let root = tempdir().expect("temporary repository");
    let value = project("initial-prepare", 1, "one");
    let directory = root.path().join("projects/initial-prepare");
    fs::create_dir_all(directory.join("revisions")).expect("revision directory");
    fs::write(
        directory.join("revisions/1.json"),
        stored_bytes(value.clone()),
    )
    .expect("simulate initial revision boundary");

    // When
    let restarted = NewsletterRepository::new(root.path());
    let created = restarted.create(value);

    // Then
    assert_eq!(created.expect("direct create retry").project_revision, 1);
    assert!(directory.join("revisions/1.json").exists());
    assert_eq!(
        fs::read_dir(directory.join("quarantine"))
            .expect("prepared quarantine")
            .count(),
        1
    );
}

#[test]
fn restart_promotes_initial_lkg_when_it_matches_revision() {
    // Given
    let root = tempdir().expect("temporary repository");
    let value = project("initial-promote", 1, "one");
    let bytes = stored_bytes(value);
    let directory = root.path().join("projects/initial-promote");
    fs::create_dir_all(directory.join("revisions")).expect("revision directory");
    fs::write(directory.join("revisions/1.json"), &bytes).expect("revision boundary");
    fs::write(directory.join("last-known-good.json"), &bytes).expect("LKG boundary");

    // When
    let restarted = NewsletterRepository::new(root.path());
    let result = restarted.create(project("initial-promote", 1, "one"));

    // Then
    assert_eq!(
        result.expect_err("already committed"),
        RepositoryError::Conflict
    );
    assert_eq!(
        fs::read(directory.join("current.json")).expect("current"),
        bytes
    );
    assert_eq!(
        restarted
            .get("initial-promote")
            .expect("promoted project")
            .project_revision,
        1
    );
}

#[test]
fn clone_resets_source_outputs_after_later_revision() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let baseline = project("output-source", 1, "one");
    repository.create(baseline.clone()).expect("create");
    let mut source = advance(baseline, "two");
    source["outputHistory"] = json!([{
        "id": "output-2",
        "format": "a4",
        "projectRevision": 2,
        "createdAt": "2026-10-23T01:00:00Z"
    }]);
    repository.save(source).expect("save output source");

    // When
    let cloned = repository
        .clone_project("output-source", "output-clone", "2026-10-23T02:00:00Z")
        .expect("clone");

    // Then
    assert_eq!(cloned.fields["outputHistory"], json!([]));
    assert_eq!(
        cloned.fields["cloneProvenance"],
        json!({"sourceProjectId": "output-source", "sourceRevision": 2})
    );
}

#[test]
fn clone_provenance_requires_exact_valid_shape() {
    // Given
    let root = tempdir().expect("temporary repository");
    let repository = NewsletterRepository::new(root.path());
    let invalid = [
        json!(null),
        json!({}),
        json!({"sourceProjectId": "../escape", "sourceRevision": 1}),
        json!({"sourceProjectId": "source", "sourceRevision": 0}),
        json!({"sourceProjectId": "source", "sourceRevision": "1"}),
        json!({"sourceProjectId": "source", "sourceRevision": 1, "extra": true}),
    ];

    // When
    let results = invalid.into_iter().enumerate().map(|(index, provenance)| {
        let mut value = project(&format!("provenance-{index}"), 1, "one");
        value["cloneProvenance"] = provenance;
        repository.create(value)
    });

    // Then
    assert!(results.into_iter().all(|result| {
        result.expect_err("invalid clone provenance") == RepositoryError::InvalidProject
    }));
}

#[cfg(windows)]
#[test]
fn planted_directory_symlink_is_rejected_without_following_it() {
    use std::os::windows::fs::symlink_dir;

    // Given
    let root = tempdir().expect("temporary repository");
    let outside = tempdir().expect("outside directory");
    fs::create_dir_all(root.path().join("projects")).expect("projects");
    fs::write(outside.path().join("sentinel.txt"), b"outside").expect("sentinel");
    if symlink_dir(outside.path(), root.path().join("projects/linked-project")).is_err() {
        return;
    }
    let repository = NewsletterRepository::new(root.path());

    // When
    let result = repository.get("linked-project");

    // Then
    assert_eq!(
        result.expect_err("reject reparse point"),
        RepositoryError::Unavailable
    );
    assert_eq!(
        fs::read(outside.path().join("sentinel.txt")).expect("outside untouched"),
        b"outside"
    );
    assert!(!outside.path().join("current.json").exists());
}

#[cfg(windows)]
#[test]
fn planted_storage_component_links_are_rejected() {
    use std::os::windows::fs::{symlink_dir, symlink_file};

    // Given
    let root = tempdir().expect("temporary repository");
    let outside = tempdir().expect("outside directory");
    let repository = NewsletterRepository::new(root.path());
    repository
        .create(project("linked-storage", 1, "one"))
        .expect("baseline");
    let directory = root.path().join("projects/linked-storage");
    fs::remove_dir_all(directory.join("revisions")).expect("remove revisions");
    if symlink_dir(outside.path(), directory.join("revisions")).is_err() {
        return;
    }

    // When
    let revisions_result = repository.get("linked-storage");
    fs::remove_dir(directory.join("revisions")).expect("remove revision link");
    if symlink_dir(outside.path(), directory.join("quarantine")).is_err() {
        return;
    }
    let quarantine_result = repository.get("linked-storage");
    fs::remove_dir(directory.join("quarantine")).expect("remove quarantine link");
    fs::write(outside.path().join("outside.json"), b"{}").expect("outside file");
    fs::remove_file(directory.join("current.json")).expect("remove current");
    if symlink_file(
        outside.path().join("outside.json"),
        directory.join("current.json"),
    )
    .is_err()
    {
        return;
    }
    let file_result = repository.get("linked-storage");

    // Then
    assert_eq!(
        revisions_result.expect_err("revision link"),
        RepositoryError::Unavailable
    );
    assert_eq!(
        quarantine_result.expect_err("quarantine link"),
        RepositoryError::Unavailable
    );
    assert_eq!(
        file_result.expect_err("file link"),
        RepositoryError::Unavailable
    );
    assert_eq!(
        fs::read(outside.path().join("outside.json")).expect("outside untouched"),
        b"{}"
    );
}
