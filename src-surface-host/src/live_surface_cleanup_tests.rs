use super::{release_in_order, CleanupOperations};

struct ObservedRelease {
    calls: Vec<&'static str>,
    reject: Option<&'static str>,
}

impl ObservedRelease {
    fn operation(&mut self, name: &'static str) -> bool {
        self.calls.push(name);
        self.reject != Some(name)
    }
}

impl CleanupOperations for ObservedRelease {
    fn controller(&mut self) -> bool {
        self.operation("controller")
    }
    fn window(&mut self) -> bool {
        self.operation("window")
    }
    fn browser_exit(&mut self) -> bool {
        self.operation("browser_exit")
    }
    fn subscription(&mut self) -> bool {
        self.operation("subscription")
    }
    fn environment(&mut self) -> bool {
        self.operation("environment")
    }
}

#[test]
fn releases_each_owned_resource_in_order_when_validation_fails() {
    // Given a completed controller whose UDF admission was rejected.
    let mut observed = ObservedRelease {
        calls: Vec::new(),
        reject: None,
    };
    // When the actual failure cleanup orchestrator runs.
    let released = release_in_order(&mut observed);
    // Then all local release operations run; this is not a cleanup receipt.
    assert!(released);
    assert_eq!(
        observed.calls,
        [
            "controller",
            "window",
            "browser_exit",
            "subscription",
            "environment"
        ]
    );
}

#[test]
fn attempts_remaining_owned_releases_when_any_operation_fails() {
    for rejected in [
        "controller",
        "window",
        "browser_exit",
        "subscription",
        "environment",
    ] {
        // Given one unconfirmed native release.
        let mut observed = ObservedRelease {
            calls: Vec::new(),
            reject: Some(rejected),
        };
        // When cleanup encounters the failure.
        let released = release_in_order(&mut observed);
        // Then later releases are still attempted and no complete release is claimed.
        assert!(!released);
        assert_eq!(
            observed.calls,
            [
                "controller",
                "window",
                "browser_exit",
                "subscription",
                "environment"
            ]
        );
    }
}

struct EmptyFixture(std::path::PathBuf);

impl EmptyFixture {
    fn fresh() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(1);
        let path = std::env::temp_dir().join(format!(
            "bogunon-desktop-surface-qa-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
        ));
        assert!(
            !path.exists(),
            "fixture must never adopt an existing directory"
        );
        Self(path)
    }
}

impl Drop for EmptyFixture {
    fn drop(&mut self) {
        // Only empty directories this test created are removed, never recursive data.
        if self.0.exists() {
            std::fs::remove_dir(&self.0)
                .unwrap_or_else(|_| panic!("empty synthetic fixture must be removable"));
        }
    }
}

#[test]
fn refuses_preexisting_qa_directory_instead_of_adopting_its_identity() {
    // Given an empty synthetic directory owned by another creation request.
    let fixture = EmptyFixture::fresh();
    assert!(std::fs::create_dir(&fixture.0).is_ok());
    // When the live-path creator receives the same directory.
    let result = super::super::create_owned_qa_udf(&fixture.0);
    // Then the collision is rejected without modifying the existing directory.
    assert!(matches!(result, Err(super::LiveSurfaceError::InvalidPath)));
    assert!(fixture.0.is_dir());
}

#[test]
fn removal_guard_accepts_only_the_original_fresh_directory_identity() {
    // Given a freshly created direct child of the test process TEMP.
    let fixture = EmptyFixture::fresh();
    let owned = super::super::create_owned_qa_udf(&fixture.0)
        .unwrap_or_else(|_| panic!("synthetic fixture must be created"));
    // When the actual removal guard checks the recorded identity.
    let result = super::verify_removal_root(&fixture.0, &owned);
    // Then it permits the owned root without deleting it.
    assert!(result.is_ok());
    assert!(fixture.0.is_dir());
}

#[test]
fn removal_guard_rejects_a_substituted_directory_identity() {
    // Given a real synthetic directory with a deliberately wrong ownership claim.
    let fixture = EmptyFixture::fresh();
    let mut owned = super::super::create_owned_qa_udf(&fixture.0)
        .unwrap_or_else(|_| panic!("synthetic fixture must be created"));
    owned.identity.file ^= 1;
    // When removal checks the current on-disk identity.
    let result = super::verify_removal_root(&fixture.0, &owned);
    // Then identity mismatch denies removal and preserves the root.
    assert!(matches!(
        result,
        Err(super::LiveSurfaceError::TemporaryCleanup)
    ));
    assert!(fixture.0.is_dir());
}

#[test]
fn failed_udf_admission_never_promotes_local_release_into_a_receipt() {
    use crate::{
        diagnostic::{CleanupStatus, FailureCode},
        udf::UdfError,
    };
    for local_release_complete in [false, true] {
        // Given rejected profile admission, with either local release outcome.
        let failure = super::LiveSurfaceError::Udf {
            source: UdfError::ProfileOutsideUdf,
            cleanup: CleanupStatus::Unknown,
            local_release_complete,
        };
        // When the real error is classified for the persisted diagnostic.
        let classification = (failure.failure_code(), failure.cleanup_status());
        // Then the original UDF reason and unknown cleanup remain distinct.
        assert_eq!(
            classification,
            (FailureCode::UdfProfileOutside, CleanupStatus::Unknown)
        );
    }
}
