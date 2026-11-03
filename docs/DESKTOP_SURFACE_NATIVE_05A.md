# Desktop Surface NATIVE-05A — read-only preflight

Base: `0bdf404ee66d0673ca294a9baff45c6afe364a6c`; inherited actual DryRun source: `9ad3ef24fe9aa3d6679c78851e5af5cd3d473b8c`.
Branch: `feature/electron-native-surface-live-preflight`.

## Implementation and authority

Reuses the preserved 9B read-only topology/process/window reader, candidate checks and independent re-observation.
The new `windows-observation-skip-miri` feature enables only query modules, not NativeAdapter, owned-window tag
installation, native_writes, SetParent or Shell messages. The headless Host has exactly one read-only switch and
no target HWND argument. It observes Shell reference windows only, never selects a user's app as Surface.
No Electron auto-start/preload/IPC/product services change. Existing branches, UI, Tauri, Finance and Cloud B remain untouched.

Preflight accepts a move-only OwnerReservation carrying the existing S-3 ledger and registration lease; it never constructs a new ledger or marks caller-provided resource IDs as owned. There is no live owner-reservation issuer or Host-creator integration in this stage. Numeric ledger IDs are metadata only; the actual ledger/lease object identity is authoritative. It checks exact source/session/Host PID,
creation/thread/session, Explorer PID/creation-generation/session, target HWND and pre-existing ownership tag,
ledger object identity/lease state, monotonic sequence/time, <=500ms observation freshness, cancellation/expiry,
monitor/DPI/work area, parent, placement, visibility, style and Z-order recovery observations. A second identity/tag,
window-state, anchor and topology observation rejects replacement/disappearance/races. A read-only capture error
quarantines the session. No tag is installed by preflight; no target is created to obtain an artificial PASS.

A fresh process-local monotonic epoch owns all timestamps; callers cannot provide the OS observation clock.
A session expires within at most 30s and qualified assessment is single-use. All reports have executionAllowed=false.
Even qualified OS evidence reports SeparateApprovalRequired. Fixtures are separately labeled FixtureOnly and cannot
be deserialized into OS observations. ExecutionPermit has no issuer and is never returned/connected to an adapter.

Explorer creation values here use native FILETIME units, not .NET DateTime ticks. Future Main/Host live integration
must explicitly bind/convert its canonical identity under authentication; no equivalence between these units is assumed.
The new target capture is not yet wired to a live Surface creator or the existing IPC dispatcher.

## Cleanup evidence

NATIVE-04B opaque LiveCleanupReceipt remains distinct from model receipts. NATIVE-05A adds only sealed observation
assessment, not a successful live receipt issuer. Before/attached/restored evidence must have the same session,
ledger, Explorer/target identities and provenance, increasing timestamps, same WorkerW and restored complete state.
Partial/mismatched/stale/cross-session/reused uncertainty is fail-closed CleanupUnknown. Parent restoration or
Host exit cannot release Window/COM/controller/etc ownership. Even consistent fixtures yield NotVerified.
No actual attach/detach/restore sequence is performed and no live cleanup success is claimed.

## Focused validation

- WorkerW default tests, including NATIVE-04B DryRun and new preflight contracts.
- Channel Host tests (S-3 auth/framing/EOF and DryRun); no real Host IPC rerun required for unchanged TS paths.
- Main TypeScript/contract compilation; focused Native contract regressions.
- Locked offline all-target Cargo checks; default/read-only/compile-only-adapter feature builds separately.
- Library/binary Clippy -D warnings; new Rust rustfmt; diff and best-effort secret/PII checks.
- `node scripts/electron-p0/native-05a-readonly.mjs` from a clean source checkpoint: builds only the small Rust query Host
  into a dedicated reusable E: target, compiles exact source SHA, spawns it once with a 25s outer bound and minimal environment,
  records sanitized fixed-schema JSON, executable SHA-256 and output hashes. No raw stderr/profile data is persisted.

Miri/sanitizers are not installed. Existing and new Win32 FFI wrappers therefore retain a proof gap; the feature name
explicitly states skip-miri. Compilation/tests and a query-only run do not prove FFI soundness, desktop attachment,
icon coexistence, restoration, multi-monitor transitions or future authorization safety.

Microsoft API contracts used: [GetWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindow)
(one predecessor query, no unbounded traversal), [DPI awareness context](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context)
(context equivalence uses AreDpiAwarenessContextsEqual). WorkerW topology remains undocumented Shell behavior.

## Windows observation evidence

Actual read-only Host source: `6a94312cd7de2c025e95eff911aa9a21ef240020`.
One fresh headless test process ran successfully, exit 0; source stability verified. This is a logical isolated
QA process/directory, not a separate Windows login account/VM. It only queried the current Shell; no window,
ownership tag, profile or desktop hierarchy was created or changed by this program.

- Explorer identity/session and Progman: observed and verified by the reused queries.
- Topology: stable across two observations; WorkerW windows enumerated: **15**.
- Eligible candidate count: **UNKNOWN / null**, not zero. The full reference-window query did not complete;
  no unique candidate was qualified. The fixed blocker `NoUniqueEligibleWorker` means insufficient qualification
  evidence, not proof that no usable WorkerW exists.
- Reference window geometry/DPI compatibility: **NOT_VERIFIED** (false/unavailable in the report).
- Host-owned Surface target, its ledger/lease, recovery baseline: **NOT_VERIFIED**; none was substituted.
- Execution allowed: **false**. No execution permit or live owner reservation was issued.
- Actual attachment, restoration and live cleanup receipt: **NOT RUN / NOT_VERIFIED**.
- No automatic retry or further desktop experiment was performed. Query Host residual count after run: **0**.

Evidence: [native-05a-readonly-windows.json](evidence/native-05a-readonly-windows.json).
Local original: `E:\BOGUNON_DEV\qa\native-05a\run-X7OEhm\VERIFICATION.json` (this PC only).
The safe fixed-schema report is preserved byte-for-byte; raw output was not persisted, only lengths/hashes.
No EXE, profile, UDF, personal paths, credentials or user data were added to Git.

Validation: **47 WorkerW Rust tests PASS** (37 existing + 10 new), **14 Channel Host tests PASS**.
Main TypeScript PASS; locked all-target default/read-only/compile-only-adapter checks PASS; default and
read-only library/binary Clippy -D warnings PASS; changed Rust rustfmt, runner node --check and diff PASS.
Existing TypeScript/DryRun runtime results from NATIVE-04B are reused only for unchanged paths, not relabeled
as a new real Main/Host execution. Whole frontend/Electron GUI/installer QA was not repeated.
Five independent reviews PASS after fixing ownership transfer, cleanup replay/cancellation and evidence
publication order. Best-effort source/staged/report secret-pattern checks found no matches; a dedicated
secret scanner and Miri/sanitizers remain unavailable, with residual detection/FFI proof risk explicit.

**NATIVE-05A: CONDITIONAL. Read-only observation and fail-closed assessment are implemented; actual live
experiment readiness remains BLOCKED.** Required next evidence: actual creator-owned test Surface and S-3
reservation transfer, complete geometry/DPI/anchor/candidate observations, separately approved session/permit
issuer and live mutation/cleanup observation authority. No actual attachment should be attempted from this report.
Read-only Shell observations alone cannot establish that NATIVE-05 attachment is ready.


## Change inventory

- `tools/electron-native-workerw/Cargo.toml`: isolated query-only feature/binary; no new dependency.
- `src/legacy/{mod,live_read_only}.rs`: feature separation and read-only facade.
- `src/{lib,live_contract,ownership,preflight,preflight_types,preflight_tests}.rs`: sealed binding/evidence, actual reservation transfer, query-only ledger validation and tests.
- `src/bin/native05a-readonly.rs`: fixed-switch, exact-source diagnostic Host.
- `scripts/electron-p0/native-05a-readonly.mjs`: one-shot bounded local validation and sanitized evidence.
- Provenance, this report and the fixed-schema JSON evidence.
