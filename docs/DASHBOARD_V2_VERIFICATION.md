# Dashboard v2 — Phase A/B verification

2026-10-22 (Asia/Seoul). Branch `feature/dashboard-mint-ivory-v2`, baseline/current uncommitted HEAD `7b0e82f91178d535411f5ca0e6d05ea523d65a07`. Worktree `C:/Users/Public/Documents/BOGUNON-dashboard-v2`.

## Implemented

- Dashboard-scoped Mint/Ivory tokens, full-slot surfaces, consistent spacing and preserved appearance IDs. No stored widget coordinate/visibility/order/schema rewrite.
- Canonical dense desktop retains existing information/calendar/work/utility composition. Minimum rendered row56 prevents date contents spilling between rows; lower-height windows scroll the workspace instead of compressing content. Legacy/custom saved coordinates remain authoritative; choose an existing desk preset explicitly to adopt its canonical arrangement.
- Calendar cells no longer scroll. Existing date→Quick Add remains unchanged; +N opens view-only all-title detail, closes by Close/Escape and restores focus after covered grid leaves inert state.
- Weather/Meal connection guidance is consolidated at desktop level. Their existing standalone settings actions remain outside compact context; provider/auth/API state machines are unchanged.
- Existing Dock action registry, active indicator, hover/focus tooltips and click targets remain unchanged. Meal two-column presentation and compact D-Day list use their available slots.

## Tests and observations

- Full final frontend: **183 files, 1,205 tests PASS**, `node node_modules/vitest/vitest.mjs run --no-cache --maxWorkers=2`, exit0, `.omo/evidence/frontend.log` and frontend-result.json.
- First unrestricted run: 1,200 PASS / 2 local 5-second timeouts while spawning182 workers; not hidden as PASS. Bounded concurrency resolved them without changing timeouts/assertions. This does not identify the historical Finance timeout (still UNKNOWN).
- Final targeted independent review: 5 files /35 tests PASS. New Calendar interaction2 and connection presentation1 regressions cover detail contents, inert, focus restoration, existing action and compact/standalone notice behavior.
- `node node_modules/typescript/bin/tsc --noEmit`: PASS. Production frontend Vite build: PASS. Existing >500kB bundle warning remains, not silenced.
- Explicit synthetic widget production build and real Chrome: 1440x900,1366x768,960x600,768x600,480x720,1152x720. Last two scaled desktop cases include960x600@1.5 and1152x720@1.25; these emulate CSS/DPI sizing, not actual Windows DPI.
- All6 cases: no horizontal page overflow, no overflowing calendar cells,3 expanded event titles, Shift+Tab cannot enter covered calendar, Escape restores trigger focus, Quick Add receives2026-10-22, no browser page errors. JSON timestamps and results: `.omo/evidence/browser-results.json`.
- 1440x900 workspace client/scroll900/900. 1366x768 client768/scroll822: intended outer scroll54px; Dock has bottom reserve. At smaller sizes, compact stacked/scroll layout preserves access instead of a fit claim.
- Full titles/categories are synthetic. QA config replaces data hooks and clock only in its explicit build. Preview actions are stubs; guarded Native helpers can exist in its dependency graph, so this is **not an IPC-free-bundle claim**. No Tauri app/installed profile, real data or Native call was used. Production app imports no QA entry/fixture switch.
- Comparison: baseline screenshot uses the same synthetic scene and baseline source for touched geometry/calendar/CSS. `.omo/evidence/dashboard-before-1440.png` vs dashboard-1440.png; disconnected scene dashboard-disconnected-1440.png. Final captures use production bundle. No screenshot from the installed app is claimed.

## Constraints and review

Existing dependencies reused through new worktree node_modules junction; no npm install, dependency/lockfile changes or Rust build. Local installed Vite8.3.0 differs from locked8.3.3, so a future separately authorized locked CI is still required. No Lighthouse100 claim is made; extra audit-tool installs were excluded by user resource limits.

Five independent review lanes (goal, quality, security, context, QA) PASS for UI/design scope. Two independent visual inspections PASS on fresh production evidence. Review found covered calendar keyboard focus; fixed with inert + post-render focus restoration and reverified in tests/browser. Reviews are agent reviews, not human Native execution approval.

Runtime hypotheses examined: (1) short grid rows can overflow day cells — reproduced1366 and eliminated with minimum readable rowheight; all6 post-fix cell checks false. (2) hidden date buttons remain keyboard reachable under details — confirmed by review and fixed; all6 Shift+Tab coveredFocus=false. (3) duplicated connection guidance can obscure sparse layout — disconnected capture has exactly1 common banner and0 per-card settings buttons, standalone action tests still pass.

## Protection and remaining work

No src-tauri, Finance, auth, package/lock, production configuration or native evidence edits. Candidate remains clean at7b0e82f; preserved9B worktree clean atc67f5bf. Original repo retains its ` M src-tauri/Cargo.toml` marker and empty content diff. Remote candidate7b0e82f and Finance dc6772c unchanged. No commit/push/PR/CI/installation or Explorer operation.

Native integration contract: `docs/DESKTOP_SURFACE_V2_INTEGRATION.md`. Current candidate lacks the later Main ACL/caller/lifetime boundary; operational second WebView and attachment remain blocked until separately ported/reviewed. Effective UDF/partial create/WebView2 cleanup remain unresolved, not proven by historical Native A+B.

Phase A browser UI: PASS within this scope. Phase B source-backed design: complete with activation blockers. Phase C/actual Windows WebView2/DPI/Explorer attachment: NOT VERIFIED and not authorized. Arbitrary user-custom resized layouts have unit-level preservation evidence and responsive fallback, not exhaustive live visual coverage.
