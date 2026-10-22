use super::{
    evaluate_cleanup, preflight_udf, AttemptBinding, BrowserExitEvidence, CleanupDecision,
    CleanupUnknownReason, DirectoryIdentity, EffectiveDirectory, EffectiveUdfObservation,
    EnvironmentObservation, IdentityToken, Ledger, LedgerState, ObservedDirectory,
    OverrideObservation, PathKey, ProfileObservation, ResourceKind, VerifiedIsolation,
};
use std::num::NonZeroU64;

fn binding(generation: u64) -> AttemptBinding {
    AttemptBinding::new(NonZeroU64::new(generation).unwrap())
}

fn verified(
    attempt: &AttemptBinding,
    environment: &IdentityToken,
    browser_process: &IdentityToken,
) -> VerifiedIsolation {
    let main = ObservedDirectory::new(
        PathKey::parse("C:/data/main").unwrap(),
        PathKey::parse("C:/data/main").unwrap(),
        DirectoryIdentity::new(1, 10),
    );
    let surface = ObservedDirectory::new(
        PathKey::parse("D:/surface").unwrap(),
        PathKey::parse("D:/surface").unwrap(),
        DirectoryIdentity::new(2, 20),
    );
    preflight_udf(main, surface, OverrideObservation::Clear)
        .unwrap()
        .verify(
            attempt,
            EffectiveUdfObservation::new(
                EnvironmentObservation::new(environment.clone(), browser_process.clone()),
                EffectiveDirectory::new(
                    PathKey::parse("D:/surface").unwrap(),
                    DirectoryIdentity::new(2, 20),
                ),
                ProfileObservation::new(
                    PathKey::parse("D:/surface/profile/default").unwrap(),
                    environment.clone(),
                ),
            ),
        )
        .unwrap()
}

fn fully_released(attempt: &AttemptBinding) -> Ledger {
    let mut ledger = Ledger::new(attempt.clone());
    ledger.begin_creation(attempt).unwrap();
    let resources = ResourceKind::ALL.map(|kind| (kind, IdentityToken::new()));
    for (kind, token) in &resources {
        ledger.acquire(attempt, *kind, token.clone()).unwrap();
    }
    ledger.quarantined(attempt).unwrap();
    ledger.verified(attempt).unwrap();
    ledger.activate(attempt).unwrap();
    ledger.begin_retirement(attempt).unwrap();
    for (kind, token) in &resources {
        ledger.release(attempt, *kind, token).unwrap();
    }
    ledger
}

#[test]
fn destroyed_or_released_resources_without_browser_exit_stay_unknown() {
    // Given admission is closed and every owned resource was released.
    let attempt = binding(1);
    let environment = IdentityToken::new();
    let browser_process = IdentityToken::new();
    let isolation = verified(&attempt, &environment, &browser_process);
    let mut ledger = fully_released(&attempt);

    // When cleanup is evaluated without BrowserProcessExited evidence.
    let decision = evaluate_cleanup(&mut ledger, &isolation, None);

    // Then Destroyed-equivalent resource absence cannot produce Cleanup PASS.
    assert!(matches!(
        decision,
        CleanupDecision::Unknown(CleanupUnknownReason::BrowserProcessExitMissing)
    ));
    assert_eq!(ledger.state(), LedgerState::Retiring);
}

#[test]
fn browser_exit_from_wrong_environment_is_rejected() {
    // Given complete releases bound to one verified WebView2 environment.
    let attempt = binding(1);
    let environment = IdentityToken::new();
    let browser_process = IdentityToken::new();
    let isolation = verified(&attempt, &environment, &browser_process);
    let mut ledger = fully_released(&attempt);
    let wrong_exit =
        BrowserExitEvidence::new(attempt.clone(), IdentityToken::new(), browser_process);

    // When a different environment reports BrowserProcessExited.
    let decision = evaluate_cleanup(&mut ledger, &isolation, Some(wrong_exit));

    // Then cleanup remains unknown.
    assert!(matches!(
        decision,
        CleanupDecision::Unknown(CleanupUnknownReason::EnvironmentMismatch)
    ));
    assert_eq!(ledger.state(), LedgerState::Retiring);
}

#[test]
fn browser_exit_from_wrong_process_is_rejected() {
    // Given complete releases bound to one observed WebView2 browser process.
    let attempt = binding(1);
    let environment = IdentityToken::new();
    let browser_process = IdentityToken::new();
    let isolation = verified(&attempt, &environment, &browser_process);
    let mut ledger = fully_released(&attempt);
    let wrong_exit = BrowserExitEvidence::new(attempt.clone(), environment, IdentityToken::new());

    // When exit evidence identifies another browser process.
    let decision = evaluate_cleanup(&mut ledger, &isolation, Some(wrong_exit));

    // Then cleanup stays unknown for the still-unproven owned process.
    assert!(matches!(
        decision,
        CleanupDecision::Unknown(CleanupUnknownReason::BrowserProcessMismatch)
    ));
    assert_eq!(ledger.state(), LedgerState::Retiring);
}

#[test]
fn browser_exit_from_stale_generation_is_rejected() {
    // Given complete releases for generation two and exit evidence carrying generation one.
    let attempt = binding(2);
    let stale = attempt.clone().with_generation(NonZeroU64::new(1).unwrap());
    let environment = IdentityToken::new();
    let browser_process = IdentityToken::new();
    let isolation = verified(&attempt, &environment, &browser_process);
    let mut ledger = fully_released(&attempt);
    let stale_exit = BrowserExitEvidence::new(stale, environment, browser_process);

    // When stale BrowserProcessExited evidence is evaluated.
    let decision = evaluate_cleanup(&mut ledger, &isolation, Some(stale_exit));

    // Then it cannot retire the current generation.
    assert!(matches!(
        decision,
        CleanupDecision::Unknown(CleanupUnknownReason::AttemptMismatch)
    ));
    assert_eq!(ledger.state(), LedgerState::Retiring);
}

#[test]
fn complete_correlated_evidence_issues_cleanup_receipt_once() {
    // Given closed admission, exact resource releases and correlated browser exit evidence.
    let attempt = binding(3);
    let environment = IdentityToken::new();
    let browser_process = IdentityToken::new();
    let isolation = verified(&attempt, &environment, &browser_process);
    let mut ledger = fully_released(&attempt);
    let exit = BrowserExitEvidence::new(attempt.clone(), environment, browser_process);

    // When cleanup evidence is evaluated.
    let first = evaluate_cleanup(&mut ledger, &isolation, Some(exit.clone()));
    let second = evaluate_cleanup(&mut ledger, &isolation, Some(exit));

    // Then one PASS receipt retires the attempt and duplicate finalization is denied.
    assert!(matches!(first, CleanupDecision::Passed(_)));
    assert!(matches!(
        second,
        CleanupDecision::Unknown(CleanupUnknownReason::AlreadyFinalized)
    ));
    assert_eq!(ledger.state(), LedgerState::Retired);
}
