# 9B-3H-C Pure Phase and Pump Stop Contract

Baseline: codex/desktop-surface-core-9b2a at
f1c15af36e5d49b41a4bb25712594eb5fb54996f, initially clean.
This checkpoint implements QA-only pure contracts and Synthetic verification.
Actual Windows Native behavior, queue noninterference and OS dispatch are
NOT VERIFIED. No execution approval is created or reused.

## Phase contract

`native_contract::pump_phase::Phase<P>` models:

LiveOwner -> DispatchAdmissionClosed -> NativeFinalizing -> FinalDrainPending
-> PumpStopPending -> PumpStopped.

Every transition checks the exact OwnerReceipt, full planned cleanup Request
(instance, generation, operation, request sequence, expected lifecycle state),
and consecutive phase event sequence. Overflow, stale input, duplicate input,
wrong state or identity mismatch closes admission. Failed/Unknown are terminal;
the first failure remains recorded and pending A/proof values are discarded.
There is no retry, recreation, Drop proof, OS call, message retrieval, or thread.

The initial request is a pure planned correlation key. It must be a nonzero
VerifyOwnSurfaceCleanup request for the same owned instance/generation, with a
cleanup operation distinct from creation and expected state Absent. It is not
issued by the live Adapter, a live HWND observation, or an actual dispatch permit.
This narrower normal-close model does not authorize recovery from Lost/Failed.

`dispatch_allowed()` is true only in LiveOwner. `callback_delivery_allowed()`
remains true through FinalDrainPending, including after dispatch admission closes.
These predicates describe the model only; they are not wired to a Native host.
Existing Host::stop is unchanged and is not used as the admission-close operation.

## A, B, C and compatibility

A is the existing opaque Native finalization observation. B is the existing
opaque final callback drain observation scoped to ObservableCallbackQueue.
The Phase accepts A then B through the unchanged private A+B verifier, keeping
the resulting CleanupProof private. It does not return that proof.

C is an opaque, non-Clone PumpStopObservation<P> bound to owner, full request,
phase-specific Rc identity and the terminal sequence. It records dispatch
admission closed, zero in-flight dispatch, callback delivery complete, stop reason,
and explicit budget/deadline checks. Only Requested + completed checks is accepted.
UnexpectedQuit, budget/deadline exceeded or Unknown, pump/native/cleanup failure,
and failure-cleanup completion cannot produce a successful C.

`Phase::admit` consumes matching C and the held A+B proof, returning a distinct
opaque, non-Clone IntegratedAdmission<P>. It exposes only a correlation check,
not a proof extraction/conversion. Cross-phase C is rejected even when owner and
request are identical. A failed stop attempt cannot be retried into success.

C does not attest an empty OS queue, absence of future external messages, thread
termination/join, actual Windows cleanup, or externally measured callback timing.
Budget/deadline inputs are explicit Synthetic checks, not elapsed-time enforcement.

Native and Synthetic provenance remain distinct. C construction exists only in
cfg(test) Phase<Synthetic>. There is no Native C constructor, Native stop method,
dispatcher, or Native IntegratedAdmission issuance path. Arbitrary StopFacts
therefore cannot mint Native success. Receipts are thread-confined via Rc.

The legacy Native A+B verifier, Backend/Host completion, Coordinator confirmation,
and existing replacement behavior are unchanged. The new A+B+C admission is a
contract for a future separate integrated Runner; it is not enforced by the
existing Backend/Adapter. No new Runner or operational connection is implemented.

## Failure Cleanup

The existing independent Failure Cleanup capability and observations are unchanged.
Its success is not a normal proof or C. Phase failures discard held proof and
block normal integrated admission. Later failure-cleanup/stop input cannot erase
the original failure. Cleanup failure/Unknown remains separate from Pump Stop;
neither successful cleanup nor Drop changes a failed stop into success.

New Phase tests model the failure indication; they do not execute Native cleanup.
The existing Host final-drain and Failure Cleanup regressions separately exercise
the real pure Fake/Host path and reject proof/replacement after failure cleanup.
Main has no mutation or ownership connection in the new contract. Existing Main,
Async, Ownership, Native, Host and failure regressions run in the full Library.

## Files

- pump_phase.rs: pure phase admission and integrated completion.
- pump_stop_facts.rs: explicit stop reason/check conditions.
- pump_phase_synthetic.rs: test-only Synthetic C issuer.
- pump_phase_tests.rs and pump_phase_edge_tests.rs: 32 new Synthetic scenarios.
- native_contract.rs: module declaration only.
- native_pump_phase_compile.rs: twelve negative type/API probes.
- native_boundary_compile.rs: import-only probe registration.
- This document: scope, compatibility, evidence and unresolved risks.

## Verification

External logs/products: C:/Users/Public/Documents/BOGUNON-9b3hc-output.
The implementation worker's initial failing-first logs remain externally in
9b3hb-output/phase-red.txt and phase-green.txt. The initial compile-only red failed because Phase API/types were absent
(exit 101); no behavioral assertion ran in that red execution. The completed
targeted suite passes all 32 cases.

| Verification | Observed result |
| --- | --- |
| New Phase Synthetic | 32 passed |
| Complete Library, including existing A+B/failure/Main/Host regressions | 443 passed |
| Existing own Synthetic subprocess | 1 passed (existing 33 child cases) |
| Existing protocol subprocess | 20 passed |
| Isolated existing pure production regression | 27 passed; actual Shell case excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Non-test Windows x86_64 object/metadata compile, no entrypoint | Exit 0 |
| Existing negative type/API guards | 45 expected rejections |
| New C/admission negative guards | 12 expected rejections |
| Independent QA Library rerun | 443 passed |
| Scoped rustfmt / diff audit | PASS; nine QA-only changed/new files |
| Protected approval/artifact/Evidence hashes | All 15 unchanged |
| Existing Runner/Cargo source hashes | Unchanged |
| Independent goal / quality / security / QA / context source review | Five PASS |

The integrator personally ran the complete Synthetic/subprocess suite and the
isolated pure regression. No Native binary or Win32 source was executed.
Existing dead-code/model-unused warnings remain; no warning-free, Miri, sanitizer
or blanket LSP-clean claim is made. All touched Rust modules are at most 250
nonblank, noncomment lines. Compile products are outside the worktree.

Three distinguishing runtime hypotheses were checked against actual pure calls:

1. Early/out-of-order C could admit replacement: C-before-A/B, incomplete callback
   delivery and dispatch admission/in-flight cases reject and discard held proof.
2. A valid-looking stale C could cross ownership/operation/phase boundaries:
   exact owner/request, generation/operation, sequence and same-owner different
   Rc phase tests reject; compiler probes reject provenance promotion and reuse.
3. A later cleanup or quiet input could erase failure: original failure remains,
   duplicate/failed stop cannot admit, and existing Host Failure Cleanup tests
   preserve the separate no-proof terminal path and Main-state regressions.

## Preserved boundaries and remaining work

Existing Runner, Gate, Evidence, Cargo targets/dependencies/lockfile, Production,
Tauri/WebView2, prior approval/artifact/Evidence and unrelated worktrees are
unchanged. No push or PR. This checkpoint has no OS dispatch or Native permit.

Remaining Windows issues include external queue producers, queue ownership,
PeekMessage identity/removal TOCTOU, HWND ABA, synchronous callbacks, late messages,
and proving strict nonconsumption of unexpected messages. No dedicated QA thread
or join is implemented. The OS dispatcher remains deferred until noninterference
can be established without weakened assumptions. A future integration must provide
trusted Native C observations and couple integrated admission to its own Runner,
Gate and separately authorized Native validation.
