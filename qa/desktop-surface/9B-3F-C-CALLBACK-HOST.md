# 9B-3F-C Creator-thread Host / Callback Bridge

Scope: QA-only source implementation and deterministic Synthetic verification.
Baseline efaf54d075327898c61df682954a1ff53d7dbb48, requested branch, initially clean.
No new Runner, Gate, Cargo target, dependency, message loop or production connection.
Actual Windows lifecycle, Native proof issuance and Win32 dispatch are NOT VERIFIED.

## Structure and call flow

CreatorThreadHost is native_contract::creator_thread_host::Host<B>. It owns the
existing generic Adapter<B::Provenance>, sealed Backend, callback Bridge and pending
response. Adapter continues to own the existing AsyncSurface/Main Boundary/Router;
there is no second lifecycle state machine. Host and NativeBackend are Non-Send and
Non-Sync. Host records its creator ThreadId and checks each operation. Native Owner
independently verifies its actual creator thread before Native resource operations.

Requests are produced by Adapter, then copied out before Backend::dispatch. No
Coordinator or Ledger mutable borrow remains live across Native calls. Backend
responds after synchronous callbacks return. WndProc only records bounded notices;
it never calls Coordinator, Adapter or Host. Native Backend delegates resource work
to existing Native Owner and Finalizer; existing own-window Runner is untouched.

The previous 3F-B Synthetic-only Adapter/Outcome seam is generalized to Adapter<P>,
Outcome<P>, Response<P>. Default P remains Synthetic for all prior consumers.
Native receipts and CleanupProof<Native> stay distinct from Synthetic values.
Backend is sealed; external implementations cannot forge the trusted Native seam.
Envelope fields are private to the Host family and contain no HWND/PID/path.

## Callback provenance and lifetime

Actual Native callback flow is Ledger notice -> fixed-size Capture metadata ->
Owner drain correlation -> NativeBackend Envelope -> Bridge validation -> Adapter.
Capture stores token, immutable instance/generation/operation binding, sequence and
notice kind before callback return. It has sixteen slots, checked sequence arithmetic
and exact Ledger drain correlation. The backend stamps its retained OwnerReceipt
only after token/instance/generation checks. Bridge compares receipt Arc identity,
instance, generation and exact next callback sequence. Host matches the entire
pending operation binding and lifecycle/notice kind before completing a request.
Callback source is the sealed own-WndProc path; it is not caller input.

TLS stores Ledger, Capture and CallbackGate through creator-thread lifetime. Ledger
tombstones and the two-reservation budget are not reset for replacement. Only empty
capture metadata can begin a new token. No owner address is stored in HWND or queued.
The existing stack token is used only as a synchronous CreateWindowEx creation
parameter address; asynchronous metadata contains owned Binding values, not that
pointer. Owner Drop is best effort, never proof issuance or cleanup confirmation.

## Pump, cleanup and races

pump(budget) is bounded notice transfer, with a budget of 1..=16. It does not call
GetMessage, PeekMessage, TranslateMessage or DispatchMessage and never waits. A future
creator-thread Win32 dispatcher must use a bounded nonblocking iteration, return
from callbacks, then invoke this transfer boundary. No OS message-pump implementation
or execution is claimed here. Reentry, overflow, budget exhaustion and backend faults
latch Unknown and close admission. stop() stops delivery separately from cleanup;
it does not destroy resources, release an owner or issue a proof. A stopped/faulted
Host has no automatic retry or recovery. Cleanup should be explicitly completed
before normal delivery shutdown; otherwise resources remain quarantined/best effort.

Create while close is pending retains the original create response until its exact
Created notice; Adapter then produces the existing disposal request. CloseCompleted
requires its exact captured Destroyed notice. An unsolicited loss or conflicting
close/loss notice becomes Unknown; completion is never inferred from missing events.
Cleanup requires terminal lifecycle and no pending create/close. Host drains callback
notices before Finalizer. Finalizer now rejects undelivered Ledger/Capture entries.
A received CleanupVerified proof remains pending until the next bounded pump verifies
quiet delivery; only then does Adapter receive CleanupConfirmed and Bridge retire.
Owner::released_quiet, invoked by NativeBackend::drain, independently checks creator thread, TLS fault, inactive
lease, cleared token/handle, idle callback gate and empty capture after finalization.
Replacement before proof delivery, after failure/Unknown or after stop is rejected.

Abort, process termination, panic, TLS destruction and foreign OS behavior cannot
be guaranteed clean by this model. Callback ABI panic boundaries remain in place.
Separate HWND queries/use are not atomic; ABA/TOCTOU remain Native validation risks.
No operational Main HWND, Tauri/WebView2 or user data is accessed by this implementation.

## Files

- creator_thread_host.rs: shared orchestration and bounded delivery interface.
- callback_bridge.rs: opaque provenance envelope and owner/sequence validation.
- creator_thread_native.rs: source-only actual Native Owner backend.
- native_owner_capture.rs: shared fixed-capacity callback capture and pure tests.
- native_owner_delivery.rs: exact capture drain and post-release quiet checks.
- creator_thread_host_fixture.rs and creator_thread_host_tests.rs: Synthetic Host scenarios.
- native_adapter.rs and native_contract.rs: provenance-preserving existing model seams.
- native_contract_fake.rs: bounded retrieval of existing synthetic Ledger notices.
- native_owner.rs, native_owner_context.rs, native_owner_finalizer.rs: capture integration.
- native_boundary_compile.rs: import-only actual Windows compile and rejection probes.
- This document: implementation scope, verification and limits.

## Checkpoint verification (2026-10-17)

All products/logs are outside the worktree under
C:/Users/Public/Documents/BOGUNON-9b3fc-output.

| Check | Observed result |
| --- | --- |
| New shared Host Synthetic scenarios | 28 passed |
| New shared callback Capture Synthetic scenarios | 5 passed |
| Full Library including Ownership / Native / Async / Main regressions | 345 passed |
| Existing protocol subprocess | 20 passed |
| Existing own synthetic subprocess | 1 passed, 33 child cases |
| Fresh isolated legacy pure regression | 27 passed, real Shell observation excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Actual non-test Windows x86_64 source object/metadata compile | Exit 0 |
| Type/API rejection probes | All 21 rejected with expected diagnostics |
| Scoped rustfmt / diff whitespace audit | Passed |
| Independent goal / quality / security / Synthetic execution / context review | All five PASS |

Cargo uses --offline --locked --manifest-path qa/desktop-surface/Cargo.toml.
The full regression command uses cargo test --all-features --tests; checks use
cargo check --all-features --all-targets. The import-only native_boundary_compile.rs
root is compiled by rustc --edition 2021 --target x86_64-pc-windows-msvc
--crate-type lib --emit=metadata,obj with existing serde/windows rlibs. It is not a
Cargo target and has no executable entry point. Negative probes reject owner/Host
Send/Sync, Synthetic/Native receipt/response/envelope promotion, private proof or
envelope construction, external Backend implementations and non-test Main inspection.

The integrator personally drove the full Synthetic suite. Runtime audit examined:

1. Old callback metadata could be relabeled as a new owner: actual shared Capture
   records before delivery; token, exact drain correlation, late/stale/replayed
   Host envelopes and retained Ledger/tombstone scenarios reject those inputs.
2. Close/loss or delayed proof could permit replacement: both competing callback
   arrival orders, pending cleanup confirmation, callback after cleanup and pump
   stop/failure remain blocked and preserve full authoritative Main equality.
3. Generalizing Adapter provenance could permit Fake Native proof or break non-test
   paths: all old model/subprocess regressions pass, actual Windows source compiles,
   and the 21 compile rejection probes enforce closed ownership/proof/Host boundaries.

Independent QA identified that the original Close/Loss test duplicated wrong-ticket
coverage. It was replaced by two genuine competing callback orders and rerun. The
Synthetic fixture now uses the same Capture::begin/record/drain implementation as
the actual Native callback path, fed by existing Fake Ledger notices; it does not
copy the capture sequence algorithm. Actual Native proof success is never tested
or claimed by this Synthetic path.

Existing dead-code warnings remain visible; no LSP-clean claim is made. Installed
stable toolchain does not provide Miri (confirmed in prior 3F-B checkpoint); no Miri
or sanitizer/Native execution is claimed. Actual Windows/TLS teardown/abort/FFI/OS
message ordering and HWND ABA/TOCTOU validation remain future separately approved work.

No old own-window Runner/Gate/store, Cargo target/dependency/lockfile or Production
file changed. Prior approval/artifact/Evidence files are preserved. The separate
9B-1 checkout retained its observed src-tauri/Cargo.toml modification untouched;
MY FINANCE checkout was clean when inspected. No push or PR is created.
