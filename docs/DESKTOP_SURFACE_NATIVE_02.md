# NATIVE-02 — isolated Host launcher and authenticated inherited channel

Base: `ccc2e7aebf9ee6ce1177cd8956f7b8b84ea89d9b` (NATIVE-01).
Branch: `feature/electron-native-surface-host`.

## Scope and verdict

**CONDITIONAL**: the trusted Main service and a real Windows headless Rust child process have been tested. This is not a production app integration, Native Surface renderer, HWND owner or desktop attachment implementation. The installed application, Electron Main entry point, Preload, Tauri source, Finance, authentication, encryption, UI and stored settings are unchanged. No new renderer-facing command is exposed.

The service is callable from trusted Electron Main code and independently exercised under Node 22; a running Electron application integration is **NOT RUN**. It must not be exposed to a renderer as an arbitrary executable launcher. Deployment packaging must supply a reviewed source reference and independently approved executable digest; this checkpoint does not distribute an EXE.

## Reuse and authority

- `createNativeSurfaceBoundary` remains the authority for NATIVE-01 request/observation transitions. Session, owner, Explorer, independent monotonic sequences, admission retirement and cleanup ledger rules are not reimplemented or relaxed.
- Byte-identical S-3 `main_restore.rs`, `edit_control.rs`, `memory_channel.rs` are pinned in [Host provenance](../tools/electron-native-channel-host/PROVENANCE.md). The standalone crate has its own locked dependencies and forbids unsafe Rust. Original Tauri/native crates are untouched.
- Transport is an inherited private stdin/stdout pair, using the existing nonzero u32-LE length and 512-byte limit. There is no listening socket, public named endpoint or newly invented native command.
- Main generates a 32-byte capability in memory, transfers the existing RestoreBinding grant only through the inherited input pipe, and validates the existing `OpenMain` request. Generation/attempt are nonzero safe JSON integers, narrower than upstream u64. Wrong capability, identity, sequence, replay, schema or Explorer generation retires admission. Tokens never enter arguments, environment, files or diagnostic messages.
- `OpenMain` keeps its restore-request meaning: this isolated adapter records `normalWindowRequested`. It does not claim an actual normal window was focused. Existing `RestoreResponse` fields are preserved. Native commands are not implemented or authorized by this handshake.
- Host shutdown is stdin EOF, not a new shutdown wire command. Extra post-authentication messages are rejected. Explicit and unexpected/forced exits are distinguished.

## Executable and process boundary

Development: `<approved root>/artifacts/native-02/bin/bogunon-surface-channel-host.exe`.
Packaged: `<approved root>/native-surface/bogunon-surface-channel-host.exe`.

The Main-only approval issuer checks canonical containment, descendant symlinks/reparse links, a regular single-link file and SHA-256. A frozen WeakMap-issued approval is rechecked before launch and before capability delivery. `sourceSha` is trusted provenance metadata, not independently proven source-to-binary attestation; the executable digest is the launch approval authority. Never derive a production allowlist merely from an untrusted downloaded file's own digest.

Launch uses an exact executable and fixed inherited-only argument, `shell:false`, `windowsHide:true`, private stdio and a minimal Windows environment. Stderr is drained without copying raw content into logs. A process-wide image lease and per-instance one-shot state block duplicate/restart attempts. Cancellation before startup, during preflight or while spawn is pending joins late-child cleanup rather than losing ownership.

Windows read-only inspection checks the actual child PID, creation ticks, parent Main PID, image path/hash and logon session. Explorer must be the unique same-session system Explorer image. UTF-8 PowerShell output is explicit, including for Korean paths. Health checking revalidates child/Explorer identity before any future privileged adapter operation; this checkpoint has no such operation and no continuous Shell watcher. An Explorer change closes admission and retains the ordinary-window request.

Threat limit: same-user/admin memory access, handle duplication or malicious executable replacement races are not solved by path/hash rechecks. No Authenticode trust chain or atomic loaded-image attestation is claimed. This adapter is not ready to authorize desktop mutations until those product integration requirements are reviewed.

## Time and cleanup rules

| Boundary | Budget / result |
| --- | --- |
| Main startup | 24-second budget across approval, process inspection and handshake |
| OS spawn adapter | 5-second bound, owns late-spawn termination; injected test adapters must obey the same ownership contract |
| CIM query | 5 seconds, 16 KiB output limit, fixed error codes |
| Health inspection | 12 seconds |
| Graceful EOF exit | 3 seconds |
| Forced-stop identity check | 5.5 seconds; uncertainty forbids termination |
| Owned child termination observation | 3 seconds |
| Residual inspection | 5.5 seconds |
| Headless QA Host watchdog | 30 seconds; exit 124 is abnormal, never cleanup success |

No retry is automatic. Normal EOF exit, forced termination and missing exit evidence remain distinct. Termination addresses the retained child object only after independently matching its observed creation identity; no process tree, Explorer or unrelated PID is killed.

**Process exit is not Native cleanup**. This headless Host creates no Window, WebView, browser environment or UDF. The NATIVE-01 receipt evaluator requires correlated runtime/browser evidence, so this implementation does not fabricate `RuntimeBound` or `BrowserExited`. Stop reports `processExitVerified` independently, leaves `nativeCleanup: NotVerified`, and ends in terminal `CleanupUnknown`; normal-window return cannot clear it. A future reviewed no-native-resource attestation or real Native ownership receipt is required before restart may be enabled. Ledger, registration lease and receipt implementation are reused unchanged; this step does not acquire a Native registration lease.

## Validation

Environment: Windows x64, Node 22.23.3, Rust/Cargo 1.98.1 MSVC. Dependencies reused; no npm installation, Tauri rebuild, NSIS build, Actions dispatch or GUI execution.

- S-3 standalone Rust contracts: **10 PASS**; locked offline build and library/binary Clippy `-D warnings`: PASS.
- New TypeScript launcher/framing/admission contracts: **25 PASS**. Includes duplicate/foreign-session/replay refusal, authentication failure, unexpected exit, Explorer invalidation, missing shutdown response, pre-start/preflight/pending-spawn cancellation, no abandoned rejecting inspection, truncated frames and bounded stalled identity observation.
- NATIVE-01 contracts: **33 PASS**, unchanged.
- Focused strict TypeScript compilation and existing Main TypeScript check: PASS.
- Actual Windows tests: **2 PASS** — approved headless process + authenticated private roundtrip + EOF exit + residual check; foreign process grant rejected by actual Host with exit 2 before any Native operation. Initial process-inspection failure was traced to non-UTF-8 Windows PowerShell output; explicit UTF-8 fixed the Korean path roundtrip. These are process/IPC tests, not Electron GUI tests.
- Rust formatting (new binary), `git diff --check`, byte identity of pinned upstream modules: PASS.
- Secret review uses the existing best-effort checkpoint scanner and scoped source inspection. It is not proof of absence of all secrets. Generated binaries, raw test output, fixture paths and private channels stay outside the commit.

The local development EXE is unsigned. Its first validated build SHA-256 was `0c84a7108c249733aeca2c0e8c5db86826d73cea8aacbb2e732eae177778e385`; local evidence records source-tree hashes separately from this parent base SHA. No artifact is published.

Reproduction (from this worktree; use a disposable target directory with space):

```powershell
$env:CARGO_TARGET_DIR='<disposable target directory>'
cargo test --locked --offline --manifest-path tools/electron-native-channel-host/Cargo.toml
cargo build --locked --offline --manifest-path tools/electron-native-channel-host/Cargo.toml
cargo clippy --locked --offline --manifest-path tools/electron-native-channel-host/Cargo.toml --lib --bin bogunon-surface-channel-host -- -D warnings
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.native-surface.json
node --test artifacts/native-01/compiled/tests/native-surface-launcher.contract.js
```

Actual Windows tests are opt-in with `NATIVE02_WINDOWS_QA=1`, after placing only the locally reviewed headless build at the fixed development path. Do not substitute a product/GUI EXE. The standard contract run leaves Windows tests skipped.

## Not implemented / next boundary

WorkerW, Progman, SetParent, desktop icons/input, Acrylic/Mica, monitors/DPI, actual Surface windows, browser UDF and resource cleanup receipt: **NOT RUN / not implemented here**. Product Main integration, packaged approval manifest, independent loaded-image trust and a sound no-resource/native receipt path remain separate work. No `Attached` result is possible.

All original worktrees, Soft Rose UI, installed applications, profiles, QA evidence, user data and NATIVE-01 source remain preserved. No merge, PR, deployment or workflow run belongs to this checkpoint.
