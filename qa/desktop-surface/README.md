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

The default feature set is empty. Real window code belongs to the explicit
`desktop-surface-live` binary, requiring `live-windows-skip-miri`. Its target has
`test=false` and `bench=false`; no ignored Live test remains. All-features tests
may compile the binary but never execute it. No module constructors or
default tests call live functions. Existing app tests are NOT imported here:
the pre-existing 9B-1 real-shell test must not run as part of this phase.

## Real execution: separate explicit approval required

Do not run the live test during harness implementation. Before a later run:

1. Review the exact source changes, commit/source SHA, and Win32 allowlist.
2. Build the dedicated `desktop-surface-live` executable with `live-windows-skip-miri`, embedding
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
   windows in the dedicated process: root, owned top-level, and child.
7. Only then set process-local `BOGUNON_SURFACE_LIVE_OPT_IN=APPROVED_9B2C`
   and `BOGUNON_SURFACE_APPROVED_MANIFEST` to the approved manifest absolute path.
8. Run only the independently approved executable directly, never through
   `cargo run`, libtest, a Tauri executable, or a synthetic fixture. No Live
   execution command is automated by this crate. A failed gate performs zero
   live window/shell operations. The creator thread also performs cleanup.

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

Only fixed status strings leave the Live executable. Never print a snapshot's Debug,
raw HWND/PID, paths, Explorer image, environment values, identity records or raw
Windows error messages. Approval manifests contain paths and must stay in the
QA-controlled location, not be included in shared diagnostic logs. Rust/Cargo
compiler diagnostics may contain build paths; sanitize those before sharing.

## Dedicated output and exit protocol

### 9B-2E: separate, sanitized collection evidence

`Reader::collect_with_evidence` returns the unchanged collection result alongside
a serializable evidence value. `collect` preserves the same result and Win32
query sequence. The evidence writer accepts only a caller-supplied writer: it
does not choose a path, open files, log, print or access the environment.
9B-2E tested this API with synthetic queries and memory writers only. 9B-2F
connects it to the separately reviewed sink below. The old approved executable
and manifest cannot authorize new bytes; implementation verification never runs
the Live executable or builds a replacement approved artifact.

Reasons are `NO_WORKERS_ENUMERATED`, `NO_ELIGIBLE_WORKER`,
`ELIGIBLE_WORKER_FOUND`, `AMBIGUOUS_WORKER`, `SHELL_IDENTITY_FAILED`,
`TOPOLOGY_CHANGED`, or `UNKNOWN`. The original typed collection error is retained
in the result; evidence contains only its fixed, payload-free category.

Counts are from the first topology sample, not a live/global window count.
Unknown counts are null, never invented zeroes. Candidate counts and exclusions
are populated only after shell authentication. Exclusions are **overlapping**:
each failed condition is counted, so their sum may exceed rejected candidates.
The eight unchanged checks are class, Explorer process identity, desktop-root
parent, visibility, positive bounds, no direct DefView, follows-host order, and
not being the host itself. Worker owner is not an eligibility check.

Four `*_passed` flags mean a check actually completed successfully; false means
failed OR not reached. They must be interpreted with the error category. A
later error overrides the reason even when candidate counts are already known;
no candidate observation alone means SUPPORTED. Two equal topology samples are
not an atomic snapshot or protection against HWND reuse. Evidence contains no
HWND/PID, title, image/path, raw Win32 error, arbitrary text or raw snapshot.
The existing stdout/stderr/exit contract below is unchanged.

### 9B-2F: explicitly approved evidence destination

Before native session setup, the existing runtime Gate must pass. A separate,
independently supplied descriptor selected by `BOGUNON_SURFACE_EVIDENCE_APPROVAL`
is then required. Nothing creates, approves or searches for this descriptor.
Its exact four fields (unknown fields rejected) are `runtime_manifest_sha256`,
`evidence_path`, `staging_path`, and `scope`. The hash must match the bytes of the
selected runtime manifest, and scope must be `9B2F_SANITIZED_EVIDENCE_V1`.
This descriptor does not replace or extend the existing four-field runtime
manifest or grant execution approval by itself.

Both explicit destinations must be absolute drive paths in the descriptor's
existing directory, named exactly `evidence.json` and `evidence.staging.json`.
No directory is created. Relative, device, UNC, alternate-stream and dot-segment
paths are rejected. Root-to-leaf directory handles and approval file handles
remain open, deny write/delete sharing, and reject reparse attributes without
following links. Existing destinations, including symlinks, are rejected.

Evidence is collected by the existing `collect_with_evidence` query sequence.
The JSON schema has exactly five top-level fields: `schema_version` (1),
`collection` (the 9B-2E fixed evidence object, or null),
`post_collection_check`, `own_window_check`, and `final_query_error`.
Checks are `NOT_OBSERVED`, `PASSED`, or `FAILED`; errors are payload-free fixed
categories. The collection reason describes collection, not later invariance
checks: interpret it together with both later checks, final error, stdout and
exit status. No identities, paths, arbitrary strings or environment values are
serialized. Existing overlapping exclusion counts and eligibility rules remain.

Explicit window cleanup is attempted before any evidence file creation, even
after observation panic. Serialization is bounded to 16 KiB. Staging uses
exclusive create-new, flush/sync and same-handle byte read-back verification.
Final publication uses an atomic non-overwriting hard link on the same volume;
unsupported filesystems fail closed. The approved staging file is intentionally
retained on success or failure: no unlink/rename cleanup race or automatic retry.
Only the final filename is published evidence, and only exit 0 establishes an
overall successful diagnostic run. A partial staging file is not success.

Persistence failure uses existing exit 6 only when the run would otherwise exit
0. Existing cleanup (5), panic (4), Gate (2), and observation failure (3) retain
their meaning and precedence; a persistence panic is still an internal panic.
stdout's two observation lines can say PASS while exit 6 reports storage failure.
Consumers must check exit status, not infer overall success from those lines.
No evidence errors or paths are printed; stderr remains unused.

Directory/file locks reduce pathname replacement races but are not a security
boundary against privileged actors, hostile pre-opened handles or the same user
replacing files before validation/after process exit. Independently review the
descriptor and artifact hashes immediately before a future approved run, retain
them in a controlled non-synchronized location, and do not claim this removes
the existing executable/manifest TOCTOU limitation. No new descriptor, approval,
runtime manifest or Live result is produced during Synthetic verification.

`live_main.rs` installs a private silent panic hook before the gate. The default
hook is never invoked, including with inherited `RUST_BACKTRACE=1` or `full`.
`diagnostic_output.rs` catches gate/setup, observation, cleanup and final owner
drop independently. The owner stays outside the observation unwind boundary;
cleanup is explicit even after an observation panic. A panic payload is never
formatted and its potentially panicking destructor is not run in this short-lived
process. This deliberately retains that payload allocation until process exit.

stdout contains one `WINDOW=...` line and one `CAPABILITY=...` line, optionally
`FAIL_CLEANUP`, and fixed error codes. stderr is unused. Error codes are:
`E_GATE_OPT_IN`, `E_GATE_MANIFEST`, `E_GATE_ARTIFACT`, `E_GATE_SOURCE`,
`E_GATE_ENVIRONMENT`, `E_WINDOW_SETUP`, `E_WINDOW_CREATE`, `E_SNAPSHOT`,
`E_SHELL_IDENTITY`, `E_TOPOLOGY`, `E_INTERNAL_PANIC`, `E_CLEANUP`.
No raw errors, identities, process paths or panic payloads enter the output.

Exit codes: 0 only for Window PASS, capability SUPPORTED/UNSUPPORTED and successful
cleanup; 2 gate BLOCKED; 3 observation failure; 4 internal panic; 5 cleanup failure;
6 output failure. Cleanup failure has priority and does not erase an earlier panic
or diagnostic error. No intermediate `process::exit` bypasses resource release.
On a broken writer, the protocol may be absent/truncated and an `E_OUTPUT` line
cannot be guaranteed. Exit 6 is authoritative; stderr is not used as a fallback.

Abort, OOM, forced termination, process startup failure and fatal FFI/OS faults
cannot be made unwind-safe. They may prevent cleanup or protocol output entirely.
A missing/incomplete report or abnormal termination is never PASS. This contract
does not control Windows crash reporting or the invoking shell's own messages.

## Synthetic subprocess verification

`desktop-surface-synthetic` requires the separate `synthetic-subprocess` feature.
It reuses the exact output/unwind engine but imports no native adapter, gate,
permissions or test-window module. Only this fixture accepts failure-case and
temporary trace-file arguments. The Live executable has no such selector.
The fixture writes only synthetic lifecycle labels to the test-owned temporary
file; the parent checks raw stdout/stderr, exit status and cleanup/drop ordering.

```powershell
cargo test --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --features synthetic-subprocess --test protocol_subprocess
```

This command starts synthetic processes only. Do not execute the Live binary
during implementation verification. The normal lib regression suite remains
separate; libtest/Cargo build output is not the Live protocol.

FFI is compile-checked only in the implementation phase. Real window operations
and shell queries are NOT RUN. Miri cannot execute Win32 FFI; this host currently
has no nightly/Miri. The live feature is explicitly separated; mock ownership,
failure and cleanup tests are not substitutes for later approved hardware QA.
