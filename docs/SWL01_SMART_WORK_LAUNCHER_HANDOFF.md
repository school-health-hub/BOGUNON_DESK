# SWL-01 Smart Work Launcher — FINAL WINDOWS QA PASS handoff

Date: 2026-11-24 (Asia/Seoul)
Verdict: **PASS**

Closure note: the three remaining Windows gates were completed on 2026-11-24 using a strict-child synthetic QA profile. This PASS closes SWL-01 feature QA only; it is **not** a merge to `main`, a beta.10 integration, a pull request approval, a release, or a deployment.

## Frozen scope and Git state

- Worktree: `F:\BOGUNON_QA\SWL01_SMART_WORK_LAUNCHER`
- Branch: `codex/swl-01-smart-work-launcher`
- Frozen start/source SHA: `162dd2873efa8ac2a42d71d09add130dee0f3d83`
- Pre-checkpoint `HEAD`: `162dd2873efa8ac2a42d71d09add130dee0f3d83` (the frozen base)
- Checkpoint target: `origin/codex/swl-01-smart-work-launcher`; record and verify the exact resulting SHA, upstream, and `0/0` divergence after the normal push.
- The frozen base is present on `origin/codex/rc2-logout-integration`. The conditional checkpoint is created from that base without modifying the RC2 branch/worktree or any other worktree; no reset, checkout, rebase, merge, stash, or clean is part of this handoff.
- Pre-checkpoint working tree: 7 tracked files modified plus 9 new product/test files and this handoff document.

The preserved implementation checkpoint is `356bb5358e89811b6ad166ced9b7843024a4b501`. Final Windows QA evidence is stored outside the repository under `F:\BOGUNON_QA\SWL01_FINAL_WINDOWS_QA_20261124`; Chromium profile state remains excluded from Git and evidence publication.

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
| Exact 980x700 | **PASS** | actual Windows outer bounds `980x700`; 20 actions, search, 3-item purchase filter, favorite mutation, verified guide, keyboard focus, and zero horizontal overflow confirmed; `screenshots/980x700-smart-launcher.png` |
| Exact 900x680 | **PASS** | actual Windows outer bounds `900x680`; the same launcher flow remained reachable with scrolling and no horizontal clipping; `screenshots/900x680-smart-launcher.png` |
| Native launch cancel | **PASS** | synthetic `https://synthetic.eduptl.kr/` only; native confirmation captured and physically canceled; result `status: canceled`, enabled recent history remained empty, no browser root or synthetic-URL process opened |
| Real systems | **NOT RUN** | intentionally outside this QA |

The earlier windowless run had two harness causes rather than a product rendering failure: the long QA path exceeded Chromium's GPU cache path limit, and direct shell launches let Electron inherit a closed stdout pipe, producing `EPIPE`. A short strict-child QA root plus `Start-Process` with persistent log-file handles produced a complete renderer. The first window remained hidden because `ready-to-show` was not observed; the product's existing second-instance recovery path displayed that same BrowserWindow. Once displayed, the renderer was `readyState=complete` and all remaining gates were exercised in the actual Windows Electron window.

Evidence interpretation: the 980 result sampled the favorite aria-label before React's asynchronous refresh, while the filled-star screenshot and the 900 run's initial `즐겨찾기 제거` state prove the add; the 900 run then proves removal. The native-cancel test enabled recent history through the QA bridge, so the still-mounted UI retained its prior `기록 꺼짐` label, while the authoritative store result was `recentEnabled: true` and `recent: []` after cancellation.

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

SWL-01 is ready for a separately approved beta.10 integration review. That review must consume this branch normally and must not imply main merge, release, or deployment approval. Real school systems, credentials, login, submission, and operational network access remain outside this PASS.

## DoneClaim

**PASS.** Implementation, 67 focused tests, build, nominal 1440 walkthrough, exact `980x700`, exact `900x680`, isolated persistence, favorite/search/filter/menu-guide behavior, and synthetic native confirmation cancellation are evidenced. Real systems, credentials, operational login, main integration, beta.10 integration, release, and deployment remain outside scope.
