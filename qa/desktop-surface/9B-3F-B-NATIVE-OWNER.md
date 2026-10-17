# 9B-3F-B Native Owner / Finalizer source boundary

This is QA source implementation and Synthetic verification only. No new execution
target, Gate, message pump, Native Runner, or Tauri integration is added. Actual
Windows creation, destruction, callbacks and Native proof issuance are NOT VERIFIED.

## Ownership and issuance

`native_contract::native_owner::Owner` is creator-thread-bound by `PhantomData<Rc<()>>`.
Its constructor is restricted to the contract family. Requests contain only the
existing exact instance/generation/operation/sequence/state envelope; no external
HWND, PID or path is accepted. Only fixed `BOGUNON_9B3FB_INTEGRATION_OWN_QA` registration
and hidden, parentless own-window creation are implemented. Registration failure
never unregisters a pre-existing class. Ledger reservation precedes registration
and creation. WM_NCCREATE requires the exact synchronous creation-parameter address.

The private `Created` fields contain actual class atom/PID/TID observations, a
creator-thread Ledger token and original creation binding. Consuming `Created`
issues one immutable Native owner receipt. Synthetic owner/finalization/proof
brands cannot be promoted. Fake Native has neither Created nor Finalized constructor.
Existing Synthetic Adapter and Outcome stay Synthetic; no Native host is connected.

## Finalization

BeginClose validates the exact envelope, changes only the owned Ledger disposal
binding, rechecks token/class/module/PID/TID and calls DestroyWindow on that owned
handle. A successful return alone is insufficient: NCDESTROY must retire the live
Ledger entry and clear the callback handle without callback faults. Finalization
requires that retained destruction observation, exact owner/request, no live
Ledger entry, successful creator-thread enumeration with own-class count Some(0),
successful own-class unregistration, drained bounded notices, idle callback gate,
cleared expected creation parameter/token and release of the active owner lease.
Only then can the opaque Finalized observation reach the private Native verifier.
Post-release verification failure latches the thread fault before another owner
can be admitted. Finalization is attempted once; no automatic retry or replacement
permit is provided.

`owner release` means release of the native-resource lease after window/class and
callback routing are detached. It does not mean destruction of all Rust receipt
clones. A retired Owner cannot drain a later owner's notices.

## Callback lifetime and failures

Callback context is thread-local, not an owner pointer stored in HWND. It remains
allocated through the creator thread lifetime; Ledger tombstones and its two-create
budget are never reset on replacement. WndProc records bounded notices only and
never calls a Coordinator. The shared callback gate rejects reentry. RefCell guards
are released before every native call. Callback/panic failures are caught at the
system ABI boundary; the fault fallback uses try_with during TLS teardown.

Partial create, identity mismatch, overflow, unknown native outcome or any cleanup
failure retains/quarantines the active context and prevents a new owner. Drop only
attempts best-effort destruction when possible; it never issues proof, releases a
quarantined owner or retries a failed finalization. Process termination, abort,
TLS teardown and unexpected native failure cannot guarantee cleanup.

Identity checks narrow HWND ABA and TOCTOU exposure, but cannot make separate OS
query/use calls atomic. The two-entry tombstones deliberately reject numeric handle
reuse rather than adopt it. No actual async close/loss timing is verified without
a message pump. Native integration, a new artifact-specific Gate/approval, and
Windows lifecycle/sanitizer validation remain separate future work. This stage
executes only Synthetic policy/Ledger/receipt tests and compile-only Windows source.

## Checkpoint validation (2026-10-17)

Baseline: 9ba51b3a363aeb013e2d28860082a16496a1b1b5, exact requested branch,
initially clean. Build/test products and diagnostic logs are isolated under
C:/Users/Public/Documents/BOGUNON-9b3fb-output, outside the worktree.

| Check | Observed result |
| --- | --- |
| New shared owner Policy / CallbackGate / retained Ledger Synthetic cases | 14 passed |
| Full Library Harness, including Ownership / Native / Async / Main regressions | 312 passed |
| Existing protocol subprocess | 20 passed |
| Existing own synthetic subprocess | 1 passed (33 child cases) |
| Fresh isolated legacy pure regression | 27 passed, real Shell observation excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Non-test x86_64-pc-windows-msvc source compile, metadata and object only | Exit 0 |
| Compile rejection probes | 14 rejected with expected diagnostics |
| Scoped rustfmt and diff whitespace audit | Passed |
| Independent goal / quality / security / Synthetic QA / context reviews | All five PASS after P1 correction |

The compile-only root is native_boundary_compile.rs. It imports the actual Native
source through native_contract; no alternate implementation or Cargo target is
used. rustc --edition 2021 --target x86_64-pc-windows-msvc --crate-type lib
--emit=metadata,obj is supplied existing serde/windows rlibs and writes only to the
isolated output directory. No resulting Native binary, Gate or lifecycle is run.
Negative probes cover Synthetic/Native substitution, hidden receipt constructors,
private observations/proof fields, immutable creation facts, test-only inspector,
and Non-Send/Non-Sync owner. These are compile diagnostics, not Native execution.

Independent review found P1: a fresh owner originally required sequence 1, whereas
actual Adapter replacement preserves sequence 4. The actual Adapter/Fake cleanup
and replacement regression failed before correction, then passed. A fresh owner
now anchors its first positive Create sequence and requires exact +1 thereafter.
A zero/duplicate/backward sequence or wrong request kind remains fail-closed.
The callback identity comparison uses a static UTF-16 slice, with no allocation.

The integrator personally ran all 14 new scenarios. Runtime audit hypotheses and
observed Synthetic/compile evidence:

1. An old owner or callback could affect replacement: retired-owner admission,
   shared callback reentry gate and actual retained Ledger late-handle tests pass.
2. Partial/unknown cleanup could release ownership or mint Native proof: all shared
   failure-latch cases and existing per-field finalization regressions pass; private
   issuer/provenance compile probes reject forging and promotion.
3. Existing Coordinator sequence or non-test paths could be missed by test-only
   compilation: the sequence-4 regression reproduced/fixed P1, and actual non-test
   Windows metadata/object compilation plus all-target Cargo check pass.

Existing dead-code warnings remain visible. No LSP-clean claim is made. The only
installed toolchain is stable; cargo miri --version reports Miri unavailable.
Miri/sanitizer and actual FFI execution were not performed; user scope forbids
Native execution. Consequently no actual Windows cleanup, Native proof success,
abort/TLS teardown safety or async message ordering is claimed as verified.

Existing own-window Runner/Gate/store, Cargo targets/dependencies/lockfile,
Production/Tauri/frontend and prior approval/artifact/Evidence files are unchanged.
The separate 9B-1 checkout had a src-tauri/Cargo.toml modification when inspected;
this task did not edit that checkout. MY FINANCE checkout was clean when inspected.
