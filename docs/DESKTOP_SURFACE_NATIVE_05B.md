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

Actual validated source: `b19badae897affbcd9d2b0c1ee67905f75e0a21a`.
The later checkpoint adds only this report and safe evidence; no source changes inherit unexecuted runtime claims.

**Windows cases: normal PASS; controlled Host-loss (exit 42) PASS.** Each used a fresh process and one own test
window; failed/previous cases were not retried. EXE digest and source stability were checked around both cases.
Host digest: `6f3d7f1f7d5de9c51e1ca59219d8a7283643f6df29e18ff8201a37702efc43c2`.

### Candidate result: UNKNOWN / live admission BLOCKED

15 WorkerW windows were classified in each case. Existing policy-qualified candidates: **0**.
All 15 failed visibility and following-DefView-host Z-order conditions; 3 also failed Explorer process identity,
and 1 failed nonempty-bounds qualification. All 15 had matching DPI/monitor observations for this test target;
individual identities and topology were stable. Other predicate failure counts were zero. These are observations
of this Windows session only; neither the count nor these relationships justify a universal Shell layout rule.
No first/index-based candidate was selected, no WorkerW was generated/shown/reparented, no policy was relaxed.
The normal case remained CandidateNotVerified. Preparing an eligible Shell target by mutation was outside approval.

### Own test-window and baseline: PASS

Actual creator PID/TID/creation/session/HWND and existing generation tag were verified. Duplicate creation and
foreign Shell window capture were rejected. Actual GA_PARENT was DesktopRoot (separate actual handle is local).
Window was hidden; rect [40,40,680,520], monitor bounds [0,0,1920,1080], work area [0,0,1920,1032], DPI **96**.
Style **80674816**, extended style **256**, placement/show command **1**, and predecessor were recorded.
These values describe an isolated test window, not the user's product Surface or a visible GUI validation.

Normal close: own window destruction and subsequent identity-query rejection PASS; S-3 Window/registration
lease release PASS. Host was not falsely released from inside its still-running process. Parent independently
observed Host exit and old own-window absence. Controlled loss: CleanupUnknown recorded, no Window/lease release
claimed; parent observed exit 42 and old window absence. Both cases had Host residual **0**, Electron before/after
**0/0**. No Electron launch, product GUI, user profile or existing app changes were performed.

Safe evidence: [native-05b-target-windows.json](evidence/native-05b-target-windows.json).
Original and lossless raw baselines remain local under `E:\BOGUNON_DEV\qa\native-05b\run-uzuHf7`:
`normal-LOCAL-BASELINE.json`, `host-loss-LOCAL-BASELINE.json`, `VERIFICATION.json`.
This PC-local path is not assumed to exist on another PC. Raw baseline contents/IDs were not committed or pushed;
only hashes and safe classification/lifecycle summaries are in Git. All original files remain preserved.

### Validation and decision

- Rust: **50 PASS**, including 47 existing regression tests and 3 pure classification tests; no unit test creates a window.
- Test-target all-target Cargo check and library/binary Clippy -D warnings PASS; changed Rust rustfmt PASS.
- Main TypeScript, runner node --check, diff and best-effort source/staged/report secret checks PASS/no matches.
- Five independent review lanes PASS after making Host-loss assertions and per-case image-digest checks explicit.
- Dedicated secret scanner/Miri/sanitizer proof remains unavailable; no FFI-soundness or whole-product QA claim.

**NATIVE-05B: CONDITIONAL.** Own target, baseline and normal/abnormal lifecycle are validated, but an eligible
WorkerW is not established. Actual attachment/SetParent is **NOT RUN**. Live cleanup remains **NotVerified**.
A separately approved next step must first resolve the Shell candidate evidence without arbitrary HWND selection,
then provide explicit one-shot approval, authenticated Main/live-target authority, icon/input/recovery qualification
and actual attach/detach observations. No automatic attachment or execution permit was issued here.


## Change inventory

- WorkerW Cargo feature/binary declarations, module exports and provenance.
- Existing observation_reader.rs: narrow pure classification wrapper/tests; original shell/candidate predicates unchanged.
- New legacy/{test_window,test_target,target_evidence,classification_tests}.rs.
- preflight_target.rs: consuming proof-scoped test resource settlement; preflight.rs feature module only.
- src/bin/native05b-target.rs; scripts/electron-p0/native-05b-target.mjs.
- This report and sanitized Windows evidence. No source under Electron product Main, Tauri, Finance or Cloud B changed.
