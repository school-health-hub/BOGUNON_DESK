# Soft Rose Desktop Surface correction

Base: `d779e121b5abeb69887abf399bd9c08ad64d54fa`. This branch preserves the Electron feature baseline and all existing data contracts. It is not a production release.

## Capability boundary

- Soft Rose translucent widget, toolbar and Dock materials reuse the existing dashboard, editing controls, layout storage and twelve work-tool routes.
- Ordinary-window mode retains an opaque rose canvas. `--desktop-glass` requests Windows Acrylic only on Windows 11 22H2/build 22621 or newer; `--reduced-transparency` and high contrast select the opaque fallback. A configured material request is not runtime proof that the compositor rendered it.
- Existing flat-card appearance also removes widget blur; reduced-transparency preference and forced colors have opaque CSS fallbacks. No new persisted appearance enum or user-profile migration is introduced.
- `transparent:true` is deliberately not enabled: Electron documents resizing/maximizing limitations for transparent windows. Acrylic is not CSS-only transparency, but its actual appearance still needs isolated Windows validation.
- **Actual Windows desktop attachment: NOT_IMPLEMENTED in this Electron branch.** There is no WorkerW/Progman bridge. No always-on-top, click-through, taskbar hiding or shell-parent mutation substitutes for it. The UI and guarded info report ordinary-window mode / `desktopAttachment:false`.

The existing Tauri 9B probe, later Surface Host ownership/IPC contracts, and 9B-2A lifecycle test model are reusable specifications, not a working Electron HWND bridge. Reusing them requires an isolated native host integration, trusted window identity, explicit attach/detach rollback, Explorer restart recovery, monitor/DPI work-area clamping, icon/input coexistence, and normal-window restoration. Those behaviors were not exercised here. Main retains privileged work/Finance operations; a future desktop renderer must not inherit that privilege merely to display widgets.

## Portable local-work warning

The generic warning is emitted by `electron-p0/renderer/local-tasks/LocalNotices.tsx` when the provider has no valid document after load failure. Missing primary and backup files return `emptyLocalTasks()` successfully in `LocalTaskStore.load()`. Therefore an empty new profile alone is not established as the cause.

Sender rejection returns `FORBIDDEN`; read/parse/access failures return `STORAGE_ERROR`. Browser rendering exposed a confirmed presentation defect: weather/meal adapters return signedOut, but the shared notice previously labeled every non-loading state as a local-storage failure. LocalNotices now distinguishes signedOut from error; a regression test preserves genuine error reporting. This explains that misleading warning on disconnected weather/meal widgets, without proving every warning in the reported Portable run has the same cause. The actual Portable storage outcome remains **UNKNOWN**. Synthetic startup regressions distinguish empty storage, unreadable/malformed storage and rejected IPC. No existing profile was opened, reset, migrated or overwritten, and errors were not converted into empty success. No actual data-loss finding or absence-of-risk guarantee is inferred from the generic message.

## Validation limits

Only focused material, settings, startup and existing desktop/policy tests, type checks and frontend/Electron build preparation are appropriate. No new workflow, full regression run, external Portable execution, WorkerW experiment, Finance database access, main merge or deployment is part of this change. Browser screenshots with synthetic bridge fixtures prove renderer styling only, never native Acrylic or desktop attachment. The user subsequently authorized scoped checkpoint commits and normal push of this UI branch, plus Native design preparation only.

References: [Electron native material API](https://www.electronjs.org/docs/latest/api/base-window), [transparent-window limitations](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles). TD2 remains a layout/interaction reference; no TD2 code or assets are introduced.

## Verification performed

- Focused suite: 18/18 PASS before the notice correction; startup suite 4/4 PASS after adding the disconnected/error regression.
- Main/renderer TypeScript and Electron frontend build PASS (no Native app launch). Large existing export chunks remain a build warning.
- Renderer-only synthetic screenshots: E:/BOGUNON_DEV/qa/soft-rose-desktop, 1440x900 and 1366x768. No actual Acrylic or attachment claim.
- Reuse references: commit 160eec4e3082f7477e5c6a515f2979eed2f1f773 src-tauri/src/desktop_surface/{mod.rs,windows.rs}; commit c67f5bf1338b3f41c48c17d58ea57d956b48a82a src-tauri/src/desktop_surface/lifecycle/{machine.rs,model.rs,tests.rs}. These are reference contracts, not integrated Electron attachment.

## Native preparation checkpoint, 2026-11-03

- Worktree: E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-soft-rose-desktop (local path only); branch `codex/soft-rose-desktop-surface`. Other worktrees, original Cargo.toml status, Portable installations and profiles are not changed.
- UI/material checkpoint: `5ef8564bfbdaa6906b51709dd812e1f62e02548b` (9 files). Disconnected-notice/startup-test checkpoint: `90838db` (2 files). QA fixtures, node_modules, build output, browser profiles and screenshots are excluded from commits.
- A separate production CSS defect was observed in browser CSSOM: placing the prefixed backdrop-filter last made the current minifier retain only the unsupported prefixed declaration. Computed standard backdropFilter was `none`. Reordering the two declarations keeps the standard property and produces `blur(18px) saturate(1.12)`. The browser regression failed before and passed after the two-line correction.
- Current focused follow-up: production frontend rebuild PASS; `node --check scripts/electron-p0/check-soft-rose-renderer.mjs` PASS; synthetic browser regression 4/4 PASS. Earlier focused unit tests and TypeScript results above are reused; a full suite, native build and CI were not rerun.
- Browser cases: 1440x900, 1366x768, 900x600 and a synthetic Acrylic-info case. The test compares served HTML with the current production entry and checks widget/Dock computed blur, no horizontal page overflow, scroll reachability of the bottom quick-launcher and separation of Dock from the main scroll viewport. At 1366x768 the viewport ends at y=648, Dock starts at y=686, and the quick-launcher bottom reaches y=558 after scrolling. This is not an assertion that every widget's full contents fit on one screen.
- Small disconnected-notice text contrasts 5.35:1 with the ordinary rose canvas. Reduced-transparency emulation removes the first widget blur and restores an opaque shell even with synthetic native material info. This does not prove contrast over arbitrary wallpaper or every panel's accessibility fallback in the real Windows compositor.
- Existing layout IDs, persistence code, data schemas, twelve work-tool routes, Finance/DPAPI/auth modules, dependency locks and workflows have no changes in this branch. No actual native Acrylic, WorkerW, Windows DPI or Explorer recovery test was performed.
- Security: dedicated gitleaks/trufflehog executables were unavailable. Full intended file contents and staged bytes received best-effort token/private-key/credential/user-path pattern checks plus manual diff review; zero pattern hits. This is not a comprehensive secret/PII scanner guarantee.

### Reproduce the focused browser check

Use existing installed dependencies and browser; no tool download is required by this script. Build with `node scripts/electron-p0/build.mjs` (no Electron app launch), then start a local production preview with `node node_modules/vite/bin/vite.js preview --config electron-p0/vite.config.ts --port 5285 --host 127.0.0.1`.

In a second terminal, run `node scripts/electron-p0/check-soft-rose-renderer.mjs`. If the installed Playwright browser is elsewhere, set process-local `SOFT_ROSE_BROWSER_PATH` to that existing browser executable; `SOFT_ROSE_PREVIEW_URL` may select another credential-free 127.0.0.1 HTTP preview. The script uses only synthetic bridges/data and fresh nonpersistent browser contexts. It never starts Electron, attaches to an installed app, reads user profiles or executes Native Host. Stop the preview process started for this check afterward.

The Native implementation proposal and its separate execution approval gates are in [DESKTOP_SURFACE_NATIVE_SOFT_ROSE_PLAN.md](DESKTOP_SURFACE_NATIVE_SOFT_ROSE_PLAN.md). Current preparation completion does not authorize the proposed implementation todos.
