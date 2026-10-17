# 9B-3C deterministic asynchronous Disposable Surface model

This checkpoint is pure synthetic Rust QA. It creates no native window, grants
no native creation permit, invokes no Runner/Gate, and starts no thread, timer,
message pump, Tauri instance, or production integration. Windows/WebView2 behavior
and actual cleanup are not verified. SyntheticDecision is a model observation,
never an effect request or native authorization.

## Ownership and events

AsyncSurface owns the existing Boundary, which owns the existing Router and
Surface lifecycle. The coordinator stores only the current exact Binding,
bounded event queue, command-admission latch, cleanup protocol stage and overflow
latch. It does not copy the lifecycle or expose mutable Boundary/Router access.
The test-only inspect method returns an immutable Authoritative reference.

Explicit events are CreateRequested, CreateCompleted, CreateFailed,
CloseRequested, CloseCompleted, SurfaceLost, CallbackArrived, CleanupStarted,
CleanupConfirmed, CleanupFailed and ReplacementRequested. CreateRequested is
accepted only for a never-created coordinator. ReplacementRequested is explicit
and uses existing create/retry_create and the shared three-retry budget.
No event automatically retries creation. A successful delayed create after a
close starts model disposal using the existing lifecycle; the returned Binding
is synthetic, not permission to execute native work.

The FIFO holds at most eight events. enqueue admits events; step processes one.
CloseRequested closes command admission immediately at enqueue, including
callbacks already queued ahead of it. Starting creation or replacement cannot
reopen admission while a close remains queued. CallbackArrived after close is
rejected on admission; process also rejects previously issued commands after
close. Overflow immediately latches Boundary fault and closes admission; no
queued callback can execute. There is no timeout or inferred success.

Every completion is checked against current instance, generation and operation
before calling Boundary. State/order guards reject duplicates and reverse
completions before the existing Boundary callback-fault path can poison a new
instance. Loss during disposal leaves disposal pending and unavailable; loss
before close remains Lost. Neither race manufactures a close completion.

## Cleanup and replacement

CleanupStarted requires a terminal lifecycle (Absent, Lost or Failed).
CleanupConfirmed requires the same exact binding and a Started cleanup stage.
Boundary confirmation remains a synthetic trusted assertion, never native
cleanup evidence, handle counts, or an inferred timeout success. Replacement is
blocked until confirmation. Failed disposal retains existing failclosed behavior.
Duplicate confirmations and stale old-instance/old-operation confirmations
cannot clear current failure. CleanupFailed latches Boundary protocol failure
and permanently prevents cleanup restart/confirmation in this coordinator.
Recovery from failed cleanup requires a separately designed explicit recovery
protocol with fresh cleanup-attempt identity; none is provided here. This avoids
mistaking a delayed confirmation from a failed attempt for a successful restart.

## Main revision authority

Authoritative now owns a monotonic projection revision. Trusted host update_main
changes only the Main aggregate count and revision, then refreshes Router's
projection in place. It preserves instance, generation, operation, retry budget,
lifecycle and command sequence. This method is absent from Surface events.
The event queue captures Main revision at admission. A callback queued before a
Main update is rejected at step before Router issues a command; it must be
submitted again against current admission state. An already-issued CommandRequest
is independently rejected by Boundary::process when its revision differs from
current Main. Denied issued requests are consumed, preserving normal queue order.
Main work data, unsaved input, authentication, permission, settings and progress
remain independent of Surface lifecycle failures.

## Evidence and limits

The first test was written and executed before implementation. Command:

`CARGO_TARGET_DIR=C:/Users/Public/Documents/BOGUNON-9b3c-output/target cargo test --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --lib async_surface`

Observed RED: E0432, crate::async_surface did not exist. Initial GREEN: one delayed
create test passed. Expanded candidate: 20 tests passed, zero failed. Scoped
rustfmt completed after splitting new runtime code into modules below 250 lines.

Design audit considered three concrete failure hypotheses: a queued creation
could reopen close admission; a stale completion could poison replacement via
Boundary; a stale revision could be stamped with a refreshed projection. Tests
cover admitted close through initial/replacement creation, old create/close and
wrong-operation completions, queued callback revision and already-issued request
revision. Review also identified cleanup-attempt ABA; terminal CleanupFailed
rejects both restart and delayed confirmation. These are synthetic model checks,
not observations of native runtime bugs.

The 20 tests additionally cover delayed create, close during Creating, immediate
loss, Main preservation, callback after close, replacement before close/cleanup,
explicit replacement after confirmation, failed creation, cleanup failure,
duplicate/reverse callbacks, overflow, both loss/close orders, old commands after
replacement, stale cleanup confirmation, shared retry exhaustion and trusted
Main update without resetting Router. Full regression, compiler checks and
independent review receipts follow below.

## Checkpoint verification receipts

Verified on 2026-10-17 against parent
`8951699f9f38c9ed8c9a9a9bd20306a628daad71`. Build output directories are outside
the worktree under `C:/Users/Public/Documents/BOGUNON-9b3c-output`.

| Check | Observed result |
| --- | --- |
| New async model scenarios, independently rerun | 20 passed |
| Existing Main Boundary scenarios | 21 passed |
| Complete synthetic library Harness | 249 passed |
| Existing synthetic subprocess fixture | 20 passed |
| Own synthetic subprocess fixture | 1 passed, 33 synthetic child cases |
| Fresh isolated legacy pure regression | 27 passed, 1 real-Shell test excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0, existing dead-code warnings |
| Scoped rustfmt and diff whitespace audit | Passed |
| Independent goal, quality, security, execution and context review | All five PASS |
| Protected approval/artifact/evidence files | All 15 hashes unchanged |

The integrator personally executed all 20 async scenarios against the actual
reused model. The three audit hypotheses above are covered by observed passing
tests, including both close-admission orders, stale completion rejection without
poisoning replacement, and both queued/issued revision rejection. No debugger
instrumentation or temporary source driver was added. Rust LSP daemon diagnostics
were unavailable in this session; compiler checks succeeded, and no LSP success
is claimed. Actual Native asynchronous behavior remains NOT VERIFIED.

Overflow recovery is not guaranteed: overflow after cleanup was already confirmed
leaves the coordinator blocked. No reset or automatic recovery is provided. A
future native adapter must define fresh, independently verified recovery identity.
