# 9B-3H-A Independent Failure Cleanup Boundary

Scope: QA source implementation and Synthetic verification only. Baseline branch
codex/desktop-surface-core-9b2a, HEAD 9b63b63141ef389634f7652d22ad4034777cae6c,
working tree initially clean. No Native Runner, Gate, Win32 window/message dispatch,
Explorer/WorkerW query, operational Main HWND, Tauri/WebView2 or user data access.
Actual Windows Native behavior remains NOT VERIFIED.

## Reproduction and cause

Existing Host::guard rejected faulted/stopped hosts before close/verify_cleanup.
NativeBackend::perform rejected faulted/stopped backends before Owner finalization.
Owner normal identity also required the sticky callback health latch. Thus callback
overflow, partial creation or Unknown could retain QA resources while normal
cleanup admission was closed; Drop remained best effort and never a cleanup proof.
Synthetic reproduction confirmed retained Fake ownership, overflow, rejected close
and rejected normal verify. Initial addition of failure_cleanup tests failed to
compile because the dedicated API did not exist (E0599); this was an API red test,
not observed Windows behavior. Native guard findings were direct source review.

## Boundary and call flow

Host::failure_cleanup -> Backend::cleanup_capability -> Backend::cleanup_failure
-> NativeBackend failure capability -> Owner failure capability -> observations.

Normal Host/Backend/Owner guards remain. Failure cleanup separately checks creator
thread, reentry and its one-attempt latch. It stops normal admission before entering
the backend, marks the existing Adapter Unknown, and never holds Adapter/Ledger
mutable borrows across Native calls. It never issues replacement or auto-retries.
The small creator_thread_operations module holds the existing normal operations;
protocol failures now enter the same first-error latch instead of escaping it.

Native capabilities have private fields, no Clone, and Rc leases so they are
Non-Send/Non-Sync and cannot be forged or transferred between owners/backends.
Owner capability retains the exact immutable receipt, current instance/generation/
operation binding and Ledger token. No request accepts external HWND/PID/path.
Actual destruction additionally checks creator thread, live Ledger handle/token/
binding, class atom, module, PID and TID. Retired callback metadata is never adopted
as a destruction target. Fault health is bypassed only by this independent path;
normal-operation admission, cleanup_issued and sticky callback faults remain closed.

Report preserves three distinct values: first original Host lifecycle Error,
optional capability-admission Error, and cleanup Observation plus Status. Thread,
reentry and duplicate entry errors leave original_failure() available. A cleanup
success never clears original failure or returns the Adapter to usable state.
Definite cleanup failure is classified before incomplete facts; all facts remain
in the report. No new stdout/exit-code contract is implemented here.

## Resource uncertainty and lifetime

Resources records NoResourcesConfirmed, Owned, Partial or Unknown at entry. No
backend Owner means scoped absence because this backend retains Owner before any
Native create call; this is not a Windows-wide observation. A retained Owner is
verified independently even without a successful create receipt. creation_attempted
is set immediately before CreateWindowExW. Without a live owned handle or recorded
destruction, an attempted create leaves Destroy Unknown. Never-attempted creation
can establish scoped absence. Missing receipt/handle never proves cleanup success.

If the Ledger is empty, bounded creator-thread enumeration and class/context
release can still proceed while retaining a prior Failed/Unknown destroy result.
Residual enumeration is restricted to the fixed QA class, process and creator
thread. Residual None/nonzero, live Ledger, class release failure, callback context
failure or owner release failure cannot become Succeeded. Unknown foreign resources
are never destroyed. A failed capability acquisition consumes this attempt and
returns Unknown, not a second attempt or implicit recovery.

Callback metadata is discarded only after empty live Ledger, actual zero residual
QA windows and successful own class unregistration. Discard preserves sequence,
token, Ledger tombstones and sticky fault; it does not reset a replacement budget.
TLS Ledger/Capture storage outlives the Owner. No asynchronous stack-local Owner
pointer is added. Drop remains best effort. Panic, abort, process termination,
foreign FFI behavior, TLS teardown, HWND ABA and query/use TOCTOU are not guaranteed
clean by this source contract.

Observation<Synthetic> and Observation<Native> remain distinct. Neither is a
CleanupProof. Failure cleanup never calls the proof verifier, creates a final
CleanupVerified event, or grants recreation. Existing normal Finalizer/proof order
is unchanged; final-drain-before-proof is explicitly deferred to 9B-3H-B.

## Changed files

- failure_cleanup.rs: typed resource/fact/status reporting and absence classification.
- creator_thread_failure.rs: independent terminal Host cleanup and combined report.
- creator_thread_operations.rs: existing normal operations and first-error recording.
- creator_thread_host.rs: sealed Backend capability seam and original-error latch.
- creator_thread_native_cleanup.rs: backend-bound Native cleanup capability.
- creator_thread_native.rs: cleanup terminal admission and delegation.
- native_owner_failure.rs: owner-bound identity checks and cleanup observations.
- native_owner.rs: retained origin/lease/create-attempt state and normal guard.
- native_owner_context.rs: post-retirement bounded callback metadata disposal.
- native_owner_capture.rs: bounded discard preserving sequence plus Synthetic test.
- native_contract.rs: exposes the QA-only cleanup observation module.
- native_contract_fake_cleanup.rs: tests reuse the existing Fake Ledger.
- creator_thread_host_fixture.rs: Synthetic backend capability/fault observations.
- creator_thread_host_tests.rs: includes failure suites.
- creator_thread_failure_tests.rs and creator_thread_failure_state_tests.rs: 27 Host scenarios.
- native_boundary_compile.rs: compile-only rejection probes, no new Cargo target.
- This document: verification and trust limits.

## Verification (2026-10-17)

Logs/products are outside the worktree under
C:/Users/Public/Documents/BOGUNON-9b3ha-output.

| Check | Observed result |
| --- | --- |
| New Host failure Synthetic scenarios | 27 passed |
| New destruction/absence Synthetic classification | 3 passed |
| New Capture overflow/discard Synthetic scenario | 1 passed |
| Full Library, including Ownership/Native/Async/Main/Host regressions | 376 passed |
| Existing protocol subprocess | 20 passed |
| Existing own Synthetic subprocess | 1 passed, existing 33 child cases |
| Isolated legacy pure regression | 27 passed, real Shell observation excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Windows non-test x86_64 object/metadata compile | Exit 0 |
| Type/API negative probes | 29 rejected with expected diagnostics |
| Scoped rustfmt / whitespace diff / protected-path audit | Passed; all 18 files QA-only |
| Independent goal / quality / security / Synthetic QA / context review | All five PASS |

The integrator ran cargo test --offline --locked --all-features --tests and cargo
check --all-features --all-targets using this QA manifest and external target dirs.
The import-only native_boundary_compile.rs was compiled with rustc --edition 2021
--target x86_64-pc-windows-msvc --crate-type lib --emit=metadata,obj and existing
serde/windows rlibs. It contains no executable entry and is not a Cargo target.
29 negative probes include the previous 21 plus cleanup observation promotion,
observation-to-proof conversion, private fields, capability Clone/Send/Sync/reuse.

Synthetic tests exercise the actual shared Host, Adapter, Main model and Fake
Ledger. Native error facts (class/context/release etc.) are injected observations;
these establish fail-closed reporting, not actual Win32 failure cleanup. In-flight
reentry cases explicitly set synchronous admission flags. The helper testing
attempted-create uncertainty is shared by the actual Native source. No Synthetic
result is promoted to a Native proof or Windows validation claim.

The integrator's runtime audit evaluated three hypotheses against Synthetic runs:

1. Fault/stop can strand resources behind normal admission: Host overflow/backend
   failure/stopped cases reject normal close/verify, then enter the independent
   cleanup path; terminal normal admission/replacement remain rejected.
2. Cleanup success can erase the lifecycle failure or Unknown resource state:
   first Overflow/Protocol remains in Report after cleanup, acquisition failures
   produce separate Unknown, and attempted creation without recorded destruction
   remains Unknown. Full authoritative Main equality survives success/failure.
3. A capability or observation can escape its trust boundary: cross-owner Fake
   capability is rejected; duplicate/reentry fail; actual non-test Native sources
   compile and 29 negative probes reject forgery/promotion/transfer/reuse APIs.

Independent QA separately observed 373 Library tests before the final three
absence-classification tests landed; the integrator's final complete run is 376.
Installed stable toolchain lacks Miri as recorded in the preceding checkpoint;
Miri/sanitizer/Native execution is not claimed. Existing dead-code warnings remain;
no blanket LSP-clean claim is made.

## Preserved boundaries and remaining P1

Existing own-window Runner/Gate/Evidence/stdout/exit codes, Native normal Finalizer,
Cargo targets/dependencies/lockfiles and Production files are unchanged. Existing
approval/artifact/Evidence files retain all 15 baseline SHA-256 hashes (rechecked). The 9B-1 tree's
pre-existing src-tauri/Cargo.toml change is not part of this work; Finance is untouched.

Remaining P1: final callback drain before final Native proof issuance (9B-3H-B),
actual bounded Win32 message pump/lifecycle validation, separate integrated Runner
and artifact-bound Gate/approval, and new Runner output/exit cleanup priority. They
are not implemented or approved by this checkpoint. Native cleanup may still fail
or stay Unknown; this work makes the safe attempt reachable and preserves evidence,
not a guarantee that all resources can always be released.
