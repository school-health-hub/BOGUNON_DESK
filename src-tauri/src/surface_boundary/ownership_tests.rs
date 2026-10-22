use super::{AttemptBinding, IdentityToken, Ledger, LedgerError, LedgerState, ResourceKind};
use std::num::NonZeroU64;

fn binding(generation: u64) -> AttemptBinding {
    AttemptBinding::new(NonZeroU64::new(generation).unwrap())
}

#[test]
fn partial_creation_failure_releases_only_exact_owned_resources() {
    // Given a creation attempt that owns a host and Window but never receives a WebView handle.
    let attempt = binding(1);
    let host = IdentityToken::new();
    let window = IdentityToken::new();
    let mut ledger = Ledger::new(attempt.clone());
    ledger.begin_creation(&attempt).unwrap();
    ledger
        .acquire(&attempt, ResourceKind::NativeHost, host.clone())
        .unwrap();
    ledger
        .acquire(&attempt, ResourceKind::Window, window.clone())
        .unwrap();
    ledger
        .mark_unresolved(&attempt, ResourceKind::WebView)
        .unwrap();

    // When cleanup releases the two exact owned resources.
    let host_result = ledger.release(&attempt, ResourceKind::NativeHost, &host);
    let window_result = ledger.release(&attempt, ResourceKind::Window, &window);
    let webview_result = ledger.release(&attempt, ResourceKind::WebView, &IdentityToken::new());

    // Then owned releases succeed while the unreturned handle remains CleanupUnknown.
    assert_eq!(host_result, Ok(()));
    assert_eq!(window_result, Ok(()));
    assert_eq!(webview_result, Err(LedgerError::UnresolvedResource));
    assert_eq!(ledger.state(), LedgerState::CleanupUnknown);
    assert!(!ledger.admission_open());
}

#[test]
fn duplicate_cleanup_is_rejected() {
    // Given one owned Window in retirement.
    let attempt = binding(1);
    let window = IdentityToken::new();
    let mut ledger = Ledger::new(attempt.clone());
    ledger.begin_creation(&attempt).unwrap();
    ledger
        .acquire(&attempt, ResourceKind::Window, window.clone())
        .unwrap();
    ledger.begin_retirement(&attempt).unwrap();
    ledger
        .release(&attempt, ResourceKind::Window, &window)
        .unwrap();

    // When the same resource is released again.
    let result = ledger.release(&attempt, ResourceKind::Window, &window);

    // Then duplicate cleanup is denied without changing the retired identity.
    assert_eq!(result, Err(LedgerError::DuplicateCleanup));
}

#[test]
fn stale_generation_cannot_acquire_or_release_resources() {
    // Given a ledger bound to generation two and a stale generation one binding.
    let current = binding(2);
    let stale = current.clone().with_generation(NonZeroU64::new(1).unwrap());
    let token = IdentityToken::new();
    let mut ledger = Ledger::new(current.clone());
    ledger.begin_creation(&current).unwrap();

    // When stale ownership operations are attempted.
    let acquire = ledger.acquire(&stale, ResourceKind::Window, token.clone());
    ledger
        .acquire(&current, ResourceKind::Window, token.clone())
        .unwrap();
    ledger.begin_retirement(&current).unwrap();
    let release = ledger.release(&stale, ResourceKind::Window, &token);

    // Then neither stale operation is authorized.
    assert_eq!(acquire, Err(LedgerError::StaleAttempt));
    assert_eq!(release, Err(LedgerError::StaleAttempt));
}
