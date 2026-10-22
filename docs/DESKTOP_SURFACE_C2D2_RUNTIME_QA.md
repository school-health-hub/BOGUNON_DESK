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
An unresponsive child is recorded Unknown; the parent observes that same child only
within the reserved cleanup deadline, without kill/retry or later-case admission.
After that deadline the parent returns Unknown even if the process remains alive.
External runner cancellation can interrupt observation. Process exit alone is never
cleanup proof.

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

- cargo test --locked --manifest-path src-surface-host/Cargo.toml --lib --test runtime_contract --test runtime_deadline_contract --test security_boundary
- cargo check --locked --manifest-path src-surface-host/Cargo.toml --all-targets
- cargo clippy --locked --manifest-path src-surface-host/Cargo.toml --all-targets -- -D warnings
- cargo fmt --manifest-path src-surface-host/Cargo.toml -- --check
- node --test scripts/desktop-surface-c2d2.contract.mjs
- git diff --check

Actual Windows Runtime remains NOT_VERIFIED. Runtime execution readiness remains
BLOCKED until the protected Environment, reviewed new controller checkpoint,
workflow registration and exact one-shot execution approval are separately verified.
Do not dispatch from this implementation checkpoint automatically.

## Prior C-2D-2 implementation checkpoint verification

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


## C-2D-2A deadline, cancellation and evidence contract

The 30-minute workflow job includes dependency/compile checks (12-minute compile
step) and the existing five-minute runtime step. The host does not increase those
limits. Its single 240-second run deadline is inherited by every child, together
with a narrower case deadline; children cannot extend the parent's lease.

| Budget | Allocation | Reserved boundaries |
| --- | --- | --- |
| Host run | 240 seconds | Phase 1 40 + Phase 2 160 + final reporting reserve 40 |
| Phase 1 | 40 seconds | work 25, cleanup 12, evidence 3 |
| Phase 2 | at most 160 seconds | eight fixed cases, at most 20 seconds each |
| Parent per case | 20 seconds | primary observation through second 12, same-child drain through 18, evidence 2 |
| Child per case | 18 seconds | work 10, cleanup 6, evidence 2 |
| Outer runtime step | 300 seconds | host 240 leaves 60 seconds before external step timeout |

The wall-clock deadline is paired with a monotonic cap; rollback does not extend
an admitted lease. Callback observation and sleeps recheck remaining time.
Message pumping is limited to 64 messages per batch and checks cancellation and
deadline between messages. The pure flood test uses the same batching helper.
A pending callback may drain within cleanup reserve after admission closes; this
is the same request, never a retry or a new factory call.

There is no child.wait(), process kill, browser kill or automatic retry.
The finite supervisor first observes the child until its work boundary. On expiry,
poll failure or cooperative cancellation, it closes later-case admission, records
TIMEOUT/CANCELLED/HARNESS_FAILURE, requests cancellation, and only observes the same
process until the drain boundary. Late exit cannot promote Unknown to PASS.
If the child still exists, its known PID remains diagnostic identity, not cleanup
proof. Disposable-runner disposal is not promoted to a native cleanup receipt.

Cooperative cancellation uses a fixed cancellation-request.json beneath RUNNER_TEMP.
Only its presence is needed; environment/registry values are never copied into it.
A malformed/unreadable transport fails closed. It closes new native/case admission;
already-owned resources may only be released through their existing ownership.
The injected cancel-before-controller case remains an expected test fault and is
distinct from external run cancellation.

These are cooperative software budgets, not preemption of arbitrary synchronous
COM calls, window procedures, filesystem operations or OS hangs. GitHub forced job
termination can kill the observer before final records/upload. Missing evidence is
INCOMPLETE/NOT_VERIFIED, never PASS. Native timing, cancellation delivery, COM
teardown and forced-job behavior remain separately authorized Windows QA items.
No Miri/sanitizer proof of Win32 FFI is claimed by these pure/compile checks.

### Separate final outcomes

Root JSON separates phaseOneResult, phaseTwoResult, expectedRejectionsPass,
intentionalCleanupUnknownObserved, terminalReason, evidenceState,
and runtimeCleanupPass. The fixed final missing-browser-exit case produces
INTENTIONAL_CLEANUP_UNKNOWN_OBSERVED only after the expected observations. This
never sets runtimeCleanupPass=true; the command exits nonzero, leaving a diagnostic
run rather than an overall cleanup success. Unexpected Unknown, incomplete evidence,
harness failure, cancellation and timeout are separate from expected rejections.
No case follows the intentional terminal Unknown.

The scanner still limits JSON/JSONL files, size, directory depth and fixed case
names. It additionally checks decoded string/key values for absolute drive/UNC/home
paths and common credential/token markers. Rejections and malformed JSON use fixed
redacted CLI errors; rejected input is not echoed into Actions logs. Child stdout
and stderr remain suppressed, and the parent prints only a fixed failure message.
Safe incomplete diagnostics may be uploaded with an INCOMPLETE classification;
scanner rejection prevents upload. evidenceStatus is a completeness check, not
independent authentication of runtime evidence or a comprehensive secret scanner.
No preflight registry/environment value dump is uploaded. No real runtime Evidence
was produced by this checkpoint.

### Reproduction and approval boundary

Run the local non-runtime commands above, including runtime_deadline_contract.
The existing all-target Clippy unwrap warnings remain outside this patch; only the
Library/binary Clippy gate is green. actionlint is unavailable and NOT_VERIFIED;
nothing is downloaded to replace it. Main src-tauri, C-2C-2, dependencies and locks
remain unchanged. No Environment, dispatch, PR, installer or native run is authorized.
Environment setup, default-branch registration, final controller-SHA pinning and
one-shot execution approval are still required after static review.

## C-2D-2A local verification record

The existing 29 Rust tests are retained. Ten new pure deadline/cancellation/outcome
contracts run without the native host (39 total). Nine Node controller contracts
include real scanner CLI subprocess rejection with synthetic secrets/malformed
JSON, LF/CRLF, missing evidence and diagnostic allowlist checks. The scanner CLI
is exercised; neither host executable nor WebView2 is run.

Debugging hypotheses and observed non-native evidence:
1. Queue flooding could prevent deadline checks: shared 64-message batching and a
   continuously nonempty synthetic queue now return on count/deadline.
2. Rejection could echo secrets: subprocess stdout/stderr tests reject synthetic
   path/token/malformed input without echoing the marker or diagnostic root.
3. Incomplete finalization could overwrite TIMEOUT/CANCELLED: typed reason
   preservation test keeps recorded reasons ahead of the fallback.
These observations do not establish Win32 runtime behavior or secret-scan completeness.

Check changes only under the C-2D-2 workflow, controller/contracts, runtime host
budget/diagnostic integration, documentation and tests. The small windows_host
change bounds the existing message pump; no new Win32 FFI call is introduced.
No protected Main/C-2C-2/dependency/lockfile changes or unrelated tests are staged.

Final local C-2D-2A results: Rust 39/39, Node 9/9, all-target cargo check,
Library/binary clippy -D warnings, rustfmt and diff check passed. The extra
all-target Clippy run reported exactly the same fourteen existing unwrap warnings;
no new test warning remains. Five independent non-runtime review lanes passed
after the message-pump, redacted-scanner and terminal-reason fixes. actionlint and
actual WebView2 behavior remain NOT_VERIFIED; static verification is PARTIAL,
runtime execution readiness BLOCKED. No execution/configuration approval is implied.
