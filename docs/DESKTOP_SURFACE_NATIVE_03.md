# NATIVE-03 — actual Electron Main / Native Host isolated integration

**PASS — isolated Main–Host process/authentication boundary only.**

- Base: `b9cd04b84bf5224c7ffd35bb8e38a93d67761694`.
- Branch: `feature/electron-native-surface-main-integration`.
- Validated implementation SHA: `79da8251e802d7dce377b5938989d649d3f25997`.
- Earlier implementation checkpoints: `b13f3ce035bb50d30037930ef5a299cc212fa10b`, `a653c5b24b9d24a28162280741a1230d394729a5`.
- This completion record is documentation-only after the validated source. No attachment, deployment or Native cleanup qualification is implied.

## Main integration and isolation

`electron-p0/main/main.mts` selects the isolated path only with `--native-surface-isolated-qa`. Default product execution has no Host activation. The QA branch precedes product store construction, single-instance registration and business-service initialization. Existing modules are still statically imported/evaluated; this is not a claim of zero product module evaluation. The original product branch body, UI, Preload, application protocol, Tauri, Finance, encryption/authentication and business engines are unchanged.

The isolated path rejects packaged applications, non-Windows execution and unsafe sandbox/security flags. Its fixed app-local manifest names only source SHA, approved Host digest and a strict case ID. It contains no executable/profile path or arbitrary command input. The build metadata SHA must match. A fresh app-local QA directory must not already exist. UserData, sessionData, crash and log paths are set synchronously before waiting for ready; the runner also redirects APPDATA, LOCALAPPDATA and temp directories to fresh QA locations.

The ordinary QA BrowserWindow is hidden, sandboxed and ephemeral, with no Preload, renderer IPC, navigation, child windows, network or permissions. The fallback callback records that this ordinary window is still alive; it does not focus another application's window. The actual installed product window and business-feature regression suite are **NOT RUN**. No real user data or operating profiles were inspected.

Main-only `createMainHostSession` accepts disabled/isolated activation, uses the existing launcher port, rejects duplicate/restart attempts and preserves ordinary-window fallback on failure. It exposes a sanitized in-process snapshot, not a new renderer IPC surface. `installNativeQuitBoundary` prevents the first quit, awaits the existing bounded Host stop and diagnostic flush, then allows a single completion quit. Missing/failed diagnostics cannot count as runtime success.

## Existing authority reused unchanged

[NATIVE-01](DESKTOP_SURFACE_NATIVE_01.md) remains the request/observation, ownership ledger, retirement, registration lease and cleanup-receipt authority. [NATIVE-02](DESKTOP_SURFACE_NATIVE_02.md) remains the executable approval, OS identity inspection, private inherited pipes, S-3 framing/RestoreBinding capability, sequence admission, process lifecycle and bounded cleanup adapter. Those modules, pinned Rust sources and lockfiles are unchanged.

Main receives no renderer-specified executable. Authentication uses existing private stdio and memory-only capability; no token is put in argv, environment, files, UI or evidence. Native03 introduces no native wire command. `OpenMain` retains its ordinary-window-request meaning. Explorer identity is revalidated through the existing health path; the mock generation-change contract is retained. No actual Explorer restart or Shell manipulation was performed.

Process exit is independent of OS resource cleanup. Every result retains `nativeCleanup: NotVerified` and `nativeAttachmentVerified: false`; launcher stop remains terminal `CleanupUnknown`, and a normal-window request cannot reopen admission. The headless Host creates no Surface window, WebView2 environment, UDF or HWND resource, and no browser/cleanup receipt is fabricated.

## Focused validation at the validated source SHA

| Check | Result |
| --- | --- |
| NATIVE-01/02 and new Main TypeScript contracts | 73 PASS (15 new Main integration contracts) |
| Main TypeScript / focused strict compilation | PASS |
| Rust inherited-channel contracts | 10 PASS |
| Locked offline all-target Cargo check | PASS |
| Library/binary Clippy `-D warnings` | PASS |
| New binary rustfmt check, script syntax, diff checks | PASS |
| Staged source/document best-effort pattern scan | No matches; dedicated secret scanner unavailable |

Contracts cover disabled default, packaged/invalid activation, factory/start/health failure fallback, duplicate and CleanupUnknown rejection, delayed quit, quit before start, flush rejection, ESM entry readiness, plus unchanged session/owner/Explorer/replay, authentication, startup cancellation and IPC/cleanup contracts. No unrelated full UI/design tests were repeated.

## Actual Windows Electron Main results

Runner: `node scripts/electron-p0/native-03-windows.mjs`, executed from a clean implementation checkpoint. Each case uses a fresh application directory, separate Main process and redirected profile; it stops on any failure without retry. The runner checks HEAD/clean state before and after all cases and records source SHA, binary hashes, process results and diagnostic snapshots. Raw stdout/stderr are not persisted; only byte lengths and hashes are recorded.

| Case | Actual observation | Result |
| --- | --- | --- |
| normal | Real Electron Main → approved Host → authenticated S-3 roundtrip → health check → EOF exit; ordinary QA window alive while stopping | PASS, ~19.3 s |
| foreign-grant | Actual headless Host rejects wrong expected process identity with exit 2; no Native operation admitted | PASS, ~2.9 s |
| unexpected-exit | Only the retained owned headless child handle is terminated; Main observes CleanupUnknown, rejects another start and keeps ordinary QA window alive | PASS, ~13.0 s |
| quit-delay | Actual Main/Host plus a QA-only 500 ms delay in exit **observation**; before-quit holds the ordinary window until stop/flush | PASS, ~17.8 s |
| missing-exe | Approval rejects before spawning, fixed `MissingExecutable` | PASS |
| digest-mismatch | Approval rejects before spawning, fixed `DigestMismatch` | PASS |

Each case recorded zero residual Host processes; the final independent check found **Host 0 / isolated Electron 0**. Missing/digest cases mean no Host was started, not that a Native resource cleanup occurred. The delay case does not claim a genuinely stalled Host or a cleanup receipt. Wrong capability/session/replay and Explorer replacement are contract-tested, not additional real Shell experiments.

### Initial failure retained and corrected

At `a653c5b…`, the first Main case timed out before any Host started. QA directories existed, the profile had no files, and no result was issued. Electron 45.2.1's [ESM loader](https://github.com/electron/electron/blob/v45.2.1/lib/browser/init.ts#L93-L105) awaits entry module evaluation before signaling app code loaded. The entry's top-level await indirectly awaited `app.whenReady()`, creating a readiness cycle. The [ready API](https://github.com/electron/electron/blob/v45.2.1/docs/api/app.md) and ESM initialization order were checked.

The fix keeps pre-ready path setup synchronous, starts the async continuation without top-level-awaiting readiness, and catches failure with a fixed code. A TypeScript AST regression failed before the fix and passed afterward. The corrected checkpoint reached actual authentication and passed all six cases. The failed evidence directory is retained; no failure was relabeled PASS.

## Local evidence and runtime provenance

These are local PC locations, not paths assumed to exist on another PC:

- Successful run: `E:\BOGUNON_DEV\qa\native-03\run-cR0q3l\VERIFICATION.json`, with case-local `native-surface-qa\RESULT.json`.
- Initial failed run: `E:\BOGUNON_DEV\qa\native-03\run-3H1nzI\VERIFICATION.json`.
- Focused contract TAP: this worktree's ignored `artifacts/native-03/contracts.tap`.
- Profiles, runtime files and raw local state are not committed or uploaded.

The existing dependency installation lacked an Electron executable. The [official Electron 45.2.1 archive](https://github.com/electron/electron/releases/tag/v45.2.1) was downloaded into a new E: QA-only location, checked against the checksum in the locked Electron package, then extracted. Shared node_modules and installed applications were not repaired or changed. The local runner pins both ZIP and executable hashes:

| Binary | SHA-256 |
| --- | --- |
| Electron ZIP | `7c342aee45d5b4ccafe5dfe9037028796b082735a576e21e2b4e2d8422ebb727` |
| Electron EXE | `32e357fc856feadd1e51531f47811d2621483e5a58815eb4999154d7c9baea3b` |
| Reused NATIVE-02 headless Host EXE | `0c84a7108c249733aeca2c0e8c5db86826d73cea8aacbb2e732eae177778e385` |

Both local EXEs report `NotSigned`; their byte provenance is checked, with no Authenticode trust-chain claim. Host source is unchanged from NATIVE-02. Source references/digests are not atomic loaded-image attestation and do not defeat same-user/admin application-resource substitution.

Reproduction needs Windows, existing locked frontend dependencies, the pinned portable Electron archive/runtime and the reviewed NATIVE-02 Host binary at the runner's documented fixed QA locations. If any is missing or mismatched, prepare it through verified provenance first; the runner does not download, install, rebuild, retry or substitute executables. Do not reuse a product EXE or operating profile. A receiving PC must create its own fresh QA paths.

## Remaining boundary

WorkerW/Progman/SetParent, Explorer restart, desktop icons/input, actual Surface resource ownership, Acrylic/Mica, monitors/DPI, permanent layout/data, real WebView2 cleanup and product activation: **not implemented or NOT RUN here**. No `Attached` state, merge, release, workflow dispatch or deployment occurred. General product operation continues with Native disabled.
