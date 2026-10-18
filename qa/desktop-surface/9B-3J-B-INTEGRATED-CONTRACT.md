# 9B-3J-B Integrated Gate / Evidence Contract

Baseline: codex/desktop-surface-core-9b2a,
9e33ad613abe8e9131a9e5a330697513270d06cc, initially clean.
This checkpoint implements source contracts and Synthetic verification only.
Actual Windows Native behavior is NOT VERIFIED. No Native Runner, window,
OS message dispatcher, operational app or new Native executable was run/built.
No approval is issued and no prior approval is reused.

## Independent admission

integrated_runner defines a distinct runner ID, approval scope, opt-in value,
Evidence namespace and closed API policy. Binding requires one hidden own QA
window and one run, exact executable/source/manifest/descriptor hashes, and exact
artifact, approval, claim, staging and output paths. Manifest binds the artifact;
descriptor binds the raw manifest; the separate approval record binds both raw
manifest and descriptor hashes without a circular hash requirement.

OperatorReview::VerifiedRecord is an explicit assertion from a future trusted
entrypoint that an external operator record was reviewed. It is not a signature,
identity authentication, or evidence that a person actually approved execution.
Hash equality and opt-in do not authenticate human authorization. No real approval
record is created here. Source HEAD/SHA are supplied observations that a future
entrypoint must obtain independently; this module does not inspect Git or the
running process image. API scope is a declared, exact policy, not a binary audit.

Gate checks the actual locked artifact and metadata files against their supplied
bytes/hashes. Existing ancestor/reparse checks and Windows read/share locks are
reused without changing the old Runner. Claim uses create_new, write, flush and
sync_all. It remains after failure and while the Attempt runs; no retry deletes it.
It limits this approved path, not the artifact's global execution count.

Permit has private fields and no Clone. Consumption yields a creator-confined
Attempt retaining locks. Its irreversible execution latch is consumed before
Driver construction. A private ExecutionKey enters the native_contract child
bridge, which constructs/runs the existing Driver itself and converts only that
report. There is no public arbitrary-report rebinding API. Second admission is
rejected after success or failure. No entrypoint invokes the Native bridge here.
The cfg(test) route uses the existing sealed Memory backend and Driver.

## Result and publication

RunResult preserves Gate, original lifecycle stage/cause, independent failure
cleanup status/fact/admission error and accepted A+B proof status. It does not
manufacture Native proof from booleans. Synthetic and Native provenance remain
different types. A cloned sanitized result summary is neither a Permit nor an
opaque proof and cannot execute another Driver.

Exit precedence: cleanup Failed/Unknown = 5; panic = 4; observed persistence/output
failure = 6; Gate blocked = 2; lifecycle/proof failure = 3; all mandatory success = 0.
Missing mandatory output observations cannot become success. Completed records
Evidence/stdout/stderr observations separately from the immutable snapshot.
Output statuses are supplied observations in this contract; no new stdout protocol
or real output writer is implemented in this stage.

Evidence schema_version=1 contains fixed identity/scope/namespace, validated
source/artifact hashes, provenance, sanitized result, nine fixed lifecycle steps
and a numeric snapshot Unix timestamp. Step summaries follow the existing Driver's
returned control-flow stage, not independent OS telemetry. No raw HWND/PID/TID,
user paths, business data, authentication values or callback payload is serialized.
At snapshot time persistence and later output remain NotObserved. It cannot prove
its own successful save or subsequent stdout delivery.

Store accepts only the admitted Attempt's exact paths and same binding. It locks
ancestors, creates staging with create_new, writes, flushes/syncs, rereads and
verifies SHA-256, then publishes with a non-overwriting hard link. Staging is
retained, including on failure. A second save is rejected. Existing files are never
overwritten. Filesystem hard-link support is required; errors fail closed. This
does not claim directory crash durability, global tamper resistance or protection
against all filesystem/privileged-actor TOCTOU.

## Changed source groups

- integrated_runner/approval/claim/gate and Gate tests: isolated admission.
- integrated_execution and its tests: private one-shot existing Driver bridge.
- integrated_result/cause/delivery and tests: sanitized result and exit reduction.
- integrated_evidence/store and tests: bound snapshot and publication.
- integrated_boundary_compile: forbidden API/type probes.
- verification/native_boundary_compile: module registration.
- native_ownership_compile: verbatim extracted old probes, preserving their checks.
- native_contract: bridge module registration only.
- creator_thread_host: cfg(test) test module registration only.

Existing Owner, Finalizer, Host lifecycle logic, Driver, own/live Runner, Gate,
Evidence schemas, stdout/exit protocol, Cargo targets/dependencies/lockfile and
Production/Tauri/frontend remain unchanged. The Host file changes only its test
module registration, so its old hash is not claimed unchanged.

## Verification

Logs/products: C:/Users/Public/Documents/BOGUNON-9b3jb-output.

| Check | Observed result |
| --- | --- |
| Integrated Synthetic, including actual existing Driver conversion | 48 PASS |
| Full Library Harness, all features, lib only | 516 PASS |
| Existing own Synthetic subprocess | 1 PASS |
| Existing protocol Synthetic subprocess | 20 PASS |
| Isolated pure regression, real Shell test excluded | 27 PASS |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Existing negative type/API guards | 71 expected rejections |
| New Integrated negative type/API guards | 17 expected rejections |
| Actual non-test Windows object/metadata, no executable linking | Exit 0 |
| Scoped rustfmt, diff audit, forbidden API scan | PASS |
| Existing approval/artifact/Evidence hashes | 15 unchanged |
| Independent goal/quality/security/QA/context review after P1 fix | Five PASS |

The initial implementation had a P1: a public report converter could attach an
old report to another Attempt, and Attempt lacked an execution latch. Independent
review rejected it. The final private bridge and latch resolve this; seven tests
drive actual existing Synthetic Driver reports through conversion, preserve the
original PROTOCOL failure after successful cleanup, distinguish failed/unknown
cleanup, reject repeated execution and reject foreign-approval snapshots.

Runtime audit hypotheses were exercised on the pure surface:
1. A changed actual file could pass supplied-byte validation: four locked-file
   mismatch tests reject it before claim/Native admission.
2. Cleanup/output success could erase lifecycle failure: actual Driver and result
   tests preserve cause, cleanup fact and precedence; stdout cases test reduction.
3. Output collision or reread corruption could replace prior evidence: actual
   filesystem fixtures and private I/O checkpoints reject collision/corruption.

Claim create-error classification and failed sync use narrow Synthetic seams;
they do not demonstrate an actual disk sync failure. Temporary artifact.exe files
contain inert fixture bytes, not executable builds. No test fixture is an approval.
An early compile command omitted serde_json; after adding the dependency the pure
regression compiled and passed. A timed-out probe batch was not counted as PASS;
individual diagnostic logs and the complete unique expected-error matrix were
checked. Existing dead-code warnings are retained; no blanket LSP/Miri/sanitizer or
warning-free claim is made.

## Remaining boundary

A+B means the existing Native finalization and current callback queue drain only.
No C, OS-queue-empty, future-message absence, thread stop/join or asynchronous
lifecycle guarantee is added. HWND ABA/TOCTOU, synchronous reentry/hangs, partial
create and lost cleanup observations require separately approved Windows QA.
Cleanup uncertainty cannot authorize replacement. The blocked OS message pump
strategy remains blocked. A future separate entrypoint still needs real operator
approval, process/environment Gate observations, artifact construction and review.
This contract checkpoint is not execution authorization or Production readiness.
