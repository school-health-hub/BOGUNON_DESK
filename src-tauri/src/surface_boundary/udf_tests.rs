use super::{
    preflight_udf, AttemptBinding, DirectoryIdentity, EffectiveDirectory, EffectiveUdfObservation,
    EnvironmentObservation, IdentityToken, ObservedDirectory, OverrideObservation, PathKey,
    ProfileObservation, UdfError, UdfStatus,
};
use std::num::NonZeroU64;

fn path(value: &str) -> PathKey {
    PathKey::parse(value).unwrap()
}

fn directory(requested: &str, canonical: &str, identity: DirectoryIdentity) -> ObservedDirectory {
    ObservedDirectory::new(path(requested), path(canonical), identity)
}

fn binding() -> AttemptBinding {
    AttemptBinding::new(NonZeroU64::new(1).unwrap())
}

#[test]
fn main_and_surface_path_or_identity_overlap_is_rejected() {
    // Given Main and Surface observations that overlap by path or final identity.
    let main = directory(
        "C:/data/main",
        "C:/data/main",
        DirectoryIdentity::new(1, 10),
    );
    let nested = directory(
        "C:/data/main/surface",
        "C:/data/main/surface",
        DirectoryIdentity::new(1, 11),
    );
    let alias = directory("D:/surface", "D:/surface", DirectoryIdentity::new(1, 10));

    // When requested isolation is checked.
    let nested_result = preflight_udf(main.clone(), nested, OverrideObservation::Clear);
    let alias_result = preflight_udf(main, alias, OverrideObservation::Clear);

    // Then neither path containment nor filesystem identity aliasing is accepted.
    assert_eq!(nested_result.unwrap_err(), UdfError::DirectoryOverlap);
    assert_eq!(
        alias_result.unwrap_err(),
        UdfError::DirectoryIdentityConflict
    );
}

#[test]
fn override_or_unknown_override_state_is_rejected() {
    // Given otherwise separate Main and Surface directory observations.
    let main = directory(
        "C:/data/main",
        "C:/data/main",
        DirectoryIdentity::new(1, 10),
    );
    let surface = directory("D:/surface", "D:/surface", DirectoryIdentity::new(2, 20));

    // When each non-clear override observation is evaluated.
    let results = [
        OverrideObservation::Present,
        OverrideObservation::Unknown,
        OverrideObservation::Changed,
    ]
    .map(|state| preflight_udf(main.clone(), surface.clone(), state));

    // Then preflight fails closed for every override uncertainty.
    assert_eq!(results[0].as_ref().unwrap_err(), &UdfError::OverridePresent);
    assert_eq!(results[1].as_ref().unwrap_err(), &UdfError::OverrideUnknown);
    assert_eq!(results[2].as_ref().unwrap_err(), &UdfError::OverrideChanged);
}

#[test]
fn requested_isolation_stays_unverified_until_effective_observation_matches() {
    // Given a valid path-only preflight and a trusted attempt binding.
    let requested = preflight_udf(
        directory(
            "C:/data/main",
            "C:/data/main",
            DirectoryIdentity::new(1, 10),
        ),
        directory("D:/surface", "D:/surface", DirectoryIdentity::new(2, 20)),
        OverrideObservation::Clear,
    )
    .unwrap();
    let attempt = binding();
    let environment = IdentityToken::new();

    // When the effective WebView2 UDF differs from the canonical Surface path.
    let result = requested.verify(
        &attempt,
        EffectiveUdfObservation::new(
            EnvironmentObservation::new(environment.clone(), IdentityToken::new()),
            EffectiveDirectory::new(path("D:/unexpected"), DirectoryIdentity::new(2, 20)),
            ProfileObservation::new(path("D:/unexpected/profile"), environment),
        ),
    );
    let identity_environment = IdentityToken::new();
    let identity_result = requested.verify(
        &attempt,
        EffectiveUdfObservation::new(
            EnvironmentObservation::new(identity_environment.clone(), IdentityToken::new()),
            EffectiveDirectory::new(path("D:/surface"), DirectoryIdentity::new(9, 99)),
            ProfileObservation::new(path("D:/surface/profile/default"), identity_environment),
        ),
    );

    // Then preflight never upgrades itself and the mismatch is rejected.
    assert_eq!(requested.status(), UdfStatus::NotVerified);
    assert_eq!(result.unwrap_err(), UdfError::EffectivePathMismatch);
    assert_eq!(
        identity_result.unwrap_err(),
        UdfError::EffectiveIdentityMismatch
    );
}

#[test]
fn matching_effective_udf_profile_and_environment_issue_verified_isolation() {
    // Given separate canonical directories and matching effective WebView2 evidence.
    let requested = preflight_udf(
        directory(
            "C:/data/main",
            "C:/data/main",
            DirectoryIdentity::new(1, 10),
        ),
        directory("D:/surface", "D:/surface", DirectoryIdentity::new(2, 20)),
        OverrideObservation::Clear,
    )
    .unwrap();
    let attempt = binding();
    let environment = IdentityToken::new();
    let observation = EffectiveUdfObservation::new(
        EnvironmentObservation::new(environment.clone(), IdentityToken::new()),
        EffectiveDirectory::new(path("D:/surface"), DirectoryIdentity::new(2, 20)),
        ProfileObservation::new(path("D:/surface/profile/default"), environment),
    );

    // When the effective evidence is verified.
    let verified = requested.verify(&attempt, observation).unwrap();

    // Then the result is attempt-bound and explicitly verified.
    assert_eq!(verified.status(), UdfStatus::Verified);
    assert!(verified.binding_matches(&attempt));
}

#[test]
fn profile_from_another_environment_or_directory_is_rejected() {
    // Given valid configured isolation with two distinct environment identities.
    let requested = preflight_udf(
        directory(
            "C:/data/main",
            "C:/data/main",
            DirectoryIdentity::new(1, 10),
        ),
        directory("D:/surface", "D:/surface", DirectoryIdentity::new(2, 20)),
        OverrideObservation::Clear,
    )
    .unwrap();
    let environment = IdentityToken::new();
    let other = IdentityToken::new();

    // When the profile reports a foreign environment and a path outside Surface UDF.
    let environment_result = requested.verify(
        &binding(),
        EffectiveUdfObservation::new(
            EnvironmentObservation::new(environment.clone(), IdentityToken::new()),
            EffectiveDirectory::new(path("D:/surface"), DirectoryIdentity::new(2, 20)),
            ProfileObservation::new(path("D:/surface/profile/default"), other),
        ),
    );
    let path_result = requested.verify(
        &binding(),
        EffectiveUdfObservation::new(
            EnvironmentObservation::new(environment.clone(), IdentityToken::new()),
            EffectiveDirectory::new(path("D:/surface"), DirectoryIdentity::new(2, 20)),
            ProfileObservation::new(path("C:/profile/default"), environment),
        ),
    );

    // Then both observations remain unverified.
    assert_eq!(
        environment_result.unwrap_err(),
        UdfError::EnvironmentMismatch
    );
    assert_eq!(path_result.unwrap_err(), UdfError::ProfileOutsideSurface);
}
