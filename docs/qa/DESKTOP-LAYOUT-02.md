# DESKTOP-LAYOUT-02 integration handoff

- Implementation branch: `codex/desktop-layout-02-implementation`.
- Starting commit and merge base: `fb22ef9b4319b035c1019a6570639b1dc6948e41`.
- Beta.13 dialog candidate: `740fca00bd6de30b947e7de4554057058de5c9d0`. Review both branches' edits to `electron-p0/main/main.mts`; the new placement IPC is in the Desktop Surface handler group. Settings and Palette renderer files have no direct overlap with that candidate.

Board placement is an optional field in the existing device-local Desktop Surface document. Existing documents read without migration. Shared mode reserves a configurable 20–25% left inset. Dedicated mode with an explicit connected target projects existing profiles onto the two affected screens without modifying ownership, saved widget coordinates, widget visibility, or the saved Dock preference. A missing target keeps its preference and uses the primary screen's shared bounds until reconnection.

Run the focused Vitest suites for surface mode, Palette lifecycle and preload, Palette geometry and board bounds. Build with `npm run electron:p0:build`; run `node node_modules/@playwright/test/cli.js test --config electron-p0/playwright.config.ts desktop-board-bounds` in the isolated checkout.

Physical single-monitor testing is deferred. The DIP work-area matrix is synthetic. Mixed-DPI hot unplug and reconnect also require physical follow-up. Preserve the Windows topology and use a separate QA profile for app launches.

Windows dual-display verification passed for existing Palette bounds, the shared preset on primary, 25% inset, Settings cancel/default/apply, unchanged widget profiles and Dock preference, and persistence on orderly exit. The focused suites passed 28 tests. The local Electron build passed, with a final Main recompilation before GUI QA.

Conditional follow-up: physical single-monitor QA, physical hot unplug/reconnect, explicit secondary target GUI, and a fresh app relaunch against the saved QA profile. The profile data was checked after exit. Screenshots are local QA evidence under the ignored Playwright output directory.
