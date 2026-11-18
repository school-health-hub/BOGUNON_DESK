# INT-04 — Windows package candidate QA (no release)

## State and baseline
- PLAN ONLY, no packaging or installation performed by this checkpoint.
- Repository: school-health-hub/BOGUNON_DESK.
- Base: integration/int-03-p2-hardening at a64066df2b91c2d4c772e7168d6750179904425e.
- Branch: integration/int-04-windows-package-qa.
- Source evidence: docs/integration/INT-03-P2-REPORT.md.
- INT-03 validation (at that SHA): 233 files, 1,520 PASS, 0 FAIL, 3 existing SKIP; 47 focused PASS; TS 4 configs and Electron build PASS. GUI evidence on same source at 1440x900, 1366x768, 1280x720 and 980x700. This evidence is not installed-package QA.
- Remaining UX debt: weekly schedule 377x110 extreme minimized state compresses text though scroll remains accessible. Track separately, do not reset user geometry.

## Scope & authorization boundary
**First perform a read-only packaging preflight**: inspect builder/package scripts, signing identity, destination, privilege requirements, release settings, file inventory, disk/memory, source SHA, and school IT software-install controls. Do not package/install until conditions and authorization are established. Independently produced unsigned candidate is for isolated QA only. Do not upload, share, deploy or auto-update.

Packaging operation may be approved after preflight if it writes only to a new F: build/release candidate path, does not require installing on managed school systems, and does not alter existing shared deps, product profile, other worktrees, or signing credentials. Any actual installer execution, system installation, admin privilege, machine-wide change, security bypass, production login, real AI API call or release requires a separate explicit user approval.

## QA plan after approved candidate packaging
1. Establish a clean isolated Windows packaging candidate from fixed source SHA; verify main, preload, renderer, app icon, tray icon, AI protocol, workers, licenses and inventory transport. Confirm compiled .test.js not included.
2. Inspect asar + unpacked inventory, package metadata, paths, archive integrity and SHA-256. Do not claim signing if Authenticode absent.
3. On a QA-approved host (and with school IT permissions if school managed), test **unpacked/portable candidate cold launch first** with isolated profile and synthetic data, then installer behavior only under separate approval. Document installed vs unpacked explicitly.
4. Verify session cancellation, logout error/timeout honest states, settings/memo/widget geometry persistence, newsletter input/output approval guard, official-document/Record cancellation, tray show/hide, toolbar/keyboard, 4 content viewports and available native DPI. Physical tray clicks, live server login, external AI calls, and actual installed GUI must be NOT RUN unless done.
5. Use focused tests; rerun affected complete Electron/Newsletter suite when product/source or package contract changes. No new skips to force pass. Record file hashes and negative tests.
6. Keep RC2, UX09-11, INT02/INT03, main, existing integration and other 46 work paths unchanged. No force pushes, cleanup of others, Native Attachment OPTION C or release/deployment.

## Decision record
- Produce docs/integration/INT-04-WINDOWS-PACKAGE-QA-REPORT.md including SOURCE/BUILT/TESTED SHA, before/after dependency state, status per gate, exact file list and checksums, QA evidence paths, package signing state, observed feature results, residual risks and PASS/CONDITIONAL/BLOCKED.
- Scoped audit documentation may be committed to this independent branch. Packaging only after explicit scope/gate approval. No main merge or distribution.
