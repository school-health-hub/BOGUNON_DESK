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

Pending isolated Windows verification. Actual WorkerW attach/detach, Explorer changes, Acrylic,
real Surface HWND, icon/input coexistence, monitor/DPI runtime behavior and live OS cleanup: NOT RUN.
Runtime readiness for actual attachment: BLOCKED pending NATIVE-05 approval and live evidence.
