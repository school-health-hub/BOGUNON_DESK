# 9B-3D: Synthetic native boundary contract

This candidate is pure Rust QA code. It runs the existing Disposable Surface, Main Boundary, Router, AsyncSurface, and own_callbacks::Ledger. It does not bind the native runner, create windows, call Windows APIs, start threads or timers, inspect user data, or issue a native permit. Fake integer identities and handles are internal constants; the request API accepts no HWND, process ID, thread ID, path, or Shell target.

## Request and response protocol

The only request kinds are CreateOwnSurface, BeginCloseOwnSurface, and VerifyOwnSurfaceCleanup. Each immutable envelope carries the complete opaque Surface Binding (instance identity plus generation/operation ticket), a checked monotonically increasing request sequence, and the actual expected lifecycle State. Adapter owns the real AsyncSurface and one pending envelope; it does not duplicate the lifecycle state machine. It exposes immutable state/Main inspection, bounded callback enqueue/step, command processing, and explicit lifecycle admission methods, without mutable AsyncSurface access.

CreateSucceeded carries an opaque owner receipt allocated by the synthetic owner. CreateFailed is a distinct terminal result. CloseStarted is an acknowledgment for the exact close envelope: it does not complete disposal. CloseCompleted is accepted only after that acknowledgment for that same envelope. SurfaceLost, CleanupVerified, CleanupFailed, and NativeOutcomeUnknown remain distinct. Missing response or timeout is supplied explicitly as NativeOutcomeUnknown; no elapsed-time inference exists.

Close while Creating closes callback/command admission immediately through the existing AsyncSurface CloseRequested behavior. It emits no native close request until a successful create result actually transitions AsyncSurface into Disposing. Duplicate deferred close admission faults permanently. CleanupStarted is applied only in a terminal model state and produces a separate verification request. Neither close acknowledgment nor cleanup implies a missing close completion.

Response equality checks the entire request envelope and expected state before applying a real AsyncSurface event. Duplicate, reverse-stage, stale, wrong-instance, wrong-ticket, wrong-sequence, unknown, and conflicting requests latch permanent adapter fault. The narrow AsyncSurface native_fault seam closes commands and creation without fabricating any lifecycle completion. There is no automatic retry. Explicit replacement uses AsyncSurface's existing cleanup gate and retry behavior. The actual Ledger retains its two-reservation lifetime budget; a third native allocation attempt fails closed even after successful prior cleanups.

Callbacks use the existing bounded AsyncSurface queue and actual Router. step_callback returns the actual SyntheticDecision. Control dispatch rejects queued callback conflicts before processing commands; close and loss first close command admission and drain the expected Closed rejections before their own control event. Queue overflow permanently faults. Fake callback overflow fills the actual Ledger notice queue and delivers an explicit unknown response through the adapter boundary.

## Cleanup trust boundary

CleanupProof has private fields and is constructed only in the nested native-contract verifier. The synthetic Fake owns its actual Ledger and a retained ownership record captured after successful reserve/register. Its verifier and retained Ownership type are private. Retirement preserves the original token, exact binding, owner identity, creator thread, class, PID, and TID observations; Ledger.live becomes None only through actual Destroyed notice processing. Cleanup verification requires matching retained owner/token/binding/class/PID/TID, matching creator/current thread, successful destruction observation, empty own Ledger, remaining own windows exactly Some(0), and separately observed owner release.

The proof binds the full verification request, including sequence, plus the accepted creation's opaque owner receipt. Arc pointer identity retains allocation ownership; value equality of Arc<()> is deliberately not used. A second Fake executing a cloned Surface request cannot substitute its cleanup proof for the owner whose CreateSucceeded was accepted. Fault injections alter observed facts before running the same verifier; they do not inject a success flag directly into Adapter.

All of these observations are synthetic assertions produced by the in-memory Fake. This demonstrates model correlation and gating, not Windows trust or actual cleanup. A future native path must independently gather creator-thread, ledger, identity, destruction, remaining-window, and owner-release facts. It must not accept caller-reported booleans as platform evidence. Failed creation without an enrolled owner has no synthetic destruction proof; cleanup fails closed rather than pretending a window was destroyed or permitting replacement.

## Verification and provenance

Targeted command:

~~~text
CARGO_TARGET_DIR=C:/Users/Public/Documents/BOGUNON-9b3d-output/target cargo test --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --lib native_contract
~~~

Result: 22 tests passed, 0 failed, 249 filtered. The table-driven cleanup test independently exercises wrong creator thread, token, class, PID, TID, owner identity, failed destruction, unknown/nonzero remaining windows, failed owner release, and unknown outcome. Other scenarios cover normal staged create/close/cleanup and replacement, failed/partial creation, deferred and duplicate close, acknowledgment versus completion, stale/duplicate/reverse responses, exact binding dimensions, stale proof, unknown/no response, reentrant create, actual Ledger and Async queue overflow, real callback routing, available-surface loss, lifetime allocation budget, and complete Main Authoritative equality across normal and hostile paths.

Initial compile red exposed absent modules/imports and is recorded only as setup provenance. A subsequent behavioral red, native_contract_owner_swap_proof_is_rejected, failed with assertion result.is_err() before owner receipts were checked; after private owner receipt/proof correlation it passed. This is not a claim that every test was individually developed red first. The generation test keeps the instance unchanged and transplants a valid replacement ticket, which differs in generation and operation; it does not claim independent mutation of private ticket fields. The operation test transplants a valid generation-one creation ticket into the generation-one disposal envelope.

Runtime code and tests contain no unsafe code or added dependencies. Legacy native execution/gates/cleanup, Cargo manifests/lockfile, production/frontend/Tauri files, and evidence are outside this candidate's scope.

## Checkpoint verification receipts

Verified on 2026-10-17 against parent 2ca42d8cce4d1faec94d508029330e4728c77aa0.
Build outputs are outside the worktree under C:/Users/Public/Documents/BOGUNON-9b3d-output.

| Check | Observed result |
| --- | --- |
| New Native boundary Synthetic scenarios | 22 passed, independently rerun |
| Complete synthetic library Harness | 271 passed |
| Existing Async Coordinator / Main Boundary | 20 / 21 passed, subsets of Harness |
| Existing protocol subprocess | 20 passed |
| Own synthetic subprocess | 1 passed, 33 child cases |
| Fresh isolated legacy pure regression | 27 passed, 1 real-Shell test excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0, existing dead-code warnings |
| Scoped rustfmt / diff whitespace audit | Passed |
| Independent goal / quality / security / context / Synthetic execution review | All five PASS |
| Protected approval, artifact and Evidence files | All 15 SHA-256 values unchanged |

The integrator personally exercised all 22 contract tests against the actual
adapter, AsyncSurface and Ledger. Runtime audit tested three hypotheses:
(1) stale, duplicate or reverse replies might advance the current lifecycle;
(2) incomplete or substituted owner cleanup might release replacement;
(3) queued callbacks, unknown outcomes or overflow might bypass close/fault.
The executed negative cases reject those transitions while preserving Main.
Callback overflow was strengthened after review: an acknowledged close remains
pending, the actual seventeenth Ledger notice produces NativeOutcomeUnknown,
and the exact correlated reply faults with Order rather than Correlation.
Focused and full suites passed again after that test change.

No debug instrumentation or temporary source driver remains. New modules each
own one protocol responsibility; boundary values are typed and proofs opaque.
Adapter (225 nonblank/noncomment lines), Fake (218), and hostile tests (205)
are in the 200-250 warning band; split by responsibility before future growth.
The Fake has no standalone permanent failure latch: fail-closed guarantees apply
to the Adapter-mediated protocol, not direct fabricated Fake-only sequences.
Successful cleanup recovery after loss or unenrolled failed creation is not
provided. Actual Native cleanup, Windows async behavior and WebView2 preservation
remain NOT VERIFIED. No Native Runner, Runtime Gate or operating application ran.
