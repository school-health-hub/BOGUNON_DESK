# UX-07E Multimonitor handoff — CONDITIONAL WIP

## Checkpoint and scope
- Branch: codex/electron-h6-design-renewal; baseline 0d5afb3a091248a76d21ca536749500e681066b9.
- Product Source SHA: 55e367fe3564a01ed2044b3bd757b324ae9b3b2b (WIP, not acceptance or deployment approval).
- Final documentation HEAD is the commit containing this note; resolve with git log -1 -- docs/UX07E_MULTIMONITOR_HANDOFF.md. Remote equality/divergence and clean state are verified after push and reported in the completion message; not fabricated in advance.
- UX-07F NOT STARTED; physical multimonitor acceptance remains required before advancing.

## Actual Windows environment
2026-11-12 home Windows PC: ONE physical display, Generic PnP Monitor, Electron display ID 492345937, primary. DIP bounds (0,0,1920,1080), workArea (0,0,1920,1032), scaleFactor 1. Physical pixels 1920x1080 at origin (0,0). No Windows display configuration changed. Electron 45.2.1 / Chromium 156.0.8078.75; Node 24.15.0. E: isolated synthetic userData/session/temp only. C: reached about 580 MiB free during work and later about 2 GiB without cleanup by this task; remeasure before resuming. No installs or personal-data cleanup performed.

## Implementation
Changed files are enumerated by git show --stat 55e367f. Main additions: palette-registry.ts, palette-host.ts, topology-reconciler.ts, windows-monitor-identity.ts, monitor-profiles.ts, monitor-profile-store.ts, monitor-ipc.ts, recover-surface.ts and monitor-protocol.ts. Settings adds MonitorProfilesPanel.tsx and CSS. Existing Main, Palette renderer and restricted preloads integrate these services; DESIGN.md records the conservative E policy. No separate tracked UX-07A monitor identity algorithm was found; this implementation does not mislabel its policy as previously approved.

- Registry owns one live Palette per current display ID, with independent readiness, visibility, hit regions and failure recovery. Retired sender/callbacks cannot affect replacement windows. Workspace and Settings retain singleton owners. No WorkerW, always-on-top or new business sessions.
- Fixed read-only USER32 probe matches native physical monitor geometry to Electron DIP geometry. Stable key hashes machine scope + PnP model + device-interface path; Electron ID, primary/order, coordinates, resolution and DPI are not permanent identity. Raw native paths/hostname are not persisted or sent to Renderer. Connector/driver changes can produce a new key: old profile remains dormant rather than guessed or overwritten. Missing/duplicate/ambiguous identity uses ephemeral read-only profiles.
- Separate local poc-settings/monitor-profiles.json version 1 stores UUID mappings, last display/bounds/scale, visibility, connection/dormancy and layout references. Last valid backup is monitor-profiles.backup.json. No cloud synchronization. Existing TD2 version 1, all 13 widget IDs, 12-column x/y/w/h/visible semantics and shared Dock version 2 remain unchanged.
- Initial layoutRef=legacy reads existing Workspace settings without writing them. Only explicit monitor Apply materializes that monitor's TD2 override. Dock remains shared. Monitor sidecar is authoritative only for local mappings/layout overrides, not tasks/memos or sensitive business data.
- Added/removed/metrics events reconcile a debounced final topology serially; generation checks suppress stale window changes and publication after async persistence. Detached profiles/layouts survive as dormant. Direct writes to dormant/disconnected/uncertain profiles and writes during settling/quit are rejected. Existing profile bytes are preserved on conflicts.
- Corrupt/missing primary with backup enters read-only recovery; both invalid enters read-only fallback. No silent repair/reset/overwrite. Writes use CAS, validation, backup-before-primary and atomic store. Persistence failure fails read-only.
- Workspace/Settings bounds recover within available workAreas, including negative coordinates and small areas; Palette coordinates remain separately managed. Last-Palette/no-tray loss exposes Workspace. Quit cancels pending topology/readiness work.
- Palette preload remains fixed and restricted: no Finance/SCHOOL/AI/file/raw IPC. Monitor editing IPC exists only in Settings with exact sender, main-frame and URL checks. Projection messages carry per-monitor layout separately from original shared settings.

## Focused validation
Final affected selection: 15 files / 112 tests PASS. Earlier independent 114-test selection is a different file selection, not an equivalent final count. Coverage includes 1/2/3 synthetic displays, identity/order/ID/primary/DPI/negative/vertical/workArea changes, reconnect/dormancy, ambiguity, duplicate/rapid events, stale callbacks/persistence, layout CAS, backup/corruption, existing legacy fallback, per-monitor projection, preload restrictions, Dock/navigation and settings authority regressions. Tests are mocks/synthetic topology, never physical hardware acceptance.

Commands: node node_modules/vitest/vitest.mjs run [the following electron-p0/tests files] --no-file-parallelism --maxWorkers=1:
monitor-platform.test.ts, monitor-profiles.test.ts, monitor-profile-store.test.ts, palette-registry.test.ts, monitor-profiles-panel.test.tsx, palette-projection.test.tsx, desktop-palette-preload.test.ts, desktop-surface-preload.test.ts, desktop-palette-window.test.ts, desktop-palette-layout.test.ts, palette-dock.test.tsx, desktop-navigation.test.ts, surface-settings-ipc.test.ts, surface-settings-authority.test.ts, surface-settings-sync.test.tsx.

node scripts/electron-p0/build.mjs PASS: Main/Renderer/test TypeScript checks and production Vite builds. Existing chunk-size warning remains; public auth configuration absent, login disabled. git diff --check PASS after trailing blank-line cleanup. No Rust full build, Portable or whole business-module regression.

## Actual Windows GUI results
| Item | Result / evidence limit |
|---|---|
| Desktop-first, one actual monitor Palette | PASS; Workspace/Settings hidden at startup |
| Native widget input | PASS; trusted monthly-calendar click delivered to Palette, Workspace subsequently shown |
| Transparent blank area | PASS; native click delivered to inert synthetic QA background only, not another user app |
| Dock | Native toolbox/menu click PASS; native Official Document destination request showed document category. Final module content not asserted: NOT VERIFIED for that specific E GUI route; focused routing tests PASS |
| Independent Settings/profile editor | PASS; native Apply, layout override and visibility updates; same Settings window reopened |
| Per-monitor hide/show | PASS; same Palette ID, no duplicate |
| Profile restart restore | PASS; same UUID, explicit layout reference and hidden clock restored |
| Legacy data compatibility | Synthetic new profile global layout file remained absent before/after monitor writes; Dock retained 7 default items. Existing real user files were not accessed, so real-user byte preservation NOT VERIFIED |
| Workspace close | PASS; hides Workspace, Palette remains; Settings independent |
| Alt+Tab | Actual Windows switcher with Palette visible and Workspace/Settings hidden showed Codex and the 3 preexisting blank cards, no additional Palette card. Ownership of old cards remains NOT VERIFIED (EXISTING-SHELL-ALTTAB-01) |
| Taskbar | Existing UX-07C/D group PASS reused; no separate current Palette item observed. Group expansion not repeated for E |
| Source provenance | Clean product build metadata sourceSha=55e367fe3564a01ed2044b3bd757b324ae9b3b2b, dirty=false; final actual launch one Palette, hidden singleton Workspace/Settings |
| Normal quit | PASS; all three E QA launches closed normally; final matching QA Electron process count 0 |
| Physical 2/3 monitors, cable hotplug/reconnect, mixed physical DPI, actual negative/vertical desktop | NOT RUN — one physical monitor available |

No operational Finance DB, SCHOOL auth/MFA, Supabase or personal records used. Business guard confidence is focused regression/static boundary review, not a new operational GUI PASS.

## Evidence / preservation
Local evidence: E:/BOGUNON_DEV/qa-output/UX07E_20261112; eRun synthetic profile is retained under E:/BOGUNON_DEV/temp/ux07e-bce3160c-9759-4699-aa46-d0759d99f857. Original captures/logs and evidence-manifest.json remain local, NOT uploaded. Private raw Alt+Tab capture includes the Codex thumbnail and is excluded from public transfer; 06-alttab-cards-crop.png is explicitly a cropped derivative. Raw evidence is not remotely portable: this is Git preservation, NOT a full cross-PC HANDOFF READY claim. Ignored .omo planning/review scaffolding is local supplemental material, not a runtime dependency.

| Local evidence | SHA-256 |
|---|---|
| focused-final.log | caefa6352d71b919583dd6769db35c236d2f8b38b648ccda5c41c9e4c579e239 |
| build-source-55e367f.log | b517b56aa56f7bc6cb821e978b502c36705bdad82bb0d0284eabc794a5b99618 |
| gui-results.json | d24d66bbb46c7df226628d6e85e5f55f955b3d69ab4debce4adc638582100eb7 |
| source-provenance.json | 8f937c675995d7b429f8d224a107af4630d9335ab72e65b77cef030c9a8bf8d6 |

Five review lanes rechecked lifecycle/security/stale-topology fixes; approved synthetic capture regions had no blocking visual finding. Best-effort secret-pattern and manual changed-file review found no credentials/private records in the 29-file product checkpoint; no dedicated secret scanner was available, so residual detection risk is not zero. Public Git receives only code/tests/design and this non-sensitive summary, not profiles/logs/screenshots.

## Remaining acceptance and next action
CONDITIONAL WIP. Obtain a safe physical dual-monitor Windows setup and verify per-screen input, actual cable remove/reconnect, same profile restoration, mixed DPI and Workspace/Settings recovery without altering user display settings without approval. Verify exact Dock module content in that smoke. Preserve detached profiles and original stores. UX-07F remains on hold. Existing old Shell cards are separate nonblocking unknown-origin issue. No further implementation stage or deployment is authorized by this checkpoint.

## UX-07E-R1 physical acceptance closeout — 2026-11-12

- Starting local HEAD and live remote branch both b05631563a97461f5c69c922d605844e05ffa9ec; working tree initially clean. Product remains 55e367fe3564a01ed2044b3bd757b324ae9b3b2b. Existing build-meta.json reports that SHA with dirty=false; no new executable was built or launched in R1.
- Current read-only Windows Screen enumeration: ONE active display, primary DISPLAY1, bounds (0,0,1920,1080), workArea (0,0,1920,1032). Independent existing USER32 native monitor probe also returned ONE attached monitor with physical geometry (0,0,1920,1080). Device-interface identifiers were not printed or added to Git. WMI inventory did not complete promptly; no claim relies on it.
- R1 physical multimonitor GUI: NOT RUN. Per-monitor Palette count/input, independent layout persistence across two physical displays, cable removal, same-device reconnect, mixed physical DPI, all-Palette Shell exclusion and multimonitor window recovery remain NOT RUN. No dual-monitor attempt or simulated physical PASS was made.
- Prior 112 focused PASS, TypeScript/build PASS and single-monitor GUI evidence are reused, not rerun. R1 created no QA app, profile, test data, screenshot or QA Electron process. No product code, TD2/Dock data, dormant profiles or user settings changed.
- Evidence: R1 is read-only textual hardware inventory recorded here; no new Windows GUI capture. Prior original Windows evidence remains at E:/BOGUNON_DEV/qa-output/UX07E_20261112 with its existing local manifest. It is not a remote evidence transfer.
- Required acceptance environment: two or more actually connected physical displays; safe synthetic QA profile and clear input areas on each; user approval before physical cable changes or Windows display-setting changes after checking other work. Mixed-DPI PASS additionally requires actual distinct physical display scaling. Do not infer it from mock tests or the current single display.
- Verdict: CONDITIONAL WIP retained, no new defect observed and no claim of physical acceptance. UX-07F remains on hold. Resume only the remaining physical scenarios when that equipment and approval are available.
- This documentation checkpoint's final HEAD is resolved with git log -1 -- docs/UX07E_MULTIMONITOR_HANDOFF.md. Live remote equality, divergence and final clean state are checked after its normal push and included in the completion report.
