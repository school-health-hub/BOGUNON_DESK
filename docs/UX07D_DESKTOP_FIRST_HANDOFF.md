# UX-07D Desktop-first — Windows closure

Date: 2026-11-12 KST. Verdict: **PASS for UX-07D**. UX-07E is eligible for a separately authorized task; it was not started.

## Source and publication

- Repository: `school-health-hub/BOGUNON_DESK` (public).
- Branch: `codex/electron-h6-design-renewal`.
- Starting source: `60ad19df012878c2cad7b39a0749a0d2cd4c946f` (UX-07C final PASS).
- Verified product source: **`06deb6abcd56e8e01f93a1a389082dae3e9cdc06`**.
- Clean build metadata and running `electronP0.info().sourceSha` both matched that product commit; `dirty: false`.
- This handoff is a subsequent documentation-only commit. Obtain its exact HEAD with `git log -1 --format=%H -- docs/UX07D_DESKTOP_FIRST_HANDOFF.md`; do not substitute that documentation hash for the build's product SHA.
- Final publication checks: normal push only, remote HEAD equals local HEAD, upstream divergence `0/0`, clean working tree. The final command results accompany the completion report. No main merge, force push, Portable packaging or deployment.

## Implemented

1. Desktop-first startup: primary-display Palette and existing Dock appear; Workspace and Settings load hidden. Explicit entry restores the same Workspace. A second process exits normally and reuses the original instance. Tray/menu recovery, readiness timeout and Palette failure handlers retain an accessible Workspace/error route.
2. Dock entry: seven existing module destinations dispatch through the existing Workspace owners. Finance dirty cancellation and Newsletter busy refusal remain authoritative. One pending owner transition wins; no duplicate module/window owner is created. A loading fallback registry rejects navigation/OS close before an unmounted owner can lose a close request; the user receives a retry notice.
3. Independent Settings: singleton BrowserWindow, existing SurfaceSettings UI, one Main settings authority and revision-checked writes. Workspace, Settings and Palette receive committed changes without write echoes. Local school configuration invalidates cached views through payload-free notifications. Quit freezes both settings editors, drains queued saves, and waits for both acknowledgements; failure cancels quit and resumes the editors.

Main changes: `electron-p0/main/main.mts`, desktop navigation/settings authority/IPC/flush helpers, separate Settings preload and renderer, PaletteDock, guarded P0 navigation, shared settings hook and loading reporter, focused tests, Vite entry and DESIGN.md. FinanceHost/InventoryHost changes only wrap loading placeholders; their business guards, data APIs and persistence logic were not changed. AI Settings uses existing configuration controls without generation capabilities.

## Preserved contracts

- UX-07C transparent, frameless, non-always-on-top Palette; primary monitor only; no WorkerW or Shell embedding.
- TD2 v1, 13 widget types, existing IDs and 12-column geometry; Dock v2 IDs/schema unchanged. Twelve widgets visible in the default synthetic layout; the notification widget remains hidden.
- No TD2/Dock migration. Changing appearance preserved widget geometry and Dock values; toggling the existing optional Official Document Dock item immediately updated Palette.
- Existing Finance SQLCipher/DPAPI owner, sensitive-view unmount and Newsletter keep-alive/close contracts retained.
- No operational SCHOOL authentication, database, Finance profile or original user data accessed. All generated data lived in explicit E: QA profiles. No other processes were terminated.

## Validation

Environment: actual Windows, Node **24.15.0**, Electron **45.2.1**, Chromium **156.0.8078.75**; 1920×1080 display at 100%. Independent Settings also inspected at 980×700. No new dependencies were installed for this work.

| Check | Result / evidence scope |
| --- | --- |
| Focused tests | **103/103 PASS, 13 files**, final loading-fix source; `focused-loading-final.log` |
| TypeScript / Electron production build | **PASS**; existing build script checks Main, renderer and test TypeScript; `build-clean-source.log` |
| `git diff --check` | PASS |
| Palette-only initial startup | PASS; Workspace/Settings hidden, including after profile restart and clean-source launch |
| Native Windows Dock click → Inventory | PASS; first empty-profile entry, no school onboarding pre-emption |
| Same Workspace / second launch | PASS; BrowserWindow ID 1 reused; second process exit 0 |
| Workspace close / reopen | PASS; Palette stays visible, same Workspace restores |
| Settings close / reopen / save | PASS; ID 3 reused, saved appearance and Dock restored after full restart; no horizontal overflow at 980×700 |
| Finance dirty leave cancel | PASS; real isolated native SQLCipher/DPAPI engine, synthetic unsaved input retained; accepted leave unmounts Finance |
| Newsletter busy close / navigation | PASS; production owner UI in actual Electron with a QA-deferred native-save-dialog result; native title-bar close and Dock entry refused while busy, then cancellation released busy state. This does not certify a physical save dialog or file output. |
| Palette taskbar exclusion | Prior UX-07C native group PASS reused; current actual desktop still showed one Electron taskbar button and no separate Palette button. No repeated group-thumbnail audit. |
| Palette Alt+Tab exclusion | PASS in actual Windows before/after Palette hide/show: one real Workspace card, no Palette card. Three pre-existing blank cards remain separate non-blocking issue `EXISTING-SHELL-ALTTAB-01`; original HWND/cause NOT VERIFIED. |
| Transparent gap | PASS; native trusted click reached only an inert synthetic receiver (1 click), not desktop icons or personal apps |
| Loading race | Reproduced FAIL, fixed, then actual Electron retry PASS; no stranded pending transition; `lazy-owner-race-{before-fix,green}.json` |
| Normal exit | PASS, including clean-source launch; owned QA Electron/native Finance process count 0 afterward |

Five independent review lanes completed: goal/constraints, code/races, security, focused tests, context/visual review. Final code/security findings were resolved. Screenshot review found no blocking overlap/clipping in supplied Palette, Workspace and Settings captures.

The investigation preserved RED/harness-error logs rather than hiding failures. Fixed issues: hidden-start onboarding intercepting first entry; settings recovery overwriting another window; queued edits lost at shutdown; missing Settings CSP; nested lazy-owner close acknowledgement lost during rapid entry.

## Evidence and limits

Private local evidence: `E:/BOGUNON_DEV/qa-output/UX07D_20261112/`. Includes build/test logs, synthetic screenshots, provenance, restart/geometry checks, RED/GREEN records and SHA-256 manifest. `03-finance-dirty-cancel.jpg`, `06-final-palette.jpg`, `07-final-dock-inventory.jpg`, `10-settings-980.jpg` are actual Windows captures. Alt+Tab originals are marked private; the title-strip crop is labeled as a derivative.

Raw screenshots, QA profiles, logs and ignored `.omo` planning files are **not uploaded**. Only code/tests/design and this non-sensitive summary are published. Credential-pattern scanning of the entire intended source/staged package found no matches; gitleaks/trufflehog were unavailable, so this is best-effort scanning plus independent review, not a guarantee. No secrets, environment files, DPAPI state or database contents are included.

NOT RUN / excluded: operating Google/SCHOOL/MFA, original Finance data, physical printing, 125%/150% display scaling, full regression, Portable build, UX-07E multimonitor, UX-07F redesign. SCHOOL installation and ordinary Workspace Gate remain CLOSED. These excluded validations are not claimed as PASS.

Git synchronization is separate from cross-PC evidence transfer: raw Windows evidence remains on the home PC. This document does not claim a complete remote-only evidence handoff or that another PC was tested.

## Reproduction and next step

For an existing clean worktree at the product source, use Node 24 with existing lockfile dependencies. Do not reset or overwrite other worktrees. Build with `npm run electron:p0:build`. Full `electron:p0:test` and old all-module E2E suites were intentionally not run; they are not the focused validation command below.

```powershell
node node_modules/vitest/vitest.mjs run electron-p0/tests/desktop-navigation.test.ts electron-p0/tests/desktop-surface-preload.test.ts electron-p0/tests/desktop-workspace-navigation.test.tsx electron-p0/tests/palette-dock.test.tsx electron-p0/tests/settings-renderer.test.tsx electron-p0/tests/surface-settings-authority.test.ts electron-p0/tests/surface-settings-ipc.test.ts electron-p0/tests/surface-settings-sync.test.tsx electron-p0/tests/workspace-entry-transition.test.ts electron-p0/tests/workspace-lifecycle-contracts.test.tsx electron-p0/tests/school-settings-invalidation.test.tsx electron-p0/tests/school-settings-notification.test.ts electron-p0/tests/surface-settings-flush.test.ts --maxWorkers=1 --no-file-parallelism
```

Any future Windows smoke must set a new GUID `ELECTRON_P0_TEST_RUN`, `ELECTRON_P0_QA_PROFILE=1`, an existing `ELECTRON_P0_QA_ROOT` strictly inside `RUNNER_TEMP`, and process-only TEMP/TMP on the approved QA disk. Launch `node_modules/electron/dist/electron.exe build/electron-p0-app`; confirm build metadata before input. Preserve original profiles and evidence. Prerequisites/DPI on a receiving PC require its own check.

Next: await separate UX-07E instruction. No UX-07E implementation or additional QA project was started.
