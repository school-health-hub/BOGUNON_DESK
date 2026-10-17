# 9B-3H-B Final-Drain-Bound Native Proof

QA-only source contract and Synthetic verification, 2026-10-18. Baseline branch
codex/desktop-surface-core-9b2a, HEAD 8eeac87429c029a42dd58f69b2722d1c9af7ff91,
initial working tree clean. Actual Native Windows behavior is NOT VERIFIED.
No Native Runner, Windows window, Win32 message dispatch, Explorer/WorkerW query,
operational Main HWND, Tauri/WebView2 or user data was accessed/executed.

## Reproduction and new order

Baseline source order was Owner release -> Native Proof -> backend released_quiet
in a later Host pump -> Adapter/Coordinator CleanupConfirmed. A failing-first
Synthetic Host test reproduced the early proof: immediately after verify_cleanup,
Host.pending already contained CleanupVerified before the later drain. Observed red
exit 101 is recorded in 9b3hb-output/red-order.stdout; no Native execution occurred.
The same test now passes because dispatch returns CleanupPending without a proof.

New actual source order:

1. Owner::finalize checks the existing cleanup request/OwnerReceipt, recorded
   destruction, empty live Ledger, residual own QA windows Some(0), own class
   release, callback context cleanup and TLS owner lease release.
2. It returns opaque FinalizationObservation<Native> (A). Backend retains A and
   returns CleanupPending. No proof or CleanupConfirmed exists at this point.
3. A later successful Host::pump completes bounded notice delivery and rejects
   late/conflicting envelopes. Host asks Backend::complete_cleanup only after an
   empty successful transfer, without holding Adapter/Ledger mutable borrows.
4. Owner::final_drain checks creator thread, the exact A stamp/receipt/binding,
   terminal failure-cleanup state and one-attempt admission. It observes released
   quiet state, drains the current callback queue with a 1..16 budget, checks quiet
   state again and verifies no live Ledger/creation/context remains.
5. Opaque FinalDrainObservation<Native> (B) is created. Only the private pair verifier
   can consume A+B and issue CleanupProof<Native>. Host then validates the response
   and Adapter emits the existing Coordinator CleanupConfirmed. Bridge retires.

The backend distinguishes resource release from proof issuance. Even direct Native
backend create admission requires proof_issued for a previous owner, not just release.
Host rejects CleanupVerified returned early from ordinary dispatch. A failed final
drain, stopped/faulted host, Unknown or failed proof verification cannot authorize
replacement. There is no retry, new lifecycle machine or automatic recreation.

## Opaque observation and proof trust

A holds validated finalization facts, the immutable owner receipt, exact cleanup
request, a unique Rc correlation stamp and a one-shot drain-attempt Cell. B holds
that same owner/request/stamp plus creator-thread/drain facts. A and B are not Clone
and are Non-Send/Non-Sync. Proof issuance consumes both values. A failed B attempt
also consumes its admission; a later quiet input cannot turn it into a retry.

Native A construction requires the actual Finalizer's private Finalized value.
Native B construction requires Owner's private Drained value and matching A. Arbitrary
DrainFacts are accepted only by the cfg(test) Synthetic constructor. Private fields
and provenance parameters prevent arbitrary boolean Native construction or Synthetic
promotion. The verifier checks owner, stamp, full Request (instance/generation/
operation/sequence/expected state), creator thread, owner release, quiet queue,
no overflow/reentry, completed budget and known outcome; it revalidates A facts too.

FinalizationReceipt<P> remains a cloneable internal facts object, but generic direct
verify was replaced with validate returning no proof. The legacy verify method is
Synthetic-only for existing Fake regressions; FinalizationReceipt<Native>::verify
no longer exists. Already-issued CleanupProof remains cloneable under the existing
Response contract, but cloning does not mint a new proof or bypass Adapter's exact
pending request/owner checks and single consumption. New A/B issuance is linear.

## Scope of final drain and remaining uncertainty

DrainScope::ObservableCallbackQueue is the only supported scope. Final drain checks
presently observable QA callback Ledger/Capture notices and sticky fault/reentry
state, after owner release. It is not a Win32 message pump, pump termination receipt,
or a promise that the OS will never deliver another message. No GetMessage,
PeekMessage, TranslateMessage or DispatchMessage implementation was added.

The actual Native B constructor checks observable facts; it does not substitute
Synthetic values. Sticky callback faults and retired Ledger identities remain.
Panic/abort/process termination, TLS teardown, foreign behavior, HWND ABA and separate
query/use TOCTOU are not resolved or validated by these Synthetic tests. Actual
Windows dispatch and termination observation require a later separately approved step.

## Failure Cleanup preservation

The independent 9B-3H-A path, capability/Owner identity checks and observation-only
result remain. Its success does not issue A/B/Proof or CleanupConfirmed. Entering
failure cleanup closes normal proof completion through cleanup_issued and Host stop/
fault admission. Main authoritative data, unsaved input and authentication remain
owned by the existing model and are preserved on successful and failed final drains.

## Changed files

- final_drain_contract.rs: opaque A/B, scope, one-shot drain and common pair verifier.
- final_drain_contract_tests.rs: 23 shared Synthetic receipt/verifier scenarios.
- ownership_finalization.rs: fact validation separated from Synthetic-only proof API.
- native_contract.rs: CleanupPending and the new QA contract module.
- native_contract_fake_cleanup.rs: existing observation builder reused, no early
  Synthetic proof in the new Host seam; Fake marks cleaned after pair verification.
- native_owner_finalizer.rs: Native cleanup/release produces only A.
- native_owner_drain.rs: private Native post-release callback drain produces B.
- native_owner.rs: retains A correlation stamp and one-attempt drain admission.
- native_owner_delivery.rs: creator-thread helper moved here to keep module size bounded.
- creator_thread_native.rs: retains A and distinguishes release from proof issuance.
- creator_thread_native_completion.rs: consumes A+B before the Native proof response.
- creator_thread_host.rs: pending observation admission and early proof rejection.
- creator_thread_host_drain.rs: later successful pump completes proof delivery.
- creator_thread_host_fixture.rs: Synthetic A/B backend delegation.
- creator_thread_final_drain_fixture.rs: uses the same pair verifier and Fake Ledger.
- creator_thread_host_tests.rs: includes the new Host scenarios.
- creator_thread_final_drain_tests.rs: 12 end-to-end pure Host ordering/failure scenarios.
- native_boundary_compile.rs: updated sealed Backend probe and import-only guard module.
- native_final_drain_compile.rs: 16 new type/API rejection probes.
- This document: scope, evidence, trust boundary and remaining risks.

## Verification evidence

Logs and compiler products are outside the worktree under
C:/Users/Public/Documents/BOGUNON-9b3hb-output. Test/check compilation uses existing
external target directories; no generated output or new target enters the repository.

| Check | Observed result |
| --- | --- |
| Failing-first Host early-proof reproduction | Failed assertion as expected, exit 101 |
| New shared receipt/verifier Synthetic scenarios | 23 passed |
| New Host final-drain Synthetic scenarios | 12 passed |
| Complete Library incl. Failure Cleanup/Ownership/Native/Async/Main/Host | 411 passed |
| Existing own Synthetic subprocess | 1 passed, existing 33 child cases |
| Existing protocol subprocess | 20 passed |
| Fresh isolated legacy pure regression | 27 passed, real Shell observation excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Actual non-test Windows x86_64 object/metadata compile | Exit 0 |
| Native type/API negative guards | 45 expected rejections (29 existing + 16 new) |
| Independent Synthetic QA | Separately reran Library: 411 passed |
| Scoped rustfmt / diff audit / protected hashes | PASS; 20 QA-only files, all 15 hashes unchanged |
| Independent goal / quality / security / QA / context review | All five PASS |

The integrator personally ran cargo test --offline --locked --all-features --tests
and cargo check --all-features --all-targets with qa/desktop-surface/Cargo.toml.
An initial check in a cold output directory hit the tool's 60-second timeout and
was not treated as PASS; the final check used the previously populated external
check target and exited 0. Independent QA also completed its own Library execution.
Existing dead-code warnings remain; no warning-free or blanket LSP-clean claim.

Actual Windows sources were compiled, not run, using the import-only
native_boundary_compile.rs root, rustc --edition 2021 --target
x86_64-pc-windows-msvc --crate-type lib --emit=metadata,obj with existing serde/windows
rlibs. New probes reject Synthetic-to-Native A/B promotion, raw fields/constructors,
Clone/reuse/transfer, finalization-only or drain-only proof, Owner::finalize returning
proof, and the old Native direct verify API. The root has no executable entry and
is not a Cargo target. No Native proof issuance success was observed on Windows.

Shared verifier tests inject explicit Synthetic drain facts and corrupt internal
Synthetic receipts to challenge owner/request/generation/operation correlation.
They execute the same verifier used by Native. Host tests additionally transfer an
actual retired Synthetic envelope after A, exercise actual Host admission on reentry
and zero budget, and reject duplicate Backend completion. These establish pure
contract behavior, not actual OS callback/overflow/class/lease observations.

The runtime audit used three distinguishing hypotheses:

1. Early proof remained observable before the final pump: the failing-first Host
   assertion reproduced it; the same assertion and full final suite now pass with
   CleanupPending. Native Owner::finalize cannot type-check as a proof-returning API.
2. Cross-owner/stale/replayed observation could mint proof: the shared verifier
   rejected owner/stamp/instance/generation/operation/request mutations, repeated
   drains and failed-drain retry; linear Native receipt probes rejected reuse.
3. Callback/pump failure after release could still confirm cleanup: actual pure
   Host late-envelope, reentry, zero-budget, overflow, Unknown and stop scenarios
   denied proof/replacement; full Main equality and Failure Cleanup regressions pass.

Stable Miri availability was absent in the prior checkpoint; no Miri, sanitizer,
actual Windows lifecycle, message dispatch or Native cleanup validation is claimed.

## Preserved scope and remaining P1

Existing own-window Runner/Gate/Evidence/stdout/exit-code sources, Cargo targets,
dependencies, lockfiles, Production/Tauri/frontend and existing approval artifacts
are unchanged. All 15 prior approval/artifact/Evidence SHA-256 hashes match the baseline snapshot.
The separate 9B-1 tree's previously observed src-tauri/Cargo.toml modification is
untouched; the MY FINANCE checkout is untouched. No push or PR is created.

The Native proof ordering P1 is addressed at the current observable callback queue
boundary. Remaining work includes a real bounded creator-thread Win32 dispatcher,
its explicit termination observation/receipt, separately approved integrated Runner
and artifact-bound Gate, and new Runner cleanup/output/exit failure precedence.
Windows-specific callback ordering, resource finalization, TLS teardown, late OS
messages, panic/abort and HWND ABA/TOCTOU still require separately authorized Native
validation. This checkpoint is not Live execution approval or operational readiness.

All touched Rust modules are at most 250 pure LOC. Existing Host tests reach 250;
future additions should continue in the separate test modules instead of growing
that file. Native Owner remains 246 and its next expansion should use its existing
responsibility-specific child modules.
