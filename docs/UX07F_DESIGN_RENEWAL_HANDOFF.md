# UX-07F Desktop-first design renewal — CONDITIONAL WIP

## Source and approval boundary
- Branch: codex/electron-h6-design-renewal. Start: f541a11592e511acb1821c72b6957ac7a5653ff8 (local and live remote clean/equal).
- Final product Source: ddcdafa72823632e0fef5ce8a95138d1d9dc4d27. Final actual build-meta.json: that sourceSha, dirty=false.
- Documentation HEAD is the commit containing this note; resolve with git log -1 -- docs/UX07F_DESIGN_RENEWAL_HANDOFF.md. Live remote equality, 0/0 divergence and clean state are checked after normal push and reported separately, not assumed in advance.
- User explicitly authorized UX07F while UX07E stays CONDITIONAL. E physical multimonitor/hotplug/mixed-DPI acceptance is unchanged and remains a separate school-PC task. No E lifecycle, profile mapping, dormant data or storage changes.
- No standalone original UX07A image/packet was found. User confirmed DESIGN.md, B–E records and existing Desktop-first principles suffice: independent widgets, compact Dock, focused Workspace, independent Settings, navy/pastel/white. No missing image was fabricated or claimed found; no pixel-fidelity approval to an unseen original is claimed. Historical rose approval captures and later H6/D captures were inspected as historical/context references, not copied assets. SsamBoard informed flow only.

## Differences and implementation
Before: Palette omitted shared material/chrome rules, Settings and module controls had duplicate values, legacy dashboard padding left an empty 64px rose strip, Home actions overlaid the topbar date, Purchase used an over-wide persistent panel, and work surfaces mixed presentation languages.

- Shared token source: electron-p0/renderer/desktop-design-tokens.css. Existing H6 navy/ink/teal/mint/white, status colors, spacing/type scale, control/surface/glass radii, focus, translucent fill and shadows. All three renderer entrypoints import it. Existing styles remain where they own stored appearance or domain semantics; no new external assets/fonts/dependencies.
- Palette: frosted separate cards with translucent rim, inset highlight and low navy shadow. Entire background remains transparent. Saved flat/compact appearance is reflected through data attributes, with opaque/no-blur fallback and reduced-transparency support. TD2 v1/13 IDs/12 columns/geometry unchanged.
- Dock: compact translucent navy shelf, existing labelled targets and seven-module menu, visible focus/hover/pressed treatment. Dock v2, routes and guard owners unchanged. No OS running-state inference.
- Workspace: desktop-workspace-refinement.css provides screen-only compact chrome, common work surfaces/controls, purposeful table scroll and container-based responsive grids. Legacy root padding is overridden only for AppShell; Home actions use layout flow. No saved coordinate change. Home wide overflow seen during transition disappeared after settling; final root/outlet/dashboard widths match.
- Settings: single existing navigation, compact header/fields, readable disabled controls, existing monitor editor. No new setting or duplicate authority. About retains technical diagnostics in a native disclosure. Existing business names remain; routine Electron/PoC/Workspace/revision labels are reduced where safe. Technical failure details and safeguards remain available.
- Seven modules: common header/control/list/table surfaces; Official 1200 retains side-by-side form/preview and 900 stacks; Purchase fits available width without replacing its session owner; Finder select is a normal 40px control; Inventory retains local/shared boundary; Finance helper preserves Korean word endings; Newsletter output artwork/export rules and SCHOOL authorization remain untouched.

Changed files: git diff --stat f541a11..ddcdafa. Main changes live in Renderer styles/entry imports, presentation-only labels in AppShell/P0App/SurfaceSettings/monitor editor/FinanceHost/InventoryHost/Newsletter controls and two shared module text views. No Main, preload, RPC, authentication, calculations, IPC or data-format changes. useSurfaceSettings changes only saved-status wording.

## Tests and review
- Focused unique selection: 15 files / 110 tests PASS across separate final runs (14 files / 96 plus dashboard-gesture / 14). No combined final 110-green run is claimed. Palette appearance projection: 2/2 PASS rerun after its additional presentation attributes, already part of that unique selection.
- Initial RED retained: focused-final.log = 96 PASS /14 FAIL; current SurfaceSettings bridge was missing in an old dashboard fixture. Bridge-only update yielded 12/14, then current guarded-navigation and truthful recovery-status expectations yielded 14/14. Product behavior was not weakened to make tests pass. focused-final-green.log is misleadingly named and actually contains 109 PASS /1 FAIL; do NOT cite it as final green.
- 56ea1da preserves the fixture repair separately. Related copy expectations and Palette projection assertions protect current status semantics, geometry/no-write and saved appearance behavior.
- Final node scripts/electron-p0/build.mjs PASS: Main, Renderer and test TypeScript + Electron production Vite builds. Existing large-chunk warning remains; public auth configuration absent, login disabled. No Rust full build, Portable or unrelated full regression.
- Focused files: widget-state-notices, settings-renderer, unified-settings-center, monitor-profiles-panel, palette-projection, palette-dock, app-shell-navigation, desktop-workspace-navigation, desktop-navigation, desktop-palette-layout, desktop-palette-preload, palette-registry, surface-settings-sync, dashboard-gesture and src/newsletter/NewsletterStudio.test.tsx. Run with Node24, vitest run and --no-file-parallelism --maxWorkers=1.
- Five review lanes inspected goal/scope, code, security, focused tests and context; two independent visual reviewers opened 42/42 captures and six supplemental states. Their review found and drove the Home overlap/CJK/Official-width/settled-loading corrections. Final scoped visual review PASS; comprehensive product acceptance remains CONDITIONAL.

## Actual Windows QA
Physical screen: ONE monitor 1920x1080, workArea 1920x1032 DIP, scaleFactor1. Electron45.2.1/Chromium156, Node24.15.0. Only Codex was open before QA; no other app was closed. Synthetic profile/temp/appData/session are on E:, separate from default user profiles. First launch attempt used an invalid QA root=TEMP configuration and was rejected before app setup; corrected the launch environment only. A disconnected test handle was recovered through the verified QA inspector and normal app.quit; no force kill or product security change.

42 final actual Electron renderer captures: Home + seven module boundaries + Settings account at outer Windows sizes 1920x1080,1440x835,1200x800,900x680 (client sizes differ by native chrome), plus six narrow Settings sections. These are Electron pages, not browser substitutes. Module-ready controls and 400ms resize settling preceded capture. All final root/outlet/Home-dashboard overflow checks PASS. OS-resolution/DPI settings were not changed.

| Surface/contract | Result and limit |
|---|---|
| Home and seven module boundary layouts at four sizes | PASS in captured empty/available/unavailable states; no clipped actions/overlap/page overflow after corrections |
| Official / Purchase / Finder / Inventory | Actual settled local empty forms/list/search surfaces PASS; no actual files imported or external API used |
| MY FINANCE | Isolated QA empty store only; entry enabled and form readable. Synthetic unsaved payer draft retained when leave confirmation cancelled; then explicitly discarded without saving |
| Newsletter | Empty document/file-action boundary PASS; busy close guard covered by existing focused tests, actual busy output NOT RUN |
| SCHOOL | CLOSED/unconnected boundary PASS only; real login/MFA/shared records NOT RUN |
| Settings | Seven destinations, compact select, native diagnostics disclosure, 3px keyboard focus, readable disabled login at opacity1 PASS. Flat setting saved/restored, then default saved/restored on same synthetic profile |
| Native Palette | Actual 1920x1032 workArea PASS; trusted calendar input showed Workspace; trusted blank gap reached inert synthetic background only |
| Dock / singleton windows | Native toolbox click, seven-item menu, hover and existing Official route PASS. Single Workspace/Settings/Palette on one monitor, independent close/re-entry preserved; fourth QA window is inert background only |
| Taskbar / Alt+Tab | Prior C/D/E native PASS and unchanged window options reused; no new full F taskbar-group/Alt+Tab evidence claimed |
| Palette small-window experiment | NOT ACCEPTED: independently forcing the registry-owned window to other sizes caused hit-region rejection and fail-closed notice. Normal restart at real workArea restored it. Actual small physical displays/display-event impact is NOT VERIFIED; not dismissed as a proven non-product issue and not bypassed by changing E logic |
| Populated records, all errors/modals, output layouts, busy Newsletter native flow | NOT RUN / incomplete; boundary captures do not certify every work state |
| Physical multiple monitors, cable removal/reconnect, mixed DPI | NOT RUN; UX07E remains CONDITIONAL |
| Normal termination | PASS; final matching QA Electron processes 0; no forced termination |

## Evidence and provenance
Local originals: E:/BOGUNON_DEV/qa-output/UX07F_20261112. evidence-manifest.json lists 48 accepted final visual files and every retained file's size/SHA256. visual-metrics.json identifies final source and exact requested/client sizes; native-results.json records trusted input, focus, guards and limits; source-provenance.json contains build/runtime/display facts. Native screenshots use an inert synthetic background rather than personal windows. Forced-resize final-palette-* error images and provisional files are excluded from visual acceptance. Intermediate final-path captures were superseded during iteration; only the final manifest set is the retained acceptance original, not a claim that every intermediate image survived.

| Evidence | SHA256 |
|---|---|
| build-source-final.log | 6e511baf03bd539d5438c99a3649796aefaea4a33cf4490a61892789048aa7bf |
| dashboard-gesture-green.log | 347b7908a778993815b0e2c26bf72334d223cdca436c26e49ef7f7bffe034e29 |

The explicit profile root is E:/BOGUNON_DEV/temp/ux07f-ce0eed08-e5d1-4243-8729-b412322cdc2d; retained as synthetic local QA state. No existing user JSON, Finance/DPAPI, Docker, backup, VHDX, production DB or credentials were accessed or altered. No operational network/auth tests. Production profiles were not hashed/read, so real-user byte integrity is not newly certified.

Public Git receives only code/tests/DESIGN and this non-sensitive note. Original captures/logs/profiles and ignored .omo plan remain local; no sensitive evidence upload. Best-effort full intended source/note secret-pattern/manual review found no credentials/private records, but no dedicated secret scanner was available. Source Git sync is not a full remote-only evidence HANDOFF READY claim.

## Verdict and next approved boundary
UX07F CONDITIONAL WIP. Implementation, focused tests, final build and captured boundary visual QA are complete; remaining Palette resize behavior and comprehensive populated/error/busy/output states prevent a full PASS. Existing B/C/D contracts are preserved; E physical acceptance is neither waived nor upgraded. Continue only those scoped acceptance gaps when authorized; full integrated QA, main merge and deployment have NOT STARTED. No new feature stage or operational gate is enabled by this checkpoint.
