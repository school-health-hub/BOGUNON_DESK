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

Phase 2 is implemented but NOT RUNTIME VERIFIED. The parent calls it only after
its actual Phase 1 succeeds and writes a run/controller/source/attempt-bound receipt.
Each fixed case starts a new host process with its own fresh UDF, generation,
operation identity and launch binding. Child processes repeat the runtime authorization
checks and validate that Phase 1 receipt. The parent checks exit status, the child PID,
all identity fields and independently observes the UDF directory identity.
A failed/unreadable/mismatched report or CLEANUP_UNKNOWN prevents all following
process launches. No case is retried and no browser/host process is force-killed.
An unresponsive child is recorded Unknown immediately; the parent retains and waits
for that same child without kill/retry or later-case admission. External runner
cancellation can still interrupt observation and remains Unknown. Process exit alone
is never cleanup proof.

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

## Phase 2 fixed fault plan (implementation checkpoint)

| Case | Fault mechanism | Native creation and accepted result |
| --- | --- | --- |
| environment-rejected | Reject the factory request at the outer admission seam | No Window/STA/environment; EXPECTED_REJECTION with NO_RESOURCES_CREATED, not a cleanup receipt |
| controller-rejected | Reject the controller request at the outer admission seam | Same pre-dispatch boundary; this does not claim a real COM controller creation error |
| environment-deadline | Zero observation budget before retrieving the asynchronous environment callback | Drain the SAME actual request with a bounded shutdown budget, then create/close the controller to observe correlated browser exit; no second creation attempt |
| controller-deadline | Zero observation budget before retrieving the controller callback | Drain the SAME request and close the returned controller; late/unreturned resources remain Unknown |
| cancel-before-controller | Cancel admission while the controller callback has not been retrieved | Never admit renderer/actions; still retrieve and close that controller and observe cleanup |
| held-event-token | Hold an additional actual environment subscription in a scoped ownership ledger | Receipt must be denied while it is owned; unsubscribe with result checking before normal cleanup |
| held-com-reference | Hold a real cloned environment COM reference in a scoped ownership ledger | Receipt must be denied while it is owned; drop the reference before normal cleanup |
| missing-browser-exit | Expire the receipt observer budget before retrieving the exit callback | Drain the real event for physical cleanup, but withhold it from the expired receipt; EXPECTED_REJECTION plus CLEANUP_UNKNOWN, not PASS |

Deadline cases are injected observer-budget expiration, not evidence that Windows
actually became slow or that COM returned an HRESULT failure. Callback drain is not
a creation retry. Retention probes exercise owned references and subscriptions;
they do not intentionally leak resources or claim detection of arbitrary external COM
references. The missing-exit case deliberately closes the gate and is placed last.
A naturally missing callback, wrong exit identity, failed unsubscribe/destroy or
unexpected native error remains Unknown/unexpected and stops the suite earlier.
No synthetic ledger or fabricated BrowserProcessExited event can issue a receipt.

The immutable C-2D-1 source remains the comparison baseline. This controller adds
explicitly reviewed runtime-only modules plus result-bearing unsubscribe/window
teardown methods. Those additions do NOT inherit C-2D-1 Native PASS; they require
new compile verification and separately authorized Windows runtime QA.

## Contracts retained without WebView2 creation

Stale generation, replay/out-of-order sequence, wrong origin/child frame, unknown
fields, oversized/malformed JSON, PID/environment/attempt mismatch, unresolved
ownership and invalid receipt conditions stay pure contracts. Their tests do not
constitute runtime transport validation. Only Library/integration contract test
executables are run locally; neither native host executable nor WebView2 is launched.

## Case evidence and results

Each case report binds case ID, expected/observed fault, immutable source SHA,
controller SHA, run/attempt, parent/host PID plus launch identity, generation,
operation attempt and redacted UDF volume/file identity. PID alone is not a permanent
process identity. Parent-child binding is within the trusted reviewed controller,
not independent tamper-proof evidence against malicious same-user code.

Request outcome (EXPECTED_REJECTION / UNEXPECTED_FAILURE / NOT_RUN) and cleanup
(NO_RESOURCES_CREATED / CLEANUP_VERIFIED / CLEANUP_UNKNOWN / NOT_RUN) are separate.
Expected rejection never upgrades incomplete cleanup to success.

Root diagnostics preserve the Phase 1 receipt, Phase 2 case summary and final phase
flags. Fixed case directories contain only allowlisted JSON/JSONL: case report,
timeline, ownership transitions, UDF observations, retention observation and cleanup
receipt/unknown. Not-attempted observations are not invented. The scanner rejects
unknown directories, links, unknown files, invalid JSON/JSONL, sensitive markers,
files above 1 MiB and total contents above 8 MiB. Upload requires scanner success.
No executable, UDF content, profile path or installer is uploaded.

## Local non-runtime verification

- cargo test --locked --manifest-path src-surface-host/Cargo.toml --lib --test runtime_contract --test security_boundary
- cargo check --locked --manifest-path src-surface-host/Cargo.toml --all-targets
- cargo clippy --locked --manifest-path src-surface-host/Cargo.toml --all-targets -- -D warnings
- cargo fmt --manifest-path src-surface-host/Cargo.toml -- --check
- node --test scripts/desktop-surface-c2d2.contract.mjs
- git diff --check

Actual Windows Runtime remains NOT_VERIFIED. Runtime execution readiness remains
BLOCKED until the protected Environment, reviewed new controller checkpoint,
workflow registration and exact one-shot execution approval are separately verified.
Do not dispatch from this implementation checkpoint automatically.

## Implementation checkpoint verification

Local non-runtime results: 29 Rust tests passed (16 Library, 10 runtime contracts,
3 security contracts); all-target cargo check passed; Library/binary clippy with
-D warnings passed; scoped rustfmt and git diff --check passed; six Node controller
contracts passed, including LF/CRLF diagnostic parsing and upload-scanner gating.
The additional all-target clippy attempt failed on pre-existing test unwrap usage
in cleanup, diagnostic, ipc, lifecycle, ownership and runtime_evidence tests.
Those unrelated tests were not weakened or rewritten. YAML parser/actionlint were
not available locally; workflow static contracts passed, not an actionlint claim.

Five independent read-only review lanes passed the non-runtime implementation
scope after fixes. The debugging hypotheses checked through pure contracts were:
(1) Phase 2 might bypass Phase 1: matching receipt and sticky scheduler tests reject it;
(2) expected rejection might promote Unknown cleanup: outcome/receipt identity tests reject it;
(3) diagnostics might be invalid or escape upload paths: JSON/JSONL LF/CRLF and allowlist tests reject it.
These observations are contract evidence, not native runtime evidence.

Local ignored .omo verification logs are not part of the Git checkpoint and are
not a complete cross-PC evidence transfer. The tracked commands reproduce the pure
checks; actual Runtime remains NOT_VERIFIED and execution readiness BLOCKED.
No Main src-tauri, C-2C-2 workflow, dependency or lockfile changes are included.
Secret scanners were unavailable; intended tracked files receive best-effort
credential/private-path inspection only, with residual scanner coverage risk.
