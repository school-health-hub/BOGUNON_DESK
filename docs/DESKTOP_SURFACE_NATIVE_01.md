# NATIVE-01 — Main / Native Host contract checkpoint

Base: `4c542cc8a110bf77f4d467aa2d11177323762498` on `codex/soft-rose-desktop-surface`.
Implementation branch: `feature/electron-native-surface-contract`.
Design: [Native preparation plan](DESKTOP_SURFACE_NATIVE_SOFT_ROSE_PLAN.md).

## Implemented boundary

This is an executable, isolated TypeScript contract model for the Main-side adapter and Host-side ownership observations. It is **not a Native process launcher, authenticated transport, OS observer or HWND adapter**. It is not wired into `electron-p0/main/main.mts`, any Preload or the existing application protocol. No new wire format is introduced; BigInt DTOs are internal model values, not replacement serialized IPC frames.

`createNativeSurfaceBoundary(binding)` parses an immutable launch binding and returns separate frozen ports:

- `main`: read-only sanitized snapshot, typed/parsed `Attach`, `Cancel`, `ReturnToNormal` requests, and trusted Explorer observation input. No Host resource/receipt methods.
- `host`: parsed Host startup, resource, runtime, shutdown and cleanup observations. No normal-window request method. Hand this port only to a trusted Host adapter in a future integration, never to a renderer.
- The assembly factory is a contract harness. Keeping both ports in one trusted test process is not proof of process authentication. PID/image/creation/session values are fixture claims until a future adapter independently attests them. Neither port is exposed to an installed app or renderer here.

Main remains the owner of the privileged normal window, settings and business engines. Host owns Surface resources through its private ownership ledger. `ReturnToNormal` revokes an in-flight attach and records a Main window request independently of cleanup; it does not assert that a real window was restored or focused. Surface renderer APIs and persistent settings are unchanged.

## Reused contracts and provenance

| Pinned source | Contract reused | NATIVE-01 limit |
| --- | --- | --- |
| `c67f5bf1338b3f41c48c17d58ea57d956b48a82a` `src-tauri/src/desktop_surface/lifecycle/{model.rs,machine.rs,observation_reader.rs}` | Exact operation/session identity, retirement, no writes after identity loss, separate restoration verification | No OS snapshot, rollback stages or SetParent bridge is implemented |
| `e4dfcbf7b987039b093d3d1dbb8bed69a3bfcc6e` `src-surface-host/src/{lifecycle.rs,ipc.rs}` | Nonzero u64 generation/nonce attempt, monotonic sequence, duplicate/stale rejection, retired-session admission | Internal request adapters only; existing wire parser is neither changed nor replaced |
| Same commit `src-surface-host/src/{ownership.rs,cleanup.rs}` | Resource identity, unresolved ownership, registration lease, single-issued ledger-bound runtime authority, closed admission, correlated normal browser exit | TypeScript adds single-use receipt issuance/consumption; there is no OS cleanup evidence |
| `160eec4e3082f7477e5c6a515f2979eed2f1f773` `src-tauri/src/desktop_surface/{probe.rs,windows.rs}` | Shell observations do not authorize attachment | No topology probe is executed |

Existing Tauri sources are read through pinned Git objects and are not modified or merged. S-3B-1 GUI editing/cleanup PASS does not establish Electron transport compatibility or WorkerW attachment.

## State and rejection rules

| State | Admission / meaning |
| --- | --- |
| Detached | No operation yet, or model cleanup verified; a consumed attempt cannot restart |
| Preparing | One attach intent reserved; Host progresses Starting → Running; no attachment claim |
| Attached | Reserved public vocabulary only; excluded from the returned contract-state type and impossible to produce here |
| Recovering | Cancel, normal-window request, Host failure or changed Explorer retires admission; no new attach |
| CleanupPending | Host cleanup started and admission closed; receipt predicates still pending |
| CleanupUnknown | Terminal quarantine; new attach and further Host lifecycle advancement are blocked; normal-window request remains available |
| Failed | Failure before an operation, or Host failure retained after verified model cleanup; not Native success |

Every request/Host observation binds generation + nonce, exact owner PID + creation identity + image hash + Windows session, exact Explorer generation/process identity and a strictly increasing sequence for its port. Unknown fields, command names, raw HWND inputs, invalid integer ranges, wrong owner/session and stale observations are rejected with fixed error codes and no raw diagnostic data.

Explorer identity change closes admission and requests the independent ordinary window. Repeated notifications during cleanup cannot rewind CleanupPending or erase the original Host failure. Cleanup remains bound to the original launch even after Explorer changes; it never authorizes writes to a new Explorer/window generation. No automatic retry/reset API exists.

Host unexpected exit is not a cleanup receipt. Resource identities must be released exactly; unresolved partial creation is terminal. BackendRegistration uses a ledger-specific opaque lease rather than an integer-only release. Unlike Rust's Drop quarantine, this model does not infer release or cleanup from JavaScript garbage collection: unreleased slots remain owned and prevent cleanup. Environment/browser identities, including process creation and session, must match the bound runtime, and browser exit must be normal.

The TypeScript model adds single-use receipt issuance/consumption (the upstream Rust receipt is Copy; its runtime authority is single-issued). The same ledger must issue and consume the receipt. Plain objects, cloned receipts, duplicate consumption and foreign-ledger substitution fail. Admission closure blocks new ownership; a later unresolved ownership observation changes the ledger revision and invalidates any outstanding receipt.

All returned snapshots/receipts explicitly say `scope: contract-only` and the snapshot's `nativeAttachmentVerified: false` is invariant. Result `ok: true` means a request/observation was admitted, not that attachment or cleanup completed. `cleanup: Verified` means the isolated model predicates held. It is not a statement about actual Windows resource cleanup, UDF deletion or a real CleanupReceipt from a Native process.

## Files

- `electron-p0/main/desktop-surface/{types.ts,identity.ts,ownership.ts,boundary.ts}` — contract types, strict parsing, role ports, lifecycle and Host ledger.
- `electron-p0/tests/native-surface-{main,cleanup,ownership}.contract.ts`, `native-surface-fixtures.ts` — synthetic Node contract tests, no app/OS execution.
- `electron-p0/tsconfig.native-surface.json` — focused strict compilation into ignored `artifacts/native-01/compiled`.
- This document only; existing UI, Preload, application protocol, Tauri, Finance/auth/encryption, settings/schema/lockfiles and workflows are unchanged.

## Verification

Use existing dependencies; do not run npm installation, Rust builds or a GUI:

```powershell
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.native-surface.json
node --test --test-reporter=spec artifacts/native-01/compiled/tests/native-surface-main.contract.js artifacts/native-01/compiled/tests/native-surface-cleanup.contract.js artifacts/native-01/compiled/tests/native-surface-ownership.contract.js
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.json --noEmit
git diff --check
```

Contract tests cover normal transitions, identity/sequence rejection, cancellation/re-request, Explorer invalidation, Host failure/exit, missing or mismatched cleanup evidence, unresolved resources, terminal CleanupUnknown, ordinary-window request and receipt/lease forgery. Development used RED → GREEN checks before filling the model and before adding retirement/lease defenses. Test output and compiler artifacts are ignored local products; no user data or QA profile is involved.

The receiving PC must have the pinned package-lock dependencies available. An optional local node_modules junction to an existing matching dependency tree is a machine-local convenience, not a tracked dependency or required setup. TypeScript/Node tests do not launch the Electron app, Native Host or WebView2.

Recorded local validation (2026-11-03): focused strict compilation PASS; 33/33 Node contract tests PASS (including an independent repeat); Main `tsc --noEmit` PASS; `git diff --check` PASS. Review identified and closed a late-ownership/receipt gap: acquisition after admission closure is denied and unresolved observations invalidate issued receipts by ledger revision. Goal, security, code, focused QA and provenance review lanes passed after that correction. No unrelated frontend/Windows GUI suite was rerun.

Security review is limited to source/model behavior. No dedicated secret scanner was installed; full intended/staged file contents receive best-effort credential/private-key/token/user-path pattern checks and manual review. This is not an OS/process security qualification or a comprehensive PII-scanner guarantee. Generated test output, dependency links and compiler output are excluded from the checkpoint.

## Remaining gates

- Real Host process launch/exit attestation, authenticated S-3 transport adaptation and independent Main watchdog: NOT_IMPLEMENTED.
- Native resource observation, effective UDF attestation, actual CleanupReceipt and normal-window restoration: NOT_RUN.
- WorkerW/Progman mutation, native Acrylic composition, icons/input, Explorer restart, multi-monitor/DPI and installation/GUI QA: NOT_RUN.
- Native geometry/rollback integration and source/artifact-specific Windows feasibility remain subsequent approved steps. Contract/model PASS alone cannot unlock actual attachment.

No Main/integration merge, deployment, native launch or shell mutation is authorized by this checkpoint. Existing apps, Portable profiles, user data, Finance encryption/DPAPI and other worktrees remain outside its capabilities.
