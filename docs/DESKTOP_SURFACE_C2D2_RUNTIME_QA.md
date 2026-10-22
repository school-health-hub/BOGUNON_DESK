# Desktop Surface C-2D-2 disposable runtime QA

## Security boundary

The runtime controller is separate from the immutable C-2D-1 application source
`97dd7116a0844f86414812946b446cbbfdb5a209`. It checks out both revisions, rejects
controller changes outside the C-2D-2 allowlist, and never starts the Main Tauri
application. The host crate has no Tauri, plugin, Finance, network-listener, or
Explorer attachment dependency.

The workflow requires the `desktop-surface-runtime-qa` Environment, an exact
controller SHA, the literal one-shot confirmation, run attempt 1, and a nonce minted
after Environment admission. The Environment does not currently exist in the
repository. Runtime dispatch remains blocked until a required-reviewer rule is
created and independently verified; an Environment name alone is not approval.

## Preflight

Before WebView2 creation, the controller checks known WebView2 environment override
names, reads HKLM and HKCU WebView2 policy roots without exporting values, detects the
Runtime version, and requires a unique UDF beneath `RUNNER_TEMP`. Unreadable policy,
any override, any policy value, a missing Runtime, or a non-canonical UDF blocks the
run before environment creation.

## Runtime phases

Phase 1 creates one hidden Win32 window and one independent WebView2 environment,
observes the effective UDF, profile and browser process identity, closes the
controller, waits for the exact environment's `BrowserProcessExited` event, and
requires a correlated cleanup receipt. `CleanupUnknown` is a failure and prohibits
all later cases.

Phase 2 remains deliberately disabled in this controller revision. Callback timeout,
controller failure, stale generation/sequence, origin/frame rejection, schema
rejection, browser identity mismatch, and cleanup timeout are covered by non-runtime
contracts only. They must not be represented as runtime PASS until each case is run
in an independent process and UDF after Phase 1 succeeds.

## Evidence

Only the fixed JSON/JSONL allowlist is uploaded. Evidence is limited to run-bound
identifiers, state transitions, resource categories, redacted UDF comparisons,
Runtime version, and the cleanup outcome. Executables, installers, archives, Cargo
targets, UDF contents, cookies, credentials, absolute user-profile paths, and Finance
data are forbidden. A final scanner rejects unknown files, files over 1 MiB, and
known sensitive path or data markers.

## Manual registration and execution gate

1. Review and push the controller checkpoint.
2. Create `desktop-surface-runtime-qa` with a required reviewer and no self-bypass.
3. Verify the rule through the repository API.
4. Register the workflow through the normal default-branch PR process.
5. Select the reviewed feature branch, enter its exact controller SHA and
   `RUN_C2D2_ONCE`, then wait for Environment approval.
6. Do not rerun a failed attempt. Preserve `CleanupUnknown` and investigate it.

No runtime dispatch, application launch, installer creation, or Main integration is
authorized by this document.
