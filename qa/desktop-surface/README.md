# Desktop Surface 9B-2C: isolated read-only QA

This is a test-only crate. It does not link the Tauri application, initialize
application data, accept an external HWND, connect frontend commands, or attach
any window. It reuses the 9B-2B observation source by path, without copying it.

## Allowed now: synthetic verification only

Use a dedicated output directory outside all application/PR #14 targets:

```powershell
$env:CARGO_TARGET_DIR = 'C:\Users\Public\Documents\BOGUNON-9b2c-output\target'
cargo test --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --lib
cargo check --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --all-features --tests
```

The default feature set is empty. Real window code is compiled only with
`live-windows-skip-miri`; its only test is additionally `#[ignore]`. Even an
all-features test run leaves that test ignored. No module constructors or
default tests call live functions. Existing app tests are NOT imported here:
the pre-existing 9B-1 real-shell test must not run as part of this phase.

## Real execution: separate explicit approval required

Do not run the live test during harness implementation. Before a later run:

1. Review the exact source changes, commit/source SHA, and Win32 allowlist.
2. Build a dedicated test executable with `live-windows-skip-miri`, embedding
   the reviewed source SHA via build-process-only `BOGUNON_SURFACE_SOURCE_SHA`.
   Do not set this value to claim approval of an unreviewed dirty source tree.
3. Record its absolute path and SHA-256 in an independently reviewed approval
   manifest. Operator approval must cover that manifest and executable bytes.
   Merely computing a hash immediately before execution is NOT approval.
4. Confirm non-elevated Medium integrity and an interactive Windows session.
   The live gate checks token elevation, integrity RID and visible window station.
5. Verify no reparse point in the executable/manifest paths. Keep the approved
   executable and manifest immutable during verification/execution. The checks
   do not protect against a malicious same-user process replacing files.
6. Obtain approval for creating and destroying THREE hidden, non-activating
   windows in a separate test process: root, owned top-level, and child.
7. Only then set process-local `BOGUNON_SURFACE_LIVE_OPT_IN=APPROVED_9B2C`
   and `BOGUNON_SURFACE_APPROVED_MANIFEST` to the approved manifest absolute path.
8. Run ONLY `live::approved_read_only_windows_diagnostic`, explicitly selecting
   that ignored test with exact matching and a single test thread. Do not run
   all ignored tests or any Tauri executable. No execution command is automated
   by this crate. A failed gate performs zero live window/shell operations.

Manifest schema (no automatic generation/approval):

```json
{
  "source_sha": "<reviewed 40-character Git SHA>",
  "executable_path": "<approved absolute executable path>",
  "sha256": "<approved 64-character executable SHA-256>",
  "scope": "9B2C_READ_ONLY_OWN_WINDOWS"
}
```

The gate reads only this explicitly selected QA manifest and its own executable.
No application AppData, identifier, DB, credentials, environment dump or process
command-line enumeration is used. No production app execution or termination.

## Win32 allowlist

- Identity/relations: GetWindowThreadProcessId, GetClassNameW, GetAncestor
  (GA_PARENT), GetWindow (GW_OWNER), GetDesktopWindow.
- Window observation: GetWindowLongPtrW (GWL_STYLE/GWL_EXSTYLE),
  GetWindowPlacement, GetWindowRect, GetClientRect, IsWindowVisible, IsIconic,
  IsZoomed. Structure sizes and success/failure conventions are checked.
- Monitor/DPI: MonitorFromWindow, GetMonitorInfoW, GetDpiForWindow,
  GetWindowDpiAwarenessContext, GetThreadDpiAwarenessContext,
  AreDpiAwarenessContextsEqual. No awareness-context setter.
- Shell observation: GetShellWindow, FindWindowExW. Never request new WorkerWs.
- Process observation: GetCurrentProcessId, GetCurrentThreadId,
  OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION), GetProcessTimes,
  QueryFullProcessImageNameW, ProcessIdToSessionId, CloseHandle.
- Normalization/errors: GetSystemWindowsDirectoryW, CompareStringOrdinal,
  GetLastError, SetLastError (calling thread error slot only).
- Gate only: GetCurrentProcess, OpenProcessToken(TOKEN_QUERY),
  GetTokenInformation(TokenElevation/TokenIntegrityLevel), GetProcessWindowStation,
  GetUserObjectInformationW(UOI_FLAGS). Token contents are never logged.
- Own lifecycle exception: GetModuleHandleW, RegisterClassExW, CreateWindowExW,
  DefWindowProcW, DestroyWindow, UnregisterClassW. No visible style or ShowWindow;
  synchronous bounded observations need no long-running message loop. Creation
  and cleanup happen on the same thread, with a non-Send owner and identity ledger.

Explicitly forbidden: SetParent, SetWindowLongPtr, SetWindowPos,
SetWindowPlacement, Explorer 0x052C, ShowWindow, SetForegroundWindow, global
hooks, privilege elevation, Explorer restart/termination and killing processes.
The allowlist constrains our direct calls, not undocumented Windows internals.

## Observation and outcome contracts

- Window result: PASS / FAIL / BLOCKED.
- Capability: SUPPORTED / UNSUPPORTED / FAIL / NOT_OBSERVED.
- Window checks compare PID/TID/process identity, separate parent and owner,
  styles, placement, typed screen/client bounds, visibility, monitor/work area,
  DPI and semantic DPI contexts before/after. They do not compare workspace
  placement coordinates directly to screen coordinates.
- A stable, authenticated shell with zero eligible WorkerWs is UNSUPPORTED,
  not a failed own-window observation. Multiple candidates, shell identity
  failure, query failure and changing topology remain FAIL.
- Synthetic tests exercise classifiers with synthetic supported topology, but
  do not issue a real SUPPORTED diagnostic report. Actual capability in this
  implementation phase is NOT_OBSERVED.
- No Explorer disruption or forced HWND reuse. Failure injection is synthetic;
  natural live races are rejected, not retried. A snapshot is neither attach
  authorization nor an HWND lifetime/ABA guarantee.

## Cleanup, evidence and limitations

Cleanup is reverse creation order (child, owned, root), on the creator thread,
and requires current identity to match the recorded identity. A failed destroy
or identity check stops subsequent cleanup, avoiding parent cascade destruction.
Class unregistration occurs only after tracked windows are destroyed. Drop is
a fallback; explicit cleanup produces the report. Failure is `FAIL_CLEANUP`,
never silently PASS. No force cleanup, external process termination or retry.
If cleanup cannot safely finish, the disposable process may leave windows until
its own exit; do not claim HWND reuse is impossible.

Only fixed status strings leave the live test. Never print a snapshot's Debug,
raw HWND/PID, paths, Explorer image, environment values, identity records or raw
Windows error messages. Approval manifests contain paths and must stay in the
QA-controlled location, not be included in shared diagnostic logs. Rust/Cargo
compiler diagnostics may contain build paths; sanitize those before sharing.

FFI is compile-checked only in the implementation phase. Real window operations
and shell queries are NOT RUN. Miri cannot execute Win32 FFI; this host currently
has no nightly/Miri. The live feature is explicitly separated; mock ownership,
failure and cleanup tests are not substitutes for later approved hardware QA.
