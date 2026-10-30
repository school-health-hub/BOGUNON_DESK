use std::{fs, path::Path};

use super::save::{
    replace_validated, FilesystemStager, PlatformAtomicCommitter, Replacer, SaveError, SavePolicy,
    Stager,
};

struct FailingStager;
struct FailingReplacer;
struct FailingReplaceAndCleanup;

impl Stager for FailingStager {
    fn stage(&self, _parent: &Path, _bytes: &[u8]) -> Result<Vec<u8>, SaveError> {
        Err(SaveError::Stage)
    }
}

impl Replacer for FailingReplacer {
    fn replace(&self, _staged: &Path, _destination: &Path) -> Result<(), SaveError> {
        Err(SaveError::Commit)
    }

    fn cleanup_staged(&self, staged: &Path) -> Result<(), SaveError> {
        fs::remove_file(staged).map_err(|_| SaveError::Cleanup)
    }
}

impl Replacer for FailingReplaceAndCleanup {
    fn replace(&self, _staged: &Path, _destination: &Path) -> Result<(), SaveError> {
        Err(SaveError::Commit)
    }

    fn cleanup_staged(&self, _staged: &Path) -> Result<(), SaveError> {
        Err(SaveError::Cleanup)
    }
}

#[test]
fn save_creates_absent_destination_and_leaves_no_stage_file() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");

    save(&destination, b"synthetic", PlatformAtomicCommitter::new()).expect("save succeeds");

    assert_eq!(fs::read(&destination).expect("saved bytes"), b"synthetic");
    assert_eq!(entry_count(directory.path()), 1);
}

#[test]
fn save_replaces_existing_destination_with_platform_atomic_operation() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");
    fs::write(&destination, b"sentinel").expect("sentinel");

    save(&destination, b"replacement", PlatformAtomicCommitter::new())
        .expect("replacement succeeds");

    assert_eq!(fs::read(&destination).expect("saved bytes"), b"replacement");
    assert_eq!(entry_count(directory.path()), 1);
}

#[test]
fn validation_failure_preserves_existing_destination_and_removes_stage() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");
    fs::write(&destination, b"sentinel").expect("sentinel");

    let result = replace_validated(
        &destination,
        b"replacement",
        SavePolicy {
            stager: FilesystemStager,
            validate: |_: &[u8]| Err(SaveError::Validation),
            committer: PlatformAtomicCommitter::new(),
        },
    );

    assert_eq!(result, Err(SaveError::Validation));
    assert_preserved(directory.path(), &destination);
}

#[test]
fn replacement_failure_preserves_existing_destination_and_removes_stage() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");
    fs::write(&destination, b"sentinel").expect("sentinel");

    let result = save(
        &destination,
        b"replacement",
        PlatformAtomicCommitter::with_replacer(FailingReplacer),
    );

    assert_eq!(result, Err(SaveError::Commit));
    assert_preserved(directory.path(), &destination);
}

#[test]
fn stage_failure_preserves_existing_destination() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");
    fs::write(&destination, b"sentinel").expect("sentinel");

    let result = replace_validated(
        &destination,
        b"replacement",
        SavePolicy {
            stager: FailingStager,
            validate: |_: &[u8]| Ok(()),
            committer: PlatformAtomicCommitter::new(),
        },
    );

    assert_eq!(result, Err(SaveError::Stage));
    assert_preserved(directory.path(), &destination);
}

#[test]
fn replacement_and_cleanup_failure_surfaces_cleanup_error_and_preserves_destination() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let destination = directory.path().join("합성.odt");
    fs::write(&destination, b"sentinel").expect("sentinel");

    let result = save(
        &destination,
        b"replacement",
        PlatformAtomicCommitter::with_replacer(FailingReplaceAndCleanup),
    );

    assert_eq!(result, Err(SaveError::Cleanup));
    assert_eq!(
        fs::read(&destination).expect("sentinel remains"),
        b"sentinel"
    );
    assert_eq!(entry_count(directory.path()), 2);
}

fn save(
    destination: &Path,
    bytes: &[u8],
    committer: impl super::save::Committer,
) -> Result<(), SaveError> {
    replace_validated(
        destination,
        bytes,
        SavePolicy {
            stager: FilesystemStager,
            validate: |_: &[u8]| Ok(()),
            committer,
        },
    )
}

fn assert_preserved(directory: &Path, destination: &Path) {
    assert_eq!(
        fs::read(destination).expect("sentinel remains"),
        b"sentinel"
    );
    assert_eq!(entry_count(directory), 1);
}

fn entry_count(directory: &Path) -> usize {
    fs::read_dir(directory).expect("directory").count()
}
