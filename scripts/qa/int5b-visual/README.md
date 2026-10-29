# INT-5B remote visual QA controller

Preparation only. Product `3d2694cc5755cb758e97a7d861b6ae847224f6e7` is immutable. Existing CI run `40908748291` (215 files / 1556 tests, TypeScript and build) is reused as validation evidence, not rerun. No local install, build, server or browser is permitted for this task.

## Two checkouts

The new manual workflow checks out the fixed product into `source/` and the dispatch commit into `controller/`. Only `source` is built. Controller changes relative to the product are restricted to this directory and the one new visual workflow. Both checkouts disable persistent credentials. No main/product/integration merge is required for execution.

Dedicated controller branch: `codex/int5b-visual-windows-qa`. Trigger: workflow_dispatch only, exact repository/ref, attempt 1, standard `windows-2022`, contents read. Action references and isolated tool lockfile are pinned. Node 22.23.3/npm 10.x match the preceding CI. Only the remote runner installs product dependencies, builds, installs tools and downloads Playwright's matching Chromium. No Vitest rerun, Cargo, native build, secrets, deployment or external app server.

## Registration gate (NOT authorized in this preparation)

GitHub requires the workflow file on the default branch before initial workflow_dispatch. This new workflow is not registered or dispatched in the preparation stage. Local branch preservation is not remote registration. Any later branch publication and default-branch registration must be explicit, reviewed operations; recheck main, branch heads, exact YAML bytes and protection before doing so. Only the new YAML belongs in a separately authorized main registration commit, not this branch's product history or QA scripts. Controller scripts are loaded from the dedicated dispatch branch. A future dispatch must target that branch exactly and run once, not main. Do not substitute an existing deployment/Finance/native workflow.

## Fixture and expected matrix

INT-5A fixture reused by procedure, not a fabricated screenshot or product mock: new unauthenticated browser context, ko-KR, Asia/Seoul, fixed `2026-10-29 09:30`, default widget placement, empty signed-out workspace, only `합성 QA 메모` typed through the real textbox and cleared. Onboarding uses the real next/later/start controls. No localStorage injection, IPC/auth bypass or actual school/financial data. Runtime internet requests from the browser are blocked; only the exact random-port `127.0.0.1` origin is allowed. HTTP server exposes only dist; no source/config files. One browser/context and serial viewport loop.

24 actual PNGs: 1440×900, 1366×768, 1280×720, 980×700 × Dashboard top, Dashboard bottom, keyboard focus, settings, toolbox, official-document entry. Each PNG gets viewport, fixed product SHA, browser version, DPR=1 and SHA-256 in captures.json. Each corresponding DOM record contains layout, clock, per-character Korean line rectangles, scrolling, button hit tests, computed palette, focus and fonts. Scroll each launcher control into view to record reachability without activating external apps. DPR is browser emulation; Windows 125%/150% DPI is NOT RUN.

INT-5A captured Microsoft Edge; this controller uses pinned Playwright Chromium. Fixture procedure and viewport match, but browser rasterization is not identical. Record browser version and do not treat raw pixel differences as product regressions without reconciliation.

## Contrast and validity

Normal captures show the real unmodified UI. Separate `*.background-measurement.png` files temporarily suppress text paint only and are explicitly measurement images, not valid normal UI screenshots. Original CSS geometry is retained and the temporary style is removed in finally. Compute foreground from actual computed text RGBA over real composited background pixels (including gradients), sampled on a 2px grid. Group opacity is not approximated as simple text alpha: any non-unit ancestor opacity requires manual compositing review. AA thresholds: ordinary 4.5:1, large 3:1. Unsupported colors/filter/blending and disabled text get REQUIRES_REVIEW/exempt, never PASS. Sampling can include clipped or overlapping paint and misses subpixel extremes; review low-ratio candidates against matching actual image and DOM. It is not complete WCAG certification. Nontext borders/icons/focus need manual adjacent-background 3:1 review, disabled/selected non-color cues, and keyboard continuity review; these remain explicitly REQUIRES_REVIEW. Korean actual fonts are recorded through CDP platform-font inspection, not inferred from font-family or fonts.check alone. Official-dialog captures include its surface, dialog controls/text and representative fonts, rather than relying on background Dashboard metrics.

Capture completeness does not equal design PASS. Reconcile images and DOM first, then independent design-system and CJK/visual reviews against INT-5A/INT-4A evidence. No actual render means NOT RUN. Failed capture stages are not retried; partial artifacts and failure reason remain. No product auto-fix.

## Artifact and cleanup

Runner-temp evidence only: PNGs, DOM/contrast/font JSON, stage logs/exit/timing/lock invariants, build file hashes, capture manifest, provenance, console errors, cleanup receipt and SHA256SUMS. No node_modules, browser binaries, auth profiles, whole source, or dist in artifact. Retention 7 days. All caches/temp/browser downloads belong to a fresh run/attempt directory. Server binds loopback only and browser/context/server close in finally. Job timeout/cancellation can interrupt receipts; runner disposal is the outer boundary and an absent receipt must be reported as unverified cleanup, not success. No process-name kill or other job cleanup.

## Static vs execution validation

Preparation validates actionlint/YAML, JavaScript syntax, PowerShell AST, lock metadata/integrity, policy constraints and source selectors. Local syntax checks must not import/run capture modules. Actual npm ci/build/browser/capture/DOM/contrast remain NOT RUN until remote registration and a later authorized run. Static review cannot prove capture reliability.
