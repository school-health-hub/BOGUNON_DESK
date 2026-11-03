# Desktop Surface NATIVE-05B — owned test target and candidate classification

Base: `350cdec3e3e9360609c29306bbd3c268e230f635`.
Branch: `feature/electron-native-surface-live-target`.

## Scope

Opt-in `windows-test-target-skip-miri` enables the existing read-only modules, unchanged OwnedSurface creator-thread/
property generation contract, and a dedicated ordinary-window QA Host. It does NOT enable NativeAdapter,
native_writes, WorkerW/Progman messages, SetParent, product startup or any Electron/Finance/Tauri path.
Only this new Host's hidden, unparented STATIC-class window is created. No product Surface, profile, UDF or user data
is opened. No WS_VISIBLE, ShowWindow, focus operation or desktop attachment is used.

NATIVE-05A's UNKNOWN candidate count was caused by passing the foreign Shell HWND through a reader intentionally
restricted to Host-owned windows. That ownership check remains unchanged. The new classify_shell wrapper reuses
existing validate_shell, select_worker and all eight worker predicates independently of target-window observation.
It never selects by count/index: class, Explorer process identity, desktop parent, visibility, bounds, no DefView,
following-host relation and distinct host must all pass; only an unambiguous candidate can qualify. Independent
identity/topology rechecks and target monitor/DPI checks are additional gates. Undocumented WorkerW layout is
not promoted to a cross-version Windows guarantee. Missing/ambiguous/changed evidence remains UNKNOWN.

## Ownership, baseline and cleanup

The dedicated creator captures its own PID, creation, thread, session and HWND generation tag, then registers the
actual Host/window and registration lease in the reused S-3 ledger. The existing PreflightSession receives that
move-only OwnerReservation. No permit is issued; qualified evidence can only yield SeparateApprovalRequired.
Duplicate target creation is rejected before OS creation; foreign Shell capture is rejected before any property write.

Before attachment (which is NOT RUN), the local baseline records exact own HWND/PID/TID/generation/creation,
actual GA_PARENT relation (not conflated with owner), style, visibility, placement, screen rect, predecessor,
monitor/work bounds, DPI and Explorer identity. Native 64-bit IDs/timestamps are decimal strings to prevent JSON
precision loss. This raw baseline stays local; Git receives sanitized evidence and baseline hashes only.

Normal close validates ownership, calls DestroyWindow on exactly that own target, observes disappearance and
uses an unforgeable destruction proof to consume the preflight session and release only Window/registration.
Host process ownership is not released by pretending process exit; full nativeCleanup remains NotVerified.
Failure/uncertainty does not produce a live receipt. RAII fallback never operates on a caller-supplied HWND.

The loss case records host_lost/CleanupUnknown, retains the window in a !Send RAII guard, flushes diagnostics,
and then the dedicated binary exits 42 without normal destructors. The parent separately verifies the exact Host
exit and old target absence. A library caller that does not exit still drops the guard and closes its own window.
This controlled loss case is last and has no automatic retry. Kernel process cleanup is not a live attachment receipt.
Thread DPI context changes apply only to this Host's creator thread and are restored by a guard.

## Verification

- Existing S-3/9B/DryRun/preflight Rust regression + pure worker classification tests (no OS test calls).
- Test-target all-target Cargo check; library/binary Clippy -D warnings; rustfmt; Main TypeScript; diff/secret scan.
- `node scripts/electron-p0/native-05b-target.mjs` from a clean checkpoint compiles exact source metadata into
  a dedicated E: target and executes distinct normal and Host-loss cases, once each, within 25s each.
  It uses a new E: evidence/temp directory and minimal runtime environment. No Electron is launched.
  Source stability is checked before launch and before evidence publication; no failed run is retried.
- Parent query uses only IsWindow/GetWindowThreadProcessId on the recorded own HWND and process counts.
  Raw baselines remain local, output hashes and sanitized summaries are persisted. No credentials/path dumps.

Miri/sanitizers are unavailable: Win32 FFI soundness remains NOT_VERIFIED, despite compilation/runtime checks.
Real attachment, restore-after-attachment, icon/input coexistence, monitor/DPI transitions and live cleanup receipt
remain NOT RUN/NOT_VERIFIED. Main-to-live-target authorization/approval is not connected by this test harness.

API references: [CreateWindowExW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowexw),
[thread DPI context restoration](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows).

## Actual Windows results

Pending exact-source isolated verification. This document does not claim a selected WorkerW or verified cleanup yet.
