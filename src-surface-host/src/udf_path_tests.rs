use super::*;
use std::{
    fs,
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT: AtomicU64 = AtomicU64::new(0);

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "bogunon-s2h19-synthetic-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        fs::create_dir(path.join("QA space")).unwrap();
        fs::create_dir(path.join("QA space").join("Default")).unwrap();
        Self(path)
    }

    fn observation(&self) -> DirectoryObservation {
        DirectoryObservation {
            path: self.0.join("QA space").canonicalize().unwrap(),
            identity: crate::runtime_identity::directory_identity(&self.0.join("QA space"))
                .unwrap(),
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn canonical_udf_accepts_the_existing_plain_profile_path() {
    // Given canonical requested/effective UDF and an ordinary API-style profile path.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    let profile = fixture.0.join("QA space").join("Default");
    // When the on-disk admission boundary verifies the profile.
    let result = verify_effective_on_disk(&observed, &observed, &profile);
    // Then Windows extended-length prefixes do not reject the same directory.
    assert_eq!(result, Ok(()));
}

#[test]
fn profile_case_and_forward_separators_resolve_to_the_same_directory() {
    // Given a real profile with spaces and canonical UDF identity.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    let profile = fixture.0.join("QA space").join("Default");
    let alternate = profile.to_str().unwrap().to_uppercase().replace('\\', "/");
    // When Windows resolves the alternate representation.
    let result = verify_effective_on_disk(&observed, &observed, Path::new(&alternate));
    // Then directory admission is unchanged.
    assert_eq!(result, Ok(()));
}

#[test]
fn different_directory_identity_is_rejected_even_for_matching_path_text() {
    // Given matching path text but a different volume/file ownership identity.
    let fixture = Fixture::new();
    let requested = fixture.observation();
    let mut effective = requested.clone();
    effective.identity.file ^= 1;
    // When effective UDF is verified.
    let result =
        verify_effective_on_disk(&requested, &effective, &fixture.0.join("QA space/Default"));
    // Then textual equality cannot replace ownership evidence.
    assert_eq!(result, Err(UdfError::EffectiveMismatch));
}

#[test]
fn another_existing_effective_directory_is_rejected() {
    // Given two distinct synthetic UDFs and their real file identities.
    let fixture = Fixture::new();
    let other = Fixture::new();
    // When a different effective UDF is observed.
    let result = verify_effective_on_disk(
        &fixture.observation(),
        &other.observation(),
        &other.0.join("QA space/Default"),
    );
    // Then admission fails.
    assert_eq!(result, Err(UdfError::EffectiveMismatch));
}

#[test]
fn existing_profile_outside_the_effective_udf_is_rejected() {
    // Given an existing profile in another independently created synthetic directory.
    let fixture = Fixture::new();
    let other = Fixture::new();
    let observed = fixture.observation();
    // When the profile is resolved outside the UDF.
    let result = verify_effective_on_disk(&observed, &observed, &other.0.join("QA space/Default"));
    // Then the canonical containment check rejects it.
    assert_eq!(result, Err(UdfError::ProfileOutsideUdf));
}

#[test]
fn udf_root_itself_is_not_a_profile() {
    // Given the UDF root rather than a dedicated descendant profile.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    // When it is presented as the profile.
    let result = verify_effective_on_disk(&observed, &observed, &observed.path);
    // Then admission fails.
    assert_eq!(result, Err(UdfError::ProfileOutsideUdf));
}

#[test]
fn missing_profile_observation_fails_closed() {
    // Given a nonexistent profile; no WebView2 or operating data is involved.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    // When canonicalization cannot resolve it.
    let result =
        verify_effective_on_disk(&observed, &observed, &fixture.0.join("QA space/missing"));
    // Then an observation error is distinct from a proven outside profile.
    assert_eq!(result, Err(UdfError::ObservationFailed));
}

#[test]
fn relative_profile_is_rejected_before_filesystem_resolution() {
    // Given a valid UDF and a relative profile input.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    // When the API boundary validates it.
    let result = verify_effective_on_disk(&observed, &observed, Path::new("Default"));
    // Then working-directory resolution is never trusted.
    assert_eq!(result, Err(UdfError::InvalidPath));
}

#[test]
fn parent_traversal_profile_is_rejected_before_resolution() {
    // Given an input containing a parent component.
    let fixture = Fixture::new();
    let observed = fixture.observation();
    // When verification runs.
    let result = verify_effective_on_disk(
        &observed,
        &observed,
        &fixture.0.join("QA space/../QA space/Default"),
    );
    // Then traversal is rejected rather than normalized into admission.
    assert_eq!(result, Err(UdfError::InvalidPath));
}
