# Desktop Surface NATIVE-04B — authenticated DryRun bridge

Base: `685c773fcc3916894eb14b989100bd77486016de` (NATIVE-04).
Branch: `feature/electron-native-surface-host-workerw`.

## Scope and reuse

Electron Main's existing isolated activation, approved path/digest check, independent Windows
process/Explorer inspection, launcher lifetime lease, private inherited stdio framing, S-3
capability comparison, restore handshake and bounded quit boundary remain in use. A trusted,
Main-only one-shot extension sends a closed DryRun application DTO after authentication.
It does not reinterpret OpenMain or edit commands. No renderer/preload channel is added.

The new `native04b-host` binary accepts only the inherited channel switch and a DryRun grant.
It links the existing WorkerW crate with default features disabled: no Windows Shell adapter.
All window IDs are synthetic (901); actual Host/Explorer process identities come from Main's
independent inspector. The Host checks binding/capability/source/sequence and feeds the same
NATIVE-04 HostTransaction, ledger, registration lease, staged machine and in-memory adapter.
The original NATIVE-02 Host binary entry and copied S-3 protocol modules are unchanged.

Normal application startup never starts a Host. Only `--native-workerw-dry-run-qa` selects the
isolated QA path before product stores are constructed. Profiles/temp/crashes/logs are redirected
before the first await. A hidden ordinary sandboxed window has no preload/network/native bridge.
No installed app, existing Portable/profile, Finance store, Tauri source or Inventory code changes.

## Gates and outcomes

- Authentication precedes all WorkerW requests. Source/session/owner/Explorer/sequence mismatch,
  unknown fields, malformed frames and any Live mode are rejected. Frame bound remains 512 bytes.
- Main re-observes actual peer/Explorer before and after each exchange; capability stays inside
  Launcher/Host. The Main-only exchange plan is one-shot and serial; retirement wipes its secret.
- Duplicate attach is Busy; cancel/detach retires the transaction; connection loss is sticky
  CleanupUnknown. Return to normal cannot clear uncertainty. No retry or reattach after unknown.
- `ModelAttached` means fixture state only. Every report has scope DryRun and
  actualAttachmentVerified false. Model restoration is not window destruction or OS cleanup.
- Host process exit is independently observed, while nativeCleanup stays NotVerified.
- Budgets: startup 24s, serial DryRun plan 60s, bounded existing shutdown, headless Host watchdog
  120s, outer Electron case 150s. Timeout retires admission, not successful cleanup.

## Future execution authority and receipt

`ExecutionPermit` and `LiveCleanupReceipt` have private fields, no deserializer or public issuer.
No permit is issued or connected to the existing private OS adapter in this stage. A future issuer
must bind source, session, Host creation/PID, exact Surface identity/generation, Explorer generation,
ledger/lease, sequence, approved test scope/environment/preflight, expiry, revocation and consumption.
NATIVE-05 must implement/verify that issuer under separate approval; a predicate is not OS authority.

Live receipt carries before/attached/restored parent, style, geometry, DPI and Z-order observations,
ledger resolution and residual-resource status. It is a separate opaque type, never a conversion
from model receipt/report. Mismatch/replay is CleanupUnknown. Even internal fixtures yield only
NotVerified, never OS cleanup success. Actual observer, live issuer and successful live receipt
remain unimplemented and BLOCKED for NATIVE-05; no claim of actual Native cleanup is made here.

## Validation commands

- `node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.json --noEmit`
- `node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.native-surface.json`
- `node --test artifacts/native-01/compiled/tests/native-surface-*.contract.js`
- `cargo test --offline --locked --manifest-path tools/electron-native-channel-host/Cargo.toml`
- `cargo test --offline --locked --manifest-path tools/electron-native-workerw/Cargo.toml`
- `cargo check --offline --locked --all-targets --manifest-path tools/electron-native-channel-host/Cargo.toml`
- library/binary Clippy `-D warnings`, new Rust files rustfmt, `git diff --check`.
- Windows isolated Main/Host only: `node scripts/electron-p0/native-04b-windows.mjs` from a clean
  checkpoint. Fixed local reviewed Host digest and official Electron 45.2.1 ZIP/image hashes are
  checked first. Four cases: normal/duplicate/detach, partial cancel, fixture Host-loss/unknown,
  foreign synthetic window. No automatic retry. E: paths in runner are local prerequisites only.

## Execution evidence

Validated implementation source: `9ad3ef24fe9aa3d6679c78851e5af5cd3d473b8c`.
The later checkpoint changes only this document and the diagnostic summary.

- Actual Windows Electron 45.2.1 Main -> approved headless Host -> authenticated DryRun: **4/4 PASS**.
  Normal/duplicate/detach/retired, partial cancel/retired, fixture Host-loss/CleanupUnknown,
  foreign synthetic window rejection. Each is a fresh process/profile; no retries.
- Host and Electron residual process counts after all cases: **0 / 0**. Ordinary Main window
  remained alive through each bounded Host shutdown. All nativeCleanup results remain NotVerified.
- Rust channel tests: **14 PASS** (10 preserved + 4 bridge/wire tests); WorkerW: **37 PASS**.
- Focused Node contracts: **81 PASS / 2 SKIP**. The two older opt-in Windows tests were not enabled;
  this stage's four actual Electron cases are separate evidence, not fabricated skip replacements.
- Main TypeScript and contract compilation PASS; locked offline all-target Cargo check PASS;
  Host library/binaries and WorkerW default/Windows-feature library Clippy -D warnings PASS;
  new/changed non-provenance Rust files rustfmt and git diff --check PASS.
- Five independent review lanes completed. Receipt mismatch persistence was fixed and re-reviewed;
  stale provenance wording was corrected. No live runtime approval is implied by their scope.
- Source/staged/diagnostic summary best-effort secret/PII pattern checks: no matches.
  Dedicated secret scanner was unavailable; heuristic inspection cannot prove absence of all PII.

Safe diagnostic summary: [native-04b-windows.json](evidence/native-04b-windows.json), original bytes
SHA-256 `6a6a7baeb0e4f19d154d3fe22ef5b1d825bcb07565a428044b31df01d097fb86`.
Local original: `E:\BOGUNON_DEV\qa\native-04b\run-eOcBFd\VERIFICATION.json` (this PC only).
Only this fixed-schema summary was copied; profiles, logs, cache, EXE and credentials were not uploaded.
Raw process output was not persisted, only lengths and hashes. Existing QA evidence remains untouched.
Host SHA-256: `d7fb3a81258c2d434b168c4c02ccc1d85bade375e9e52c7dcaab11e5b19e6732` (unsigned).
All generated binaries, fresh profiles and temporary QA files remain on E:; none were deleted.

**NATIVE-04B: PASS for authenticated DryRun integration and fail-closed evidence contracts only.**
Actual WorkerW attach/detach, Explorer changes, Acrylic,
real Surface HWND, icon/input coexistence, monitor/DPI runtime behavior and live OS cleanup: NOT RUN.
Runtime readiness for actual attachment: BLOCKED pending NATIVE-05 approval and live evidence.


## Changed files

- Electron: `main/main.mts`, `main/desktop-surface/native02/launcher.ts`,
  `main/desktop-surface/native04b/{dry-run,electron-qa}.ts` under `electron-p0/`.
- Tests: `electron-p0/tests/native-surface-{dry-run,integration}.contract.ts`.
- Local QA runner: `scripts/electron-p0/native-04b-windows.mjs`.
- Channel Host: `tools/electron-native-channel-host/{Cargo.toml,Cargo.lock,upstream/lib.rs,src/workerw_channel.rs,src/bin/native04b-host.rs}`.
- WorkerW: `tools/electron-native-workerw/{PROVENANCE.md,src/lib.rs,src/live_contract.rs,src/legacy/{mod,admission,dry_run}.rs}`.
- This document and `docs/evidence/native-04b-windows.json`.

NATIVE-05 requires separate explicit approval, real Host-owned HWND acquisition and observation,
verified test environment/scope, actual permit issuance/consumption, live observer/receipt authority,
full resource destruction/ledger proof and a recovery procedure. The DryRun bridge cannot enable
any of these merely by changing a request mode or treating a model receipt as OS evidence.
