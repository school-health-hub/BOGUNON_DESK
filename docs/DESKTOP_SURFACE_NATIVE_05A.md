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

NOT RUN yet. Actual owned Surface target, live permit, attachment and live cleanup are NOT_VERIFIED/BLOCKED.
Read-only Shell observations alone cannot establish that NATIVE-05 attachment is ready.
