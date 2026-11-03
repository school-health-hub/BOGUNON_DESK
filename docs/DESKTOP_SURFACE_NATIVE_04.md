# NATIVE-04 — WorkerW adapter implementation and isolated validation

**CONDITIONAL: compile-only implementation and model verification complete; actual Windows attachment NOT RUN. Runtime execution readiness remains BLOCKED.**

Base: `ab6b617ee5dffe6466b559f5c9bd3f998a82739c`; branch: `feature/electron-native-surface-workerw`.
NATIVE-03 runtime evidence at `79da8251e802d7dce377b5938989d649d3f25997` is historical Main–Host IPC evidence, not WorkerW qualification.

## Implementation boundary

A separate library, `tools/electron-native-workerw`, contains the Host-local transaction, a test-replaceable write plan and the private Windows adapter. It has **no executable, public activation interface, execution-permit issuer, Main route or new IPC command**. It is not linked into the headless NATIVE-02/03 executable. The feature `windows-adapter-skip-miri` compiles the FFI implementation only. No actual read-only Shell probe, SetParent, Explorer modification, window creation, Electron/Host launch or desktop test was executed in this step.

The normal app remains Native-disabled. Soft Rose UI, NATIVE-01/02/03, Preload/protocol, existing candidate, Tauri, Cloud B Inventory, Finance, encryption, authentication, user data, profiles and installed apps are unchanged. Existing worktrees and original Cargo.toml state are preserved.

## Reused contracts

See [byte-copy provenance](../tools/electron-native-workerw/PROVENANCE.md).

- The exact 9B staged machine is reused: snapshot → Hide/Styles/Parent/Frame/Placement/Show → fresh verification; rollback includes the partially failed stage in reverse order. Stale operation callbacks cannot reach the adapter.
- The exact 9B process/topology/query reader is reused: Explorer image/creation/session, Progman/DefView relations, one eligible existing WorkerW, before/after identity/topology observations and DPI checks. No hidden WorkerW-creation message is added.
- S-3 `Attempt`, lifecycle and ownership ledger/registration lease are reused. New internal admission binds attempt, owner window/process identity, Explorer and monotonic sequence. These DTOs are not a replacement IPC protocol or proof of authenticated delivery.
- The existing NATIVE-03 authenticated channel is preserved unchanged, with no attachment command exposed. A future Host bridge must derive this private transaction context from authenticated admission and actual owned-window observations; fixture claims cannot be used as runtime authority.
- The existing NATIVE-01 ledger remains the full cleanup-receipt contract authority. Synthetic receipt tests cover same-ledger lease, complete release/browser evidence, single use and invalidation by late uncertainty.

## Windows observation and mutation code

`OwnedSurface` checks current Host PID and creator thread, full process/window identity and a unique property tag on the owned Surface. The tag distinguishes a recycled numeric HWND; a non-Send/Rc marker keeps it on its creator thread. Drop's property removal is best effort and never proves resource cleanup. It never tags or writes an Explorer window.

The adapter captures the original desktop parent, owner, style/exstyle, placement, physical bounds, visibility, DPI/context, monitor/work area and predecessor identity. Initial scope rejects owned/nested, minimized/maximized, topmost and out-of-work-area windows. The historical `main` field refers only to the Host-owned Surface, never Electron Main.

Before writes, current owned identity/tag and fresh Explorer topology/DPI/WorkerW coverage are checked. Every write-plan action rechecks the owned target; style indexes are limited to style/exstyle. SetParent's previous-null return and GetLastError ambiguity are handled with a fresh parent relation check. Style cache refresh uses FRAMECHANGED; coordinate mapping is explicit screen → WorkerW client. Activation is not requested, and other app windows/icons are not moved or changed.

The pure write plan separates `ZOrder::Preserve`, original top position and a verified predecessor. Rollback hides the Surface, restores the desktop parent, original styles/frame/placement/physical bounds, then original visibility. A vanished/reused predecessor does not block safe owned-window restoration; it is never used as a target and causes sticky incomplete restoration/verification failure. It cannot produce full recovery PASS.

## Attached and recovery criteria

API success is insufficient. Native verification requires current ownership/tag, the same Explorer/topology, eligible WorkerW, expected actual parent, no owner, exact expected style/exstyle, visibility, physical bounds, monitor and DPI. Icon/input coexistence and cleanup qualification are additionally required through a **private permit that has no issuer in this checkpoint**. Consequently this implementation cannot currently activate a real attachment. Mock success is labeled `ModelAttached` only.

Recovery restores only the owned Surface and does not write/reuse a stale Shell window. Wrong owner/session, stale sequence, repeated attach/detach and stale callbacks are rejected. Explorer replacement, Host loss, failed rollback or failed final observation retires admission and remains CleanupUnknown. Ordinary-window return does not clear that state. Successful restoration does not destroy the owned window: its S-3 Window ledger slot remains unresolved, so neither detach nor process exit certifies Native cleanup.

Full OS cleanup receipt generation/consumption in a live Host is **not integrated** here. It requires the existing trusted runtime/ledger authority, actual Window/WebView/browser/UDF release observations and a correlated receipt, not a new Boolean or detach receipt. No such evidence is invented for the compile-only adapter.

## Validation

| Check | Result |
| --- | --- |
| Default-feature Rust tests (no FFI modules executed) | 31 PASS: 18 preserved contracts, 13 new admission/write-plan cases |
| New TypeScript cleanup/lease/receipt contracts | 3 PASS |
| Focused strict TypeScript / Electron Main TypeScript | PASS |
| Locked offline all-target Cargo check, including Windows adapter feature | PASS |
| Library Clippy `-D warnings`, default and Windows adapter feature | PASS |
| rustfmt, newly authored files only | PASS; copied originals remain byte-identical |
| Diff/allowlist and best-effort sensitive-pattern scan | PASS; dedicated secret scanner unavailable |
| Actual WorkerW/Explorer/window changes, actual attachment/cleanup | NOT RUN |
| Miri / FFI runtime proof | NOT RUN: Miri is not installed; Win32 FFI is explicitly behind skip-miri feature |

New cases cover session/owner/Explorer mismatch, sequence 0/MAX/replay, duplicate operations, cancel mid-attach, stale callbacks, successful restoration without cleanup claims, restore failure, Host loss, predecessor loss/top restoration, independent style flags and every partial write failure position. Pure replacement API tests validate planned actions and early failure; they do not validate real Win32 behavior. No historical test code or unrelated frontend/Windows GUI suite was rewritten or rerun to hide failures.

Commands (target directory below is local disposable build output, not an assumed cross-PC location):

```powershell
$env:CARGO_TARGET_DIR='E:\BOGUNON_DEV\qa\native-04-target'
cargo test --locked --offline --manifest-path tools/electron-native-workerw/Cargo.toml
cargo check --locked --offline --all-targets --features windows-adapter-skip-miri --manifest-path tools/electron-native-workerw/Cargo.toml
cargo clippy --locked --offline --features windows-adapter-skip-miri --lib --manifest-path tools/electron-native-workerw/Cargo.toml -- -D warnings
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.native-surface.json
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.json --noEmit
node --test artifacts/native-01/compiled/tests/native-surface-workerw.contract.js
```

The `check` command compiles but does not run FFI. Do not introduce feature-enabled Native execution or reinterpret model tests as desktop acceptance. Test unwrap/panic calls in byte-preserved historical tests are not a library Clippy waiver or a reason to edit those sources.

## Before an actual disposable Windows experiment

1. Separately approve a disposable Windows VM/session and recorded normal-window recovery procedure. Never use the current operating desktop as an implicit test environment.
2. Implement/review the narrowly authenticated Host bridge and a single-use execution/qualification issuer. The current headless executable does not accept attachment commands; approval alone will not make it operational.
3. Obtain source/binary/hash-bound owned Surface creation, required registration lease, live cleanup authority and bounded outer supervision. Preserve diagnostics and treat blocked Win32 calls, partial creation and missing evidence as Unknown.
4. Qualify wallpaper transparency, icon click/selection/drag, context menu, taskbar/focus/Win+D/Alt+Tab, Creator/DPI and a single selected monitor. WorkerW topology is undocumented and can be absent/ambiguous; do not create it by hidden messages or force Explorer changes.
5. Separately verify cancel/detach, Explorer replacement without forced termination, Host loss, restoration and actual cleanup receipts. Stop at the first unresolved ownership/cleanup condition; no automatic reattach/retry.

Windows query/write races, reentrant window messages, HWND reuse and same-user property tampering cannot be eliminated by a preflight snapshot. Cross-process SetParent can reset DPI awareness. Future live qualification must observe the postconditions and fail closed. [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent) and [SetWindowLongPtrW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowlongptrw) are the API references; WorkerW arrangement itself is not a supported public desktop-widget API.

No main/integration merge, PR, workflow dispatch, installer or deployment is part of this checkpoint. Source/contract preservation does not authorize live attachment.
