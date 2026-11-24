# SWL-01 Smart Work Launcher — CONDITIONAL / QA PENDING handoff

Date: 2026-11-24 (Asia/Seoul)
Verdict: **CONDITIONAL / QA PENDING**

Checkpoint note: this handoff authorizes only a preservation checkpoint with the message `wip(electron): preserve SWL-01 (QA pending)`. It is **not** feature approval, a merge to `main`, a pull request approval, a release, or a deployment. Exact `980x700`, exact `900x680`, and synthetic native launch-cancel QA remain pending.

## Frozen scope and Git state

- Worktree: `F:\BOGUNON_QA\SWL01_SMART_WORK_LAUNCHER`
- Branch: `codex/swl-01-smart-work-launcher`
- Frozen start/source SHA: `162dd2873efa8ac2a42d71d09add130dee0f3d83`
- Pre-checkpoint `HEAD`: `162dd2873efa8ac2a42d71d09add130dee0f3d83` (the frozen base)
- Checkpoint target: `origin/codex/swl-01-smart-work-launcher`; record and verify the exact resulting SHA, upstream, and `0/0` divergence after the normal push.
- The frozen base is present on `origin/codex/rc2-logout-integration`. The conditional checkpoint is created from that base without modifying the RC2 branch/worktree or any other worktree; no reset, checkout, rebase, merge, stash, or clean is part of this handoff.
- Pre-checkpoint working tree: 7 tracked files modified plus 9 new product/test files and this handoff document.

This preservation checkpoint is conditional because exact `980x700`, exact `900x680`, and synthetic native launch-cancel checks are **NOT RUN**. A clean automated result and a successful nominal 1440-window walkthrough do not override those missing gates or constitute feature approval.

## Actual implementation

The local diff adds a 20-action smart-work catalog, search and six categories; detail and verification labels; favorites with ordering; recent-work opt-in, clear, and persistence; a manual menu guide for verified actions; and launch routing through the existing school administration bridge.

Changed tracked integration files:

- `electron-p0/admin-protocol.ts`
- `electron-p0/main/admin-ipc.ts`
- `electron-p0/main/main.mts`
- `electron-p0/preload/preload.cts`
- `electron-p0/renderer/school-admin/SchoolAdmin.tsx`
- `electron-p0/tests/admin-preload.test.ts`
- `electron-p0/tests/school-profile-ui.test.tsx`

New local files:

- `electron-p0/smart-work-launcher.ts`
- `electron-p0/smart-launcher-preferences.ts`
- `electron-p0/main/smart-launcher-store.ts`
- `electron-p0/renderer/school-admin/SmartWorkLauncher.tsx`
- `electron-p0/renderer/school-admin/smart-work-launcher.css`
- `electron-p0/tests/smart-work-launcher-domain.test.ts`
- `electron-p0/tests/smart-launcher-store.test.ts`
- `electron-p0/tests/smart-launcher-ipc.test.ts`
- `electron-p0/tests/smart-work-launcher-ui.test.tsx`

No path whose name is Dashboard, Dock, or Workspace appears in the changed-file inventory. No Dashboard/Dock/Workspace source was changed. The RC2 branch/worktree, design worktrees, and all other listed worktrees remain outside this diff and were not modified by this audit.

## Catalog verification truth

The catalog contains exactly 20 actions. Only `purchase-request` / `물품 구매 품의` is marked `FIELD_VERIFIED`; its guide is `학교회계 › 사업관리 › 사업담당 › 품의/정산 › 품의등록`. The other 19 actions are explicitly `UNVERIFIED`. Observed document-menu labels are searchable metadata, not field verification and not an assertion that a real system transaction was completed.

No real 업무포털, 나이스, K-에듀파인, or eVPN system was logged into or exercised. No real submission, purchase, approval, student-health lookup, training lookup, or operational network request was performed.

## Security and state boundaries

- Launch behavior reuses the existing `AdminBridge`/Admin IPC boundary rather than introducing a renderer-side shell or arbitrary URL launch path.
- Official addresses remain HTTPS allowlisted and canonicalized; ports, credentials, query strings, fragments, control characters, backslashes, and encoded separators are rejected at the execution boundary.
- Existing main-process confirmation/cancellation and freshness checks are retained. A launch is recorded only after a `launched` result; canceled, blocked, and unconfigured results do not become recent activity.
- Smart-launcher preferences are a separate document under `work-data/smart-launcher`; they do not modify school identity, drafts, templates, address configuration, Dashboard, Dock, or Workspace state.
- Recent history defaults **OFF**. Disabled history is not recorded. Preferences use bounded strict validation, optimistic revision checks, serialized writes, primary/backup files, symlink/hardlink safety checks, and read-only recovery when the primary is invalid and backup is used.

## Verification results

| Gate | Result | Evidence/qualification |
|---|---|---|
| Focused tests | **PASS** | 10 files, 67 tests; `logs/01-focused-tests.log` |
| Electron main TypeScript | **PASS** | `logs/03-tsc-main.log` |
| Electron renderer TypeScript | **PASS** | `logs/04-tsc-renderer.log` |
| Electron tests TypeScript | **PASS** | `logs/05-tsc-tests.log` |
| Electron P0 build | **PASS** | `logs/07-electron-p0-build.log` |
| Diff/whitespace checks | **PASS** | tracked `git diff --check` plus untracked whitespace scan |
| Root `npx tsc --noEmit` | **FAIL (unrelated baseline areas)** | newsletter/type-configuration failures are recorded in `logs/02-tsc-root.log`; no SWL error was observed, but root TypeScript is not a PASS |
| Nominal Windows Electron walkthrough | **PASS at nominal 1440x900 only** | actual isolated Windows app; captured client area was 1426x893 |
| Search/favorite/recent controls | **PASS in nominal walkthrough** | `예산` filtered to `예산 현황 확인`; add/remove notice and list mutation observed; recent default OFF, enable, disable, and empty clear observed |
| Persistence | **PASS in isolated profile** | `물품 구매 품의` favorite and recent-history ON remained after relaunch; `screenshots/02-relaunch-persistence.png` |
| Menu guide/no launch | **PASS for sole field-verified purchase action** | guide expanded to the five-part path; no browser/process was opened |
| Favorite ordering (2+) | **PASS automated / NOT RUN GUI** | focused tests only |
| Corrupt primary/backup recovery | **PASS automated / NOT RUN GUI** | focused tests only |
| Exact 980x700 | **NOT RUN** | unified CUA had no exact resize API; later harnesses failed before obtaining a usable renderer/page |
| Exact 900x680 | **NOT RUN** | same limitation/failure; no screenshot or layout/focus metric may be claimed |
| Native launch cancel | **NOT RUN** | no operational address was configured and no external browser/site was opened |
| Real systems | **NOT RUN** | intentionally outside this QA |

The final exact-size attempt used one authorized repository Playwright `_electron.launch`, a fresh strict-child QA root, and a 120-second timeout. `electron.launch` never returned and remained pending until the supervising command was interrupted. Per the stop rule, there was no retry. Earlier CDP attempts also failed before exact-size page validation (including a built renderer target unavailable failure). Therefore navigation, both exact sizes, screenshots, overlap/clipping/overflow metrics, Tab focus, menu-guide metrics, and page/console error capture at those sizes are all **NOT RUN**, not FAIL/PASS by inference.

Runtime diagnostics recorded no fatal application error, but did record safeStorage deprecation and MaxListenersExceeded warnings.

## Windows flow observed at nominal 1440x900

Using an isolated synthetic QA profile, the actual Electron window was opened, then `업무 도구` → `학교 행정 업무 도우미` → Smart Work Launcher. Search, category/card selection, favorite add/remove, recent-work default OFF/on/off and clear, and the verified purchase guide were exercised. Relaunching the same isolated profile demonstrated favorite and recent preference persistence. The menu-guide action remained guidance-only and did not open an external browser or process.

This proves the nominal walkthrough only. It does not substitute for the required exact-size or native-cancel gates.

## External evidence and cleanup

Evidence root: `F:\BOGUNON_QA\SWL01_WINDOWS_QA_20261124`

- Final transfer-eligible evidence inventory: **44 files, 365,590 bytes**, excluding `profile/**`, `SHA256SUMS.txt` itself, and transient lock/temp files.
- Final `SHA256SUMS.txt`: **44 entries**, independently re-read and verified with **0 missing and 0 hash mismatches**. Manifest SHA-256: `d67249e3ee5466e7abd194e6668926b3dbdda0238f906fa8f91486d5e4ddb8a6`.
- QA browser/profile state accounts for **572 files and 210,589,500 bytes** and is explicitly excluded from the manifest and transfer/publication package. See `PROFILE-EXCLUDED.md`; the subtree is synthetic QA state, local-only, non-transfer, and non-public.
- Final targeted cleanup found no node/electron command line referencing the final evidence runner or exact worktree app target. Earlier exact QA PID trees and their loopback listener were targeted and removed; the installed BOGUNON process was not targeted. Isolated QA roots remain for provenance.
- No operational/default AdminStore or user profile was intentionally used.

### Security/scope scan

No dedicated secret scanner was installed (`gitleaks`, `trufflehog`, and `detect-secrets` were unavailable). Best-effort inspection covered all **44 included filenames**, **42 included text/log/JSON/Markdown/source files**, and **2 PNG files** (filename plus raw ASCII/metadata-keyword inspection; `exiftool` was unavailable). It found zero private-key blocks, bearer credentials, API-key/secret assignments, OpenAI-style keys, GitHub-style tokens, JWTs, cookie assignments, Korean resident-registration patterns, Korean mobile-number patterns, email addresses, or `C:\Users\...` paths. No generated evidence copy required redaction.

All 13 IPv4-like text matches were loopback addresses; no non-loopback IP was found. URL review found no embedded user information or query string. Generic school/user/address vocabulary and machine-local `F:\...` provenance paths are contextual, not identified personal/student/patient records, but should still be reviewed before any public release.

Residual risk remains: the excluded `profile/` trees contain Chromium/Electron state files, including Preferences, Local State, Network Persistent State, Trust Tokens, and 130 database/LevelDB-like files identified by name/path. Those binary databases, journals, and caches were not exhaustively decoded or content-scanned. The exclusion boundary is mandatory: do not transfer, publish, upload, or commit `profile/**`. The profile-excluded evidence package remains local-only; no approved secure transfer destination or receiving-PC restore test is recorded.

## Resume and recovery

The conditional preservation checkpoint may be committed and pushed only to `codex/swl-01-smart-work-launcher`. Do not merge, release, or deploy it. To continue QA on the same Windows machine, from the exact worktree:

```powershell
Set-Location 'F:\BOGUNON_QA\SWL01_SMART_WORK_LAUNCHER'
npm run electron:p0:build
node 'F:\BOGUNON_QA\SWL01_WINDOWS_QA_20261124\logs\16-exact-size-playwright.mjs'
```

The existing runner is diagnostic evidence and previously hung at `_electron.launch`; before reuse, inspect/fix the harness launch contract rather than treating the same command as expected to pass. Use a fresh strict-child QA root, one launch, the repository Playwright Electron pattern, and the established stop rule. Capture and verify outer sizes exactly at `980x700` and `900x680`, launcher/card/detail/control visibility, overlap/clipping/horizontal overflow, keyboard focus, purchase guide/no-launch behavior, and page/console errors. Preserve new logs, screenshots, metrics, cleanup receipt, and a complete updated SHA-256 manifest.

Then configure only a synthetic allowlisted official-format address and exercise the native confirmation **Cancel** path. Verify no external browser/site/process is opened and no recent item is recorded. Do not access a real system or use real credentials.

After all three missing gates pass, rerun the focused 67-test command, the three Electron TypeScript commands, build, `git diff --check`, and the untracked whitespace scan. Re-audit the exact diff and a profile-excluded evidence package with a real secret scanner if available. Only then request feature approval and any separate merge/release action; the conditional checkpoint itself does not grant either.

## DoneClaim

**CONDITIONAL / QA PENDING.** Implementation, focused automation, build, nominal 1440-window interaction, isolated persistence, and the sole field-verified purchase guide are evidenced. Exact `980x700`, exact `900x680`, synthetic native launch cancel, real systems, secure evidence transfer, and receiving-PC restore are not complete. The approved action is limited to preserving this state in the named feature branch. This checkpoint is not feature approval, a `main` merge, a release, or a deployment.
