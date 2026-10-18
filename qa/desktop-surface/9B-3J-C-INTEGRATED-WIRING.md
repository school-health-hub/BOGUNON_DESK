# 9B-3J-C Integrated Native QA Runner Wiring

Baseline: codex/desktop-surface-core-9b2a,
2f68767a005e0251596eb72baa837403f1786c65, initially clean.
This checkpoint wires source and verifies static/Synthetic behavior only.
Actual Windows Native behavior is NOT VERIFIED. Native Runner execution, window
creation, Explorer/WorkerW queries and operational application access: zero.
No Live approval is issued or reused. No push or PR.

## Entrypoint and approval

Cargo adds only desktop-surface-integrated with the separate required feature
integrated-native-qa-skip-miri, test=false and bench=false. Existing binary targets,
features, dependencies and lockfile retain their behavior. integrated_main imports
only the required QA graph; it does not start Tauri/WebView2 or a message loop.

The default path is blocked. integrated_entry::arguments checks the distinct
opt-in before evaluating arguments or accessing files. All five CLI inputs are
explicit: --manifest, --descriptor, --approval-binding, --operator-record and
--reviewed-record-sha. The executable path comes from current_exe, not a user
supplied executable path. Loaded retains ordinary-file and ancestor locks while
the pipeline runs. Read sizes are bounded. The existing Gate rechecks the actual
files and all manifest/descriptor/hash/path/source/scope bindings.

The separate operator record is strict JSON with APPROVE, exact runner/scope,
approval_binding_sha256, positive approved_at_unix_seconds and a nonblank bounded
operator_reference. Its raw bytes must match the explicit review pin. It must
reference the exact Binding record, which in turn binds the artifact, source,
manifest, descriptor, single own window, single attempt and approved destinations.
No actual operator record, identity, signature or approval fact is generated.
These fields/pins are externally asserted authorization, not authentication of a
human or validation that the asserted approval facts are truthful. A trusted
operator must separately verify the actual authorization before any future run.

## Source and artifact procedure

integrated_source reads only compile-time BOGUNON_9B3J_SOURCE_SHA. Missing or
noncanonical values block; runtime Git state is never substituted for build source.
build-integrated.ps1 requires an exact expected clean branch/HEAD, a fresh external
target directory and a locked offline build. It injects that source HEAD, checks
HEAD/clean again after compilation and reports artifact SHA with APPROVAL=NOT_GRANTED.
It does not run the artifact or create approval/manifest/descriptor files.

The helper was syntax-parsed, not executed in this task. No new Native executable
artifact was linked. Actual main and the imported non-test Native graph were
compiled to Windows object/metadata only. The explicit source value used for that
dirty-worktree compile was a static-check input; those objects do not attest the
final checkpoint's source and are not Live artifacts. A future canonical artifact
must be built from the final clean checkpoint, with that commit passed to the
helper, then separately bound and approved by its exact new executable hash.

Pre/post clean checks do not atomically freeze source during a build. A trusted
quiescent build environment remains necessary; mutate-and-restore TOCTOU is not
excluded or represented as cryptographic source attestation.

## Execution and proof boundary

integrated_runner::pipeline::run_native is non-test Windows only. It evaluates the
existing Gate, retains the create-new synced claim, consumes the private Permit,
and calls Attempt::execute_native. Its irreversible latch/private ExecutionKey
precedes existing Driver construction. Gate/Claim failure never enters Driver.
Neither the real pipeline nor the entrypoint accepts an arbitrary DriverReport.

The unchanged Sync Driver performs one hidden own QA window lifecycle: create,
synchronous callback capture, internal Host notice delivery, CreateCompleted,
close/DestroyWindow, destruction notices, CloseCompleted, finalization A, final
callback drain B and an Adapter-accepted A+B Proof. Returned lifecycle failures
use the existing Independent Failure Cleanup path once. No replacement is exposed.
No external HWND/PID is accepted. Old Driver/Owner/Host/Finalizer logic is unchanged.

The prior source-only Driver verification record describes its historical stage;
this checkpoint now supplies the separate entrypoint, without implying execution.
A+B is still required for success. Synthetic proof cannot become Native proof.
C is not required; no OS queue-empty, future-message absence, Pump Stop, thread
exit/join, bounded Win32 callback time or asynchronous lifecycle claim is made.

## Panic, persistence and output

PipelineReport separates Gate/execution/Evidence errors and Completed delivery
results. Driver panic yields lifecycle Panic, missing proof and cleanup Unknown.
It does not infer cleanup success from Drop. Post-Driver panic preserves any
original Failed(stage)/cause and records panic_observed separately. Normal admission
errors are Unknown without inventing a panic. Main suppresses raw panic payloads
and conservatively returns 5 if an outer panic occurs after pipeline entry.

Exit precedence is cleanup Failed/Unknown 5, panic 4, observed Evidence/output
failure 6, Gate blocked 2, lifecycle/proof failure 3, all mandatory success 0.
Cleanup success cannot erase a lifecycle failure, and stdout failure cannot hide
cleanup failure. Pre-pipeline rejection emits a fixed typed Gate reason; no raw
paths or OS error payloads are logged.

Existing sanitized Evidence and create-new staging/write/flush/sync/reread-hash/
non-overwrite publication are reused unchanged. Staging/claim persist on failure.
The supplied Unix timestamp is sampled before the attempt by main; it is not a
save-completion timestamp. Evidence remains a pre-publication/output snapshot.
It cannot prove its own save or later stdout/stderr delivery.

stdout is one sanitized JSON line with result, separate closed error codes,
Evidence delivery/hash, stdout/stderr NotObserved and final_exit_code null. It is
a pre-output report, not an assertion of future delivery or final exit. Actual
write_all and flush are checked independently for stdout and stderr. stderr emits
a fixed diagnostic line with closed statuses after stdout; its own later delivery
is not claimed. Completed reduces actual observations to the process exit code.
Abort, OOM, hang, FFI unwind or forced termination can bypass reporting/cleanup;
the final status/Evidence may be absent.

## Files and verification

New files: integrated_main, integrated_entry/source and entry tests,
integrated_pipeline and its three test modules, integrated_result_mapping,
integrated_wiring_compile, build-integrated.ps1, and this record.
Existing QA changes: Cargo target/feature, Integrated module registrations,
Result panic observation/private mapping extraction, test registration, compile
root registration and updated Integrated bridge/Gate comments.

The mapping extraction keeps the original report conversion and private visibility;
it does not add a proof constructor. No existing own-window Runner/Gate/Evidence/
stdout/exit contract or Native Owner/Host/Driver behavior changes. Production,
frontend/Tauri, existing approvals/artifacts/Evidence and other worktrees are
preserved. Touched Rust modules are <=250 nonblank/noncomment lines; Gate (218)
and Result (214) are in the warning band and should use child modules before
substantial growth.

Logs/compiler products: C:/Users/Public/Documents/BOGUNON-9b3jc-output.

| Check | Observed result |
| --- | --- |
| New entry Synthetic / new pipeline Synthetic | 13 / 14 PASS |
| Integrated filter, including existing tests | 75 PASS |
| Full Library Harness, all features, lib only | 543 PASS |
| Independent Integrated / pipeline filter | 75 / 21 PASS |
| Existing Synthetic subprocess protocols | 1 + 20 PASS |
| Existing isolated pure regression, real Shell test excluded | 27 PASS |
| Offline locked all-target/all-feature Cargo check | Exit 0 |
| Actual main Windows object/metadata; Native compile root | Exit 0, no linking |
| Preserved / new negative type/API guards | 88 / 6 expected rejections |
| Post-extraction Result guards and new wiring guards | 3 + 6 rechecks PASS |
| Scoped rustfmt, diff, forbidden API/type audit | PASS |
| PowerShell build-helper syntax | PASS, helper not executed |
| Protected approval/artifact/Evidence SHA-256 | 15 unchanged |
| Independent goal/quality/security/QA/context review | Five PASS after correction |

The pipeline filter includes old Evidence pipeline cases; its 21 are not all new.
The tests use the existing sealed Memory Driver, real temporary filesystem and
actual failing Write/flush implementations. Store write/sync/reread faults use
existing narrow Synthetic checkpoints, not observed OS disk failures. Temporary
approval assertions and inert artifact bytes are fixtures, not human approvals.
Existing dead-code warnings remain; no blanket LSP/Miri/sanitizer or Native PASS
claim is made. No all-target test execution or Native process was used.

Three runtime audit hypotheses were distinguished on the allowed pure surface:
1. Gate/approval/claim failure might enter Native: nine binding rejection cases
   plus missing opt-in retain Driver call count zero, while valid admission drives
   the real existing Synthetic Driver. Loader tests exercise actual locked files.
2. Output panic might erase lifecycle failure: the regression first failed with
   Panic versus Failed(Close), then passed after independent panic observation.
   Cleanup failure plus output panic still returns 5 and retains the original stage.
3. Evidence/output success might hide later I/O failure: real staging/publish
   collisions and failing write/flush/panic writers preserve separate errors and
   refuse success; stdout never claims its own delivery.

Remaining Windows risks are actual callback ordering, identity/ABA/TOCTOU,
partial creation, residual own resources, class/context/owner release, reentry and
hanging synchronous calls. Actual Windows validation and any execution approval
remain separate. This checkpoint is RUNNER_WIRED, not Live or Production approval.
