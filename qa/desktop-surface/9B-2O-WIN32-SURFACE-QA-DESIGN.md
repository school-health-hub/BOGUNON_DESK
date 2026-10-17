# 9B-2O Independent Win32 Surface QA Design

Status: DESIGN ONLY. Implementation and Windows execution are NOT authorized.

Reviewed baseline: `fb035803784955559c0de123c910509c0279eaf4`, branch
`codex/desktop-surface-core-9b2a`. The worktree was clean before this document.
This document adds no executable, feature, manifest, or runtime permission.

## 1. Recommended architecture

Add a future, explicitly gated `desktop-surface-own-window` binary inside this
QA crate, not another Tauri application. Its proposed `own-window-qa` feature is
required; the target has `test=false`, `bench=false`, and no default activation.
An ordinary test run, including all-features, must never execute this binary.

One creator thread owns a native window ledger, a bounded callback queue, an
Event Router, and a synthetic Main fixture. There is at most one live, hidden,
unowned top-level window. A session permits an initial creation and at most one
explicit replacement attempt, sharing one retry budget. One approved packet
permits at most one process attempt. Neither retry nor replacement is automatic.

The data flow is:

`approval Gate -> native owner -> typed notifications -> coordinator -> Router -> K model`

The synthetic Main fixture supplies only an immutable projection. Accepted
`CommandRequest` values are counted/recorded, never executed. Native code cannot
obtain a mutable Main reference. No real Main window exists in this process.

No Tauri, WebView2, tray, login, updater, IPC, AppData resolution, financial
storage, close-to-tray handler, Shell enumeration, or Explorer dependency is
included. No external HWND/PID is accepted through arguments, environment,
manifest, or messages. Paths are accepted only for approved QA files.

## 2. Reuse and non-reuse

| Existing source | Reuse | Boundary / reason |
| --- | --- | --- |
| `disposable_surface.rs` | K state transitions, tickets, retry budget unchanged | No HWND or native owner enters the pure model |
| `surface_event_types.rs`, `surface_event_router.rs` | Instance token, generation/operation and sequence validation | Use the actual Router, not a parallel imitation |
| `surface_integration_fixture.rs` | M scenarios and invariant expectations | Its assertion-based test fixture is not a production native execution path; use typed failures in the coordinator |
| `gate.rs` | Four-field manifest shape, hashing/path-check concepts | Existing scope/opt-in are hardcoded for 9B-2C; do not reuse its permit or old approvals for the new scope |
| `live_permissions.rs` | Own-token Medium/elevation and window-station checks | Does not alone establish an accessible, unlocked input desktop |
| `window_lifecycle.rs` | Same-thread ownership, reverse cleanup and failure contracts | Existing fixed Root/Owned/Child orchestration is not the new single-Surface coordinator |
| `test_window.rs` | Own-window identity and class cleanup patterns | Constructor depends on Explorer identity; WndProc has no routing; post-create ledger registration is insufficient for callback-driven partial creation |
| `outcome.rs`, `diagnostic_output.rs` | Status vocabulary, sanitized formatting and unwind/cleanup pattern | Existing success policy rejects PASS + NOT_OBSERVED; use a separate minimal window-only result policy |
| `evidence_paths.rs`, `evidence_store.rs` | Directory locking, create-new staging, verification and non-replacing publication principles | Existing sink is tied to old permit, scope, and Shell evidence record; do not fabricate an old v2 record |
| `live.rs`, `live_main.rs`, read-only Shell/topology collection | Do not call | Existing observe path intentionally queries Explorer/WorkerW |

Keep existing Live Runner files, behavior, approved executable and manifests
unchanged. Reuse pure source modules and small low-level facilities where their
interfaces already fit. A small own-only policy/adapter is preferable to copying
the entire Runner or silently generalizing the old approval contract. Any shared
extraction affecting the old runner needs separate compatibility review.

## 3. Win32 notification to pure-model transition

The native creation token is distinct from Surface instance ID, generation, and
operation ID. A notification captures its originating binding; never attach a
late notification to whatever binding is current when the queue is drained.

| Native/coordinator event | Actual model call | Acceptance and native consequence |
| --- | --- | --- |
| Explicit create | `Router.create` / explicit `retry_create` | Reserve binding and native ledger before CreateWindowExW |
| WM_NCCREATE / WM_CREATE | No creation-success transition yet | Track the pending own creation; obey Win32 callback return semantics |
| CreateWindowExW returns a valid own window | `Router.created(binding, success)` | Only after own identity and surviving-window verification |
| Create returns failure | `Router.created(binding, failure)` | Account for partial native resources; cleanup uncertainty blocks further native work |
| Available receives synthetic action | `Router.accept(Event)` | Exact binding and next sequence required; record request only |
| Unexpected confirmed own destruction | `Router.lost(binding)` | Retire native token; later callbacks cannot revive it |
| Explicit dispose | `Router.dispose` / explicit `retry_dispose` | Capture disposal ticket, disable action delivery, then own-window DestroyWindow |
| WM_DESTROY / WM_NCDESTROY during dispose | No immediate success | Mark destruction/tombstone; complete only after native verification |
| Verified disposal completion | `Router.disposed(binding, success)` | Ledger empty and own-window/class checks succeed before replacement |
| Disposal failure | `Router.disposed(binding, failure)` | Failed-dispose blocks creation; no automatic retry |
| Stale/duplicate/reordered notification | Reject/count | Never perform a native mutation to satisfy an obsolete ticket |

K has no general native-resource-uncertainty state. Therefore an orthogonal
session safety latch must halt native work after uncertain partial creation or
cleanup. Do not change K semantics or pretend a Creating failure is a successful
dispose. Unsupported is a model outcome, not a claim about WorkerW capability.

## 4. Ownership, callback reentrancy and ABA

Before registering/creating anything, preallocate bounded ledger/queue capacity.
Before CreateWindowExW, reserve a pending creation record on the creator thread.
Creation can synchronously invoke callbacks before the API returns. A narrowly
scoped thread-local registry binds WM_NCCREATE to that pending record without
SetWindowLongPtr/user-data mutation. Callback-time bookkeeping must not require
fallible allocation or permit an unwind across the Win32 ABI.

WndProc must not call the Router or recursively borrow the coordinator. It only
records bounded typed notifications, with explicit overflow failure. The outer
loop drains them. Preserve DefWindowProcW return behavior where appropriate;
do not accidentally reject WM_NCCREATE. Intercept an own WM_CLOSE as a request
for the outer coordinator, not the operating application's close-to-tray policy.
Raw WM_COMMAND/WM_APP messages are not authenticated Main actions. Domain action
tests use an in-process synthetic driver with original binding and sequence.

The native owner is non-Send and records own PID/TID, process creation identity,
class identity, native creation token, and internal HWND. Only the creator thread
may destroy its confirmed live window. Never adopt a window discovered by lookup.
DestroyWindow is called only for a live ledger entry. WM_NCDESTROY retires that
entry; no subsequent destroy targets the retired numeric handle. Cleanup and Drop
share an at-most-once ledger, not independent destruction attempts.

Arc-backed instance identity prevents reuse while an old model callback retains
the token. This is not proof against Windows reusing a numeric HWND. PID/TID/class
checks and IsWindow alone are not ABA proof. Creation-time registration,
tombstones, single-thread execution and fail-closed identity checks reduce risk;
malicious same-user interference and all possible HWND races remain unproven.

On uncertain identity, stop and report FAIL_CLEANUP rather than destroy an
unverified handle. Do not kill other processes or retry indefinitely. First live
approval covers only normal create/observe/dispose and bounded replacement;
destructive fault injection remains synthetic unless separately approved.

## 5. Native API allowlist and cleanup

Proposed mutation allowlist is limited to RegisterClassW, CreateWindowExW,
DestroyWindow, and UnregisterClassW for this process's own class/windows.
Read/message-loop facilities may include GetModuleHandleW, GetCurrentProcessId,
GetCurrentThreadId, GetWindowThreadProcessId, GetClassNameW, GetWindowLongPtrW,
GetWindowPlacement, GetWindowRect, GetClientRect, IsWindowVisible, IsIconic,
IsZoomed, monitor/DPI getters and context comparison, PeekMessageW,
TranslateMessage, DispatchMessageW and DefWindowProcW. Own process token/time
queries and RAII handle closure are allowed for Gate/identity only.

EnumThreadWindows may inspect only the creator thread's own top-level QA class
for a remaining-window check. No EnumWindows, Shell window lookup or traversal
of foreign HWNDs is allowed. An unexpected QA-class window is a failure, not a
license to adopt/destroy it. With one unowned top-level window, no child traversal
is required. Parent/owner absence is checked only on the created window.

Input-desktop preflight may use OpenInputDesktop, GetUserObjectInformationW and
CloseDesktop read-only; no SwitchDesktop or desktop modification. Every final
direct Win32 call/import must be reviewed before implementation approval.

Never call SetParent, SetWindowLongPtr, SetWindowPos, SetWindowPlacement,
ShowWindow, foreground activation, hooks, Explorer messages (including 0x052C),
process termination or elevation. Creation styles are fixed, hidden and
non-activating; no later style/z-order adjustment is part of this experiment.

Cleanup completes on the creator thread before Evidence publication. Confirm
the ledger is empty, the own-class thread-window count is zero, and class
unregistration succeeded. Unverifiable remaining state is not a zero count.
No recreation is allowed before verified cleanup. A soft deadline/step budget
stops new work, but cannot preempt a hung FFI call. No external kill is authorized.

## 6. Result, panic and Evidence contract

The new runner always prints `CAPABILITY=NOT_OBSERVED`: it never queries Shell.
Do not print SUPPORTED or UNSUPPORTED merely to satisfy the old Runner's success
predicate. Standard stdout begins with WINDOW and CAPABILITY status lines;
only FAIL_CLEANUP and fixed E_* codes may follow on failure. Stderr is empty.
No panic payload, backtrace, path, HWND, PID/TID, title or fixture content is
formatted. The dedicated binary installs a silent panic hook before Gate work.
Unwind handling retains the native owner outside the observation boundary,
attempts explicit cleanup, then attempts Evidence publication.

Allocate the owner container outside the entire fallible preparation/creation
boundary as well. A prepare error or panic after partial registration/creation
must still expose its ledger to explicit cleanup; do not copy the old executor's
early prepare-error return. Final owner release must complete before publishing
the cleanup result, so a later Drop failure cannot invalidate saved success.

| Exit | Window-only meaning |
| --- | --- |
| 0 | Own lifecycle, Router/Main invariants, cleanup and Evidence all PASS; capability NOT_OBSERVED |
| 2 | Gate BLOCKED; no native window creation |
| 3 | Native observation/model/invariant FAIL |
| 4 | Unexpected caught internal panic |
| 5 | Cleanup FAIL, including panic plus cleanup failure |
| 6 | Evidence publication or output writer failure |

Functional priority is cleanup > panic > Gate > observation > Evidence failure.
An actual stdout writer failure returns 6 even if a prior functional error exists;
retain that error in Evidence if writable. A broken output channel cannot promise
the full protocol. Never count nonzero exit as PASS even if WINDOW=PASS was
already written. This is a new target policy, not a change to the old Runner.

Define a separate strict, versioned own-window Evidence record, not Shell v2:
`schema_version=1`, `runner_kind=OWN_WIN32_SURFACE`, fixed status/reason enums,
source/artifact hashes, creation/destruction/rejection counts, nullable remaining
own-window count, Main-unchanged result, and cleanup result. Only fixed whitelisted
fields are serialized; unknown fields and enum values are rejected. Do not
serialize bindings, native identities, errors via Debug, or Main fixture text.
An unwitnessed value is null/NOT_OBSERVED, never a successful fabricated count.

Store completion is established by verified file publication and process result;
do not place a self-asserted evidence_saved=true in bytes before saving them.
Storage failure may leave no final Evidence. Cleanup still has priority and is
attempted regardless of observation, panic or storage failure.

## 7. New approval packet and execution Gate

All names/scopes below are proposals, not active permissions. Keep existing
four-field runtime manifest shape: source_sha, executable_path, sha256, scope.
Use a distinct proposed scope `9B2O_OWN_WINDOWS_NO_SHELL` and typed permit.
New explicit opt-in/manifest inputs must be separate from old 9B-2C variables.
The current design request authorizes neither a manifest nor an execution.

Proposed strict descriptor fields are runtime_manifest_sha256, evidence_path,
staging_path, run_claim_path, scope. A distinct own-window Evidence scope binds
this descriptor. Independent review fixes hashes of executable, manifest and
descriptor; operator execution approval is recorded separately, never invented.

Preflight must verify:

1. Reviewed committed source, embedded source SHA, exact executable bytes,
   architecture, feature/profile and known signature state.
2. Independently reviewed manifest/descriptor and actual operator scope approval.
3. Manifest hash linkage, exact explicit absolute QA paths, no existing final,
   staging or claim file; no traversal, UNC/device/ADS or reparse paths.
4. Existing non-synchronized output directory; no automatic directory creation,
   file replacement, ACL changes or path search.
5. Non-elevated Medium integrity, interactive visible station, accessible input
   desktop; inability to establish input-desktop state is BLOCKED.
6. Native import/call allowlist and absence of Shell/Tauri/WebView2 dependencies.
7. Resource headroom and an approved isolated execution environment; no VM changes
   or use of operating data is implicit in this document.

Hold appropriate directory/file handles and recheck hashes before creation.
Create an exclusive, non-replacing run claim only after preflight and before
class registration. Keep it even after failure/crash; never automatically reset
it. One packet then permits one honest process attempt. Same-user deletion or
replacement of the claim is a residual risk, not prevented cryptographically.

Evidence and staging must be distinct, explicitly approved files in the same
existing directory. Use create_new, bounded encoding (at most 16 KiB), flush/sync,
same-handle byte verification and atomic non-overwriting publication. Retain
staging as required by the selected publication primitive. Reject reparse points
throughout ancestor paths; no junction workaround. Existing approved artifacts
and Evidence are never destinations. Same-user TOCTOU remains a documented risk.

## 8. Verification and stop criteria

| Experiment | Prerequisite | Success / stop criterion |
| --- | --- | --- |
| Pure unit/integration | Synthetic coordinator + real K/L Router API | Main unchanged; stale/duplicate/reordered callbacks rejected; budget survives replacement |
| Subprocess fixture | No native module linked into fixture | Allowlisted raw stdout, empty stderr, matching exit; Gate/panic/cleanup/Evidence/writer failure combinations |
| Structural/default/all-features checks | New target feature required, test=false | No live binary invocation, window creation or Shell calls from tests |
| Native callback bookkeeping | Approved implementation + mock Win32 adapter | Partial create, reentrancy, queue overflow, stale binding and late destroy notifications fail closed |
| First actual own-window session | New reviewed artifact/packet, separate explicit live approval, all Gate checks | Hidden own window created, observed, disposed; zero remaining own windows; no Shell query |
| Replacement session within approved run | Previous cleanup verified, explicit retry policy, shared budget | Old callbacks rejected; at most one live window and two creation attempts |
| Cleanup/Evidence failure | Synthetic injection first | Cleanup attempted before storage; neither error becomes success; uncertain identity stops native work |
| ABA/late messages | Synthetic captured-token replay | No old callback adopts new binding; actual OS handle reuse is not forced or claimed proven |

Real fault injection, deliberate cleanup failure, monitor/DPI reconfiguration,
Explorer restart, attach/detach and Tauri/WebView2 interaction are outside the
first experiment. Any unexpected privilege request, foreign window identity,
remaining own window, reparse/file change or unknown callback state stops further
native actions. No automatic rerun or external process termination is allowed.

Caught Rust unwinds can attempt cleanup. Abort, OOM, forced process termination,
fatal FFI errors and failures before hook installation cannot promise cleanup,
Evidence or sanitized diagnostics. OS process teardown is not an observed cleanup
PASS. Missing final evidence/result is never success.

## 9. Minimal future implementation scope

QA-only Cargo target/feature registration; a small own-window entrypoint/Gate;
native owner and callback ledger; coordinator using unchanged K/L; own-only
result/Evidence adapters; synthetic unit/subprocess tests and Gate documentation.
Split modules by responsibility, avoiding duplicate old Runner orchestration.
No application Cargo file, lockfile, dependency version, production command or
existing approval artifact needs changing. If existing features prove insufficient
or shared interfaces require wider changes, stop for scope review.

Remaining risks are native callback ABI/reentrancy correctness, partial creation
accounting, HWND ABA, same-user file replacement, non-preemptible API hangs and
abnormal termination. Synthetic K/L/M evidence does not prove any native behavior.
The old own-window Live QA does not validate this new event/model connection.
Operational Main safety, Desktop Surface support and attach safety remain untested.

## 10. Source anchors and platform references

Reviewed sources: gate.rs (`verify`, `authorize`), live.rs (prepare/observe),
live_permissions.rs, test_window.rs (native creation/destruction),
window_lifecycle.rs (`OwnedWindows`), diagnostic_output.rs (`execute`, exit/write
policy), outcome.rs, evidence_approval.rs, evidence_paths.rs, evidence_store.rs,
disposable_surface.rs, surface_event_types.rs, surface_event_router.rs and
surface_integration_fixture.rs. Production close-to-tray behavior in
src-tauri/src/lib.rs is explicitly not reused.

Microsoft documents that creation messages occur within CreateWindowExW, and
DestroyWindow is restricted to the creating thread. These contracts motivate
pre-call ledger reservation and same-thread cleanup, not a claim of race freedom:
[CreateWindowExW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowexw),
[DestroyWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-destroywindow).
[EnumThreadWindows](https://learn.microsoft.com/en-us/windows/desktop/api/winuser/nf-winuser-enumthreadwindows)
enumerates nonchild windows of a specified thread, not proof that a retained HWND
still identifies the original window.

Design verdict: `9B2O_DESIGN_READY`. Runtime readiness: NOT AUTHORIZED / NOT TESTED.
