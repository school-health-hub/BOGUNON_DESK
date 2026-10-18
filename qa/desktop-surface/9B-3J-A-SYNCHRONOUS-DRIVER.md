# 9B-3J-A Synchronous Native QA Driver

Baseline: codex/desktop-surface-core-9b2a,
85c739c51f35885924193b4fa47418881bd3deca, initially clean.
QA source and Synthetic verification only. Actual Windows Native behavior is
NOT VERIFIED. No Native Driver/Runner execution, actual window, OS message
retrieval/dispatch, dedicated thread or QA process was started. No new Native
executable was built. No approval is issued or reused.

## Driver and proof flow

`creator_thread_host::synchronous_driver::Driver<B>` privately owns the existing
Host and sets its one-attempt latch before the first operation. A second run
returns AlreadyRun without any create, replacement or cleanup retry. It exposes
no Host extraction, replacement, external HWND/PID, file path or command input.
The existing creator-thread checks and Rc confinement remain effective.

The fixed sequence is:

1. Host::create -> NativeBackend CreateOwnSurface -> existing Owner::create.
2. Existing synchronous creation callback capture -> Host::pump(16).
3. Require Coordinator state Available after correlated CreateCompleted.
4. Host::close -> existing creator-thread DestroyWindow and destruction capture.
5. Host::pump(16) -> correlated CloseCompleted; require Absent.
6. Host::verify_cleanup -> existing Native finalization observation A.
7. Host::pump(16) -> existing final callback drain B and private A+B verifier.
8. Take the exact A+B proof already accepted by Adapter, once, into DriverReport.

Host::pump transfers recorded callback notices only. It does not call PeekMessage,
GetMessage, TranslateMessage or DispatchMessage. No queued-message behavior is
tested. Synchronous capture and actual Native API success remain source contracts,
not observed Windows results in this checkpoint.

The only completion-path change is a private Host completion slot. It receives a
clone of the existing issued proof only after Adapter::respond accepts the exact
request/owner/state and emits CleanupConfirmed. This does not issue a second proof
or change the private A+B verifier. Driver proof collection checks Host health,
no pending response, no failure cleanup attempt and Absent, then consumes the slot.
Absent after close alone is insufficient. Fault, stop, create, replacement and
failure cleanup discard old completion. Existing Host replacement remains available
to existing callers; the new Driver does not expose or call it.

`Driver::native(Authoritative)` is restricted to native_contract and constructs
bookkeeping only. Calling its run method would invoke Native, but no entrypoint,
Cargo target or executed test calls it. The imported non-test Windows source is
compiled to object/metadata only. A future separate process, Gate and approval
must be implemented and reviewed independently before any execution.

## Results and failure cleanup

DriverReport<P> has private provenance-bound fields and read-only accessors:

- lifecycle: original Stage and Host Error, or normal completion;
- proof: an accepted existing CleanupProof<P>, only on normal completion;
- failure_cleanup: the separate existing Host cleanup report or admission error.

Stages distinguish create, creation delivery/completion, close, destruction
delivery/completion, finalization, final drain and proof collection. Normal success
requires lifecycle Ok, a real accepted proof of the same provenance and no failure
cleanup report. Synthetic DriverReport/Proof cannot become Native values.

For every returned lifecycle error, Driver faults normal admission and invokes the
existing Independent Failure Cleanup once. This also covers missing callbacks
after an otherwise successful API response. Original failure is preserved even
when cleanup succeeds; cleanup Failed/Unknown and admission errors stay separate.
Drop is not used as cleanup evidence. No failure cleanup result mints a proof.

The existing Native resource capability, retained-handle identity checks,
partial-create/Unknown classification and cleanup observations are unchanged.
Panic, abort, process termination, a hanging Native call or callback can prevent
normal reporting/cleanup. This Driver does not catch arbitrary panics, preempt
callbacks, terminate threads or create an exit-code/stdout protocol.

## Scope of A+B

A remains actual resource finalization observations; B remains the current
observable callback queue's final drain. The existing private verifier remains
unchanged. No C, IntegratedAdmission, Pump Stop, OS queue-empty, future-message,
thread join or asynchronous lifecycle guarantee is added or required.

The Main/Async/Router/Owner/Backend/Ledger models are reused. Test hooks live only
in the existing cfg(test) Memory fixture and perturb responses or captured notices;
they do not duplicate a lifecycle machine or manufacture Native observations.
Main equality is asserted across normal, partial-create and Unknown Driver runs,
including business fields, unsaved input and authentication in the shared model.
This is not a WebView2 or operational Main-state preservation test.

## Changed files

- synchronous_driver.rs: Driver, private report and accepted-proof collection.
- synchronous_driver_tests.rs: normal and callback/create/close fault scenarios.
- synchronous_driver_failure_tests.rs: cleanup, proof and single-use regressions.
- creator_thread_host.rs: private completion slot and Driver module.
- creator_thread_host_drain.rs: retain only Adapter-accepted A+B completion.
- creator_thread_operations.rs: invalidate completion on create/replacement.
- creator_thread_failure.rs: invalidate completion on independent cleanup.
- creator_thread_host_fixture.rs: test-only response/drain fault injection hooks.
- creator_thread_host_tests.rs: test-only sibling visibility for shared fixture.
- native_sync_driver_compile.rs: fourteen forbidden type/API probes.
- native_boundary_compile.rs: import-only probe module registration.
- This verification record.

## Verification evidence

Logs and compiler products: C:/Users/Public/Documents/BOGUNON-9b3ja-output.

| Check | Observed result |
| --- | --- |
| Root failing-first Driver assertion | 1 failed, exit 101, driver-root-red.log |
| New Driver/completion Synthetic tests | 25 passed |
| Full Library, including Native/Host/Ownership/Async/Main and A+B/C regressions | 468 passed |
| Independent Library rerun | 468 passed |
| Existing own Synthetic subprocess | 1 passed |
| Existing protocol Synthetic subprocess | 20 passed |
| Isolated existing pure production regression | 27 passed, actual Shell case excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Actual non-test Windows object/metadata compile | Exit 0, no executable linking |
| Existing type/API rejection probes | 57 expected rejections |
| New Driver/report rejection probes | 14 expected rejections |
| Scoped rustfmt / diff audit / forbidden API scan | PASS, twelve QA-only files |
| Protected approval/artifact/Evidence SHA-256 | All 15 unchanged |
| Existing Runner/Cargo source SHA-256 | Unchanged |
| Independent goal / quality / security / QA / context review | Five PASS |

All touched Rust files are at most 250 nonblank, noncomment lines. Existing Host
tests and the import-only compile root reach 250; further growth should use child
modules. The independent context reviewer also checked this verification record.

The first worker red command discovered zero tests and is not passing or failing
behavioral evidence. Root then listed the real test and personally observed its
assertion fail before implementation. The first intermediate all-target check
caught that old bool assertion while the new Result-returning API was being
implemented. The final updated all-target check exits 0. The final Library suite
executes the implemented Driver, not just a standalone Fake or type stub.

The integrator personally ran the full Library Harness. Subprocess tests were run
separately with only own-synthetic or synthetic-subprocess features. All-features
execution was restricted to --lib; Native binary targets were not linked/run.
All-target validation uses cargo check, and actual Native source uses rustc
--crate-type lib --emit=metadata,obj with the import-only compile root.

Runtime audit distinguished three hypotheses through actual pure Driver/Host calls:

1. Close Absent could falsely imply cleanup success: missing A+B after close fails;
   direct Absent proof collection fails; accepted completion is consumed once.
2. Cleanup success could hide lifecycle failure: missing creation completion retains
   its original failure while independent cleanup reports Succeeded. Failed and
   Unknown cleanup cases are separately asserted and never report normal success.
3. Reuse or stale completion could create another owner: second successful/failed
   Driver runs return AlreadyRun; replacement/failure cleanup invalidate prior Host
   completion; stale/duplicate/foreign-owner callbacks fail without proof.

Existing dead-code/source-only API warnings remain. No warning-free, blanket
LSP-clean, Miri, sanitizer or actual Native execution claim is made.

## Protected scope and remaining risks

Existing own/live Runner, Gate, Evidence schema/stdout/exit codes, Cargo binary
targets/dependencies/lockfile, Production/Tauri/frontend and prior approved files
are unchanged. No new Gate, Evidence, approval, process launcher, OS dispatcher,
thread lifecycle, operational Main HWND or Explorer/WorkerW connection is added.
Existing approval is not authorization for this source Driver. No push or PR.

Native callback ordering, creation/destruction identity, residual count, class/TLS
release and cleanup outcomes still require separately approved Windows execution.
Synchronous calls can reenter or hang; bounded notice delivery cannot bound their
wall-clock runtime. HWND ABA/TOCTOU, outside producers, partial creation and lost
observations remain risks. Strict OS message noninterference is unproved and the
message-pump alternative remains BLOCKED. Future process exit/join must remain
separate from Native A+B cleanup proof and must not repair Unknown observations.
