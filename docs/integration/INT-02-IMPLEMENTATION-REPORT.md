# INT-02 RC2 + UX-11 independent candidate verification

Date: 2026-11-18 (Asia/Seoul). Scope: independent synthetic Windows candidate; no deployment approval.

## Source and integration
- Repository: school-health-hub/BOGUNON_DESK (public).
- Candidate: integration/int-02-rc2-ux11-candidate.
- First parent / exact RC2: 162dd2873efa8ac2a42d71d09add130dee0f3d83.
- Second parent / sole cumulative UX-11 merge: be3b6ac35dcb07bb2a9976497b39241f343ab411.
- Audit: integration/int-01-rc2-design-audit@14873c84b530c72e5683e207a7515d471209c3cb.
- One --no-ff --no-commit merge; zero textual conflicts; no ours/theirs replacement.
- 137 RC2-exclusive and 136 UX-exclusive paths retained exactly at initial merge.
- Shared builder.json retains Newsletter AI protocol and app icon. Main retains RC2 Account/AI/Newsletter/lifecycle contracts and adds UX icon only. P0App retains UX11 composition and the RC2 Newsletter onOpenAiSettings callback.
- Tested source: 277-file raw SHA-256 manifest; digest 0FCC4BB006820E91392B47591E068C5E122A5AE8236EA05E8C70B44D781FFEF0. All 277 files rechecked unchanged after final regression and GUI.
- Build metadata reports first-parent RC2 HEAD plus dirty=true because the integration was intentionally not committed until verification. This is not a claim that the build was a clean RC2 build or a previously committed merge.

## Necessary integration verification repairs
No further product renderer, authentication, IPC, engine or schema changes were made after the merge. Ten additional config/test files repair existing RC2 verification problems:
1. tsconfig.json: ES2022 library and explicit Node/Vite types; target, strictness, includes and noEmit remain unchanged. Exact RC2 comparator reproduced all 39 initial diagnostics.
2. Six Newsletter test files: existing protocol/types, V2 narrowing, valid issue code, supported role-query options and illustration predicate.
3. account.test.ts: real login/vault setup uses normal deadline; only the operation under test uses 20ms. Network logout timeout begins after observing actual request entry. Real vault verification retained.
4. newsletter-ai-preload.test.ts: execute captured-owner cleanup registrations with destroyed webContents access; assert revocation/disposal instead of obsolete source literal.
5. ns03SkillMasterLayout.test.ts: assert seven cards, six exact pending-art layers and cover warning; no anonymous images or silently waived assertions.

Initial failures are preserved, not relabeled PASS: root TS39; focused128/2; first full1514/2/3. The two final full-suite failures also reproduced on exact RC2. No additional skip or product correction was used to pass tests.

## Automatic verification
- Node v22.23.3; npm10.9.9; Cargo1.98.1; Electron45.2.1; Vitest5.0.1.
- Independent E: node_modules; identical package/lock hashes; no original shared dependency writes. Approved prepare-tests.mjs generated fresh own CLI/fixtures: Purchase Rust59 PASS, Record Rust16 PASS.
- TypeScript: root, Electron Main, renderer and test configurations PASS. Root/test checks repeated after final test amendments; build rechecked relevant configurations.
- Focused: 19 files, 130 PASS /0 FAIL.
- Final expanded Electron + Newsletter regression: 233 files; 1516 PASS /0 FAIL /3 unchanged SKIP; exit0. Nested-suite count336 is not file count.
- Electron production build PASS (63.233s); runtime-package Node tests3 PASS. Required compiled protocol/icon/main/preload/renderer files checked.
- Fresh QA-only ChatGPT helper: cargo build --locked --manifest-path tools/chatgpt-auth-cli/Cargo.toml PASS. Offline attempt failed on absent cached crate; bounded online locked build then succeeded. Executable SHA-256 F31D979E0F5C445A38CA6ADFF2F317047F293C8DB2B8B6542CE1073A292B4FD3.
- Missing helper initially made optional ChatGPT status reject combined Newsletter status; preparing the unmodified helper resolved the observed failure and restored AI settings return. No provider call or authentication was made.
- Tests/builds serial; final elevated tests used fresh explicit user approval and manually executed once-only command files. Codex, CLI preparation, builds, TypeScript and Git remained normal privilege.
- Existing skips retained: actual denied file access; owned extraction timeout/cancel; actual denied work-folder access. No new skip.

## Fresh Windows GUI evidence
- 100% widget selection: 26 captures at1440x900,1366x768,1280x720,980x700 plus auxiliary560x700. Thirteen library cards, 3/2/1 columns, 48x48 switch targets, keyboard Space, all13 OFF/ON round trips, settings/Dock/memo preservation and restart PASS.
- Integrated cross-feature GUI attempt7:24 captures over four requested sizes; Newsletter AI-settings return and draft reentry, pending-output block, account logout-cancel/local settings preservation, Official import/save/close cancellation, Record close cancellation, post-Newsletter widget CSS, and three native close-hide/show cycles PASS.
- Native confirm/file-picker response selections were controlled at the Electron dialog boundary; product DOM, IPC and cancellation/state logic were real. These are not physical native-dialog click certification. One actual account confirmation was manually cancelled by the user during earlier diagnostic run.
- Direct mouse drag/resize: four recorded states and one capture; deliberate clock geometry changes, all IDs/Dock preserved, exact settings restored after restart PASS.
- Additional reachability:24 widget DOM measurements (12 initially visible widgets at980/1280), seven captures including D-Day/memo/quick-launcher and980 Official preview. Horizontal content reachable within clip after scrolling and usable above Dock; Official title/body and final ending readable. Programmatic scrolling does not certify manual scrollbar ergonomics.
- Final successful evidence totals:86 captures (26+24+1+14+14+7), excluding failed attempts and superseded diagnostics.
- Actual Windows125%:120DPI, zoom1, forcedDeviceScale=false,14 captures. Actual CSS sizes1440x736,980x700; auxiliary560x700.
- Actual Windows150%:144DPI, zoom1, forcedDeviceScale=false,14 captures. Actual CSS sizes1248x591,980x591; auxiliary560x591.
- User changed standard Windows scale dropdown under fresh approval;1920x1080 resolution unchanged. User restored100%; subsequent fresh Electron process measured scale1/zoom1. Unachievable requested heights at higher scale are NOT RUN, not simulated PASS.
- Two independent fresh visual lanes inspected actual captures/DOM. Earlier failed controller attempts retained. No claim that initial failed controller reports passed.

## Functional preservation and limitations
- RC2 login/logout/session/security contracts: synthetic service/UI regression PASS. Live production login, real server revocation and external AI calls NOT RUN; no production build configuration, credentials or real data used.
- Account GUI certifies signed-out status and cancellation/settings preservation, not successful server logout.
- Tray: actual native Menu handler and BrowserWindow close/hide/show lifecycle preserve same webContents/settings three times. Physical tray-icon clicking NOT RUN.
- Newsletter: direct Toolbox entry, AI settings callback, pending output guard and draft lifetime verified; synthetic fixture can contain deliberately rejected reference assets. This is not approval of real artwork or live provider output.
- UX: five tool groups,17 development/16 production entry contracts,13 widget IDs/visibility and layout storage preserved. No change to Native Attachment OPTION C.
- Installer packaging/distribution and installed-app GUI NOT RUN. Runtime graph/file-presence checks and unpackaged Electron app build verified.

## Remaining P2 items
1. Dashboard has nested horizontal scrolling at980 and some1280 initial views. D-Day can initially extend outside visible canvas. Additional real DOM/captures demonstrate all current content reachable above Dock. Keep as discoverability/extra-navigation debt; no exact UX11 runtime baseline was run, so do not claim inherited runtime equivalence or zero nested overflow from pageOverflow=0.
2. Existing Main compile/package patterns include newsletter-ai-asset-storage.test.js. No production entrypoint import or exposed IPC was found. Exclude test code in a separately scoped packaging follow-up.
3. safeStorage deprecation and existing greater-than10 lifecycle listener warnings remain; no observed failure in verified runs.

## Protection, evidence and publication policy
-44 original work paths: HEAD/index/MERGE_HEAD/status comparison unchanged. Original Cargo.toml dirty state, update-candidate merge and unrelated WIP preserved. Original RC2 and UX11 remote SHAs reverified.
- No main/existing integration/original RC2/UX branch changes, forced history operations, deployment, production app/data changes or unrelated process termination.
- Only this independent candidate may be committed/pushed after final scoped security/review gates. No PR.
- Evidence root is local E:/BOGUNON_DEV/int-02-home: control/,logs/,admin-qa/,admin-qa-final/,qa-output/. These profiles/logs/screenshots are not added to public Git.
- Key records: control/final-full-summary.json; admin-qa-final/full-results.json; control/admin-ready-source.json; qa-output/widgets-100/attempt-1/report.json; widgets-125/attempt-1; widgets-150/attempt-1; integration-gui/attempt-7; manual/evidence/electron-manual.json; reachability/attempt-2; control/protection-before.json and protection-after.json.
- Source pattern scan found no credential signatures/large unintended files. Dedicated secret scanner unavailable; manual diff and inherited screenshot review supplement patterns; residual scanner limitations remain explicit.
- Existing UX08 screenshots are already tracked in the approved UX11 remote lineage, not newly uploaded INT02 evidence. All other QA material stays outside Git. This source checkpoint is not a dependency-complete cross-PC handoff or operating release approval.

## Verdict
PASS for the independent synthetic INT-02 candidate, with the bounded NOT RUN items and P2 debt above. All mandatory synthetic automatic, fresh GUI, native DPI, reachability, source and security gates completed. This is not production integration or deployment approval.
