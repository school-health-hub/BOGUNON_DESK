# BETA13-INTEGRATION-01

- Branch: `codex/beta13-integration-01`
- First parent: UX-DIALOG-01 `740fca00bd6de30b947e7de4554057058de5c9d0`
- Second parent: DESKTOP-LAYOUT-02 `ba8a5e1ee375829a693eeba6918cf4c37544a0ac`
- Merge base: `fb22ef9b4319b035c1019a6570639b1dc6948e41`

The three-way merge applied all 13 Desktop Layout paths to the UX baseline without manual conflict resolution. The only common changed source path was `electron-p0/main/main.mts`. Its Desktop Surface parser import and sender-checked placement handler were added alongside the UX branch's Rose confirmation import and existing work-folder and Newsletter confirmation callbacks. UX-DIALOG-01's Newsletter E2E remains in the tree.

Use `git diff --name-status 740fca00bd6de30b947e7de4554057058de5c9d0 HEAD` for the integrated file list. Physical single-monitor and hot-unplug tests require a separate QA session. Existing Windows topology is retained.

## Verification

| Area | Result | Evidence |
| --- | --- | --- |
| TypeScript and Electron production build | PASS | `npm run electron:p0:build` completed. Local auth configuration was absent. |
| Focused regression | PASS | 74 tests across 9 suites covering board bounds, Desktop Surface profiles, Palette lifecycle and preload, Settings persistence, Newsletter export and projects, and isolated updates. Updater suite used a dedicated `UPDATE_QA_TEMP`. |
| Physical dual-display Windows | PASS | App start, Settings open, cancel/default/apply, 25% primary shared inset, explicit secondary selection and movement of the Dock-bearing Palette, isolated profile save and relaunch, unchanged saved profiles, and clean app exit. |
| Newsletter Windows GUI | PASS | Palette Toolbox opened Newsletter in Workspace. Main-owned confirmation and A4 PNG/PDF export exercised with a synthetic document. |
| Single-display geometry | PASS (synthetic) | DIP work-area matrix. Physical single monitor, hot unplug/reconnect and physical mixed DPI remain NOT RUN. |
| Design comparison | CONDITIONAL | Captured starter cards have readable Korean text and distinct surfaces. Controls in the screen layout panel are crowded, and the lower-centered Dock still looks separate from the right-aligned cards. Calendar and actual wallpaper/icon legibility were not exercised. |

E2E QA-only edits add explicit Windows Electron execution for Newsletter and a short isolated profile, secondary choice, and relaunch assertions for screen layout. The first screen-layout run reached persistence but compared an in-memory optional field with JSON that omits it. The corrected run passed. The initial updater invocation lacked `UPDATE_QA_TEMP`; the isolated rerun and the final focused batch passed.

Local captures are under `artifacts/beta13-board/` (Settings, shared and dedicated Palette) and `artifacts/beta13-newsletter/newsletter-confirmation-before-save.png`. The Palette captures show the app surface; Windows icons and wallpaper were outside the capture. Independent visual approval, Newsletter unsaved-close, real update installation and installed beta.13 validation remain NOT RUN.
