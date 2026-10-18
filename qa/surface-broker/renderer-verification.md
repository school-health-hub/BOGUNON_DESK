# 9B-3L-C Independent Surface Renderer

## Baseline and scope

Worktree: `C:/Users/Public/Documents/BOGUNON-9b2a`; branch `codex/desktop-surface-core-9b2a`; starting HEAD `86282a62bfd7c2580b150629ce42c560cfaa94fb`; starting tree clean.

Only a disconnected static renderer, build isolation guard and tests are added. No Tauri Surface window, IPC registration, production projection source, Main provider change, Native QA run, Explorer access or operational data access occurs. Build output and QA logs are disposable local artifacts; existing approvals, claims and Evidence are preserved.

## Entrypoints and build boundary

- Main retains `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts` and the existing `build` script.
- Surface uses `surface.html`, `src/surface/main.tsx`, `SurfaceRoot.tsx` and `surface.css` only.
- `npm run build:surface` runs TypeScript and the separate `vite.surface.config.mjs`. Its output is ignored `dist-surface/`; Main output remains `dist/`.
- `publicDir: false` prevents Main public assets being copied. Relative `./assets/surface-*` references are exclusive to the Surface output. No shared Main chunks are produced.
- The installed and lockfile Vite version is **8.3.0**. Vite's public HTML input/build plugin contract is used: https://vite.dev/guide/build.html#multi-page-app and https://vite.dev/guide/api-plugin.html . No package or lockfile version is changed.
- Build-time `surfaceIsolation` checks source import edges before TypeScript erasure, loaded module graph and emitted chunk module lists. Unknown app modules, packages, external imports and virtual modules fail the build. This is an explicit dependency boundary, not a sandbox against modified allowed dependencies or obfuscated future browser API use.
- `.vite/surface-isolation.json` records sanitized relative module IDs, import edges, emitted chunks and JS hashes; no source contents or absolute user paths.

The actual graph contains four Surface app/HTML/CSS modules and ten React/react-dom/scheduler modules. The emitted chunk additionally contains the exact Rolldown runtime helper. There are no dynamic imports or Main/Auth/business/Channel/Tauri modules. The JS hash is `c9e9cd4632de4f48b3fcf253b9b4f3c41365e46f08aa1723e40096ccefc96d3e`.

## Static UI and security policy

The UI displays Surface 준비 중, 연결되지 않음, Unavailable and the absence of actual business data. OpenMain and RefreshProjection are native disabled buttons with no handlers. There are no providers, services, subscriptions, payload inputs, storage APIs, credentials, navigation targets or IPC calls.

The HTML meta CSP denies connections, frames, workers, objects, forms and external content. Scripts/styles are same-origin external files; no unsafe-inline grants. It is intentionally stricter than the future StorageContract's IPC allowance because IPC is absent here. `frame-ancestors` must be enforced by a future protocol response/header and is not falsely claimed via meta.

The existing Rust StorageContract remains inactive and unchanged: a future custom `bogunon-surface` origin and separate effective WebView2 UDF require an adapter and Windows verification. This build does not assign an origin/UDF, enable Surface creation, relocate Main storage or prove browser storage isolation. Serving this HTML under Main's origin would not isolate storage and is not an approved deployment.

## Verification evidence

External evidence directory: `C:/Users/Public/Documents/BOGUNON-surface-renderer-output`.

- Failing-first renderer test captured missing Surface component; after implementation the same behavior test passes.
- Initial real-build negative fixtures revealed that Vite erases unused TypeScript imports before loaded graph inspection. The pre-transform AST import check fixes this; the same Main/Auth/Tauri unused-import cases now fail closed. External URL import is also rejected. Five actual-build fixture tests pass.
- Source AST checks reject storage, IPC and navigation API references in both application modules; HTML CSP and dedicated entry checks pass.
- The UI test renders the actual component under throwing localStorage/sessionStorage/IndexedDB/cookie/Tauri access traps and clicks disabled actions; forbidden accesses zero. This unit test alone does not execute `main.tsx`.
- Separately, a temporary headless Chromium context executes the **actual built HTML/JS/CSS**, including `main.tsx` mount. At widths 320, 375, 768 and 1280 there is no horizontal overflow; both actions remain disabled; runtime storage/Tauri/fetch traps record zero accesses; no page errors. Network requests are exactly Surface HTML, JS and CSS. Screenshots and `preview.log` are retained externally. The unavailable in-app browser failed before any page creation; bundled existing Playwright performed this static frontend preview instead. No Tauri or operational Windows app was started.
- Main builds captured before and after the change contain **13/13 byte-identical files**, including HTML and JS/CSS/font assets (`main-comparison.json`). Existing Main chunk-size warning remains unchanged.
- Rust Library: **433 passed**, zero failed, one filtered real Windows shell probe. The filtered probe would violate the no-Explorer-observation scope; Broker/Producer and Main security regressions remain included.
- Cargo offline/locked all-target check passes; existing unused-code warnings remain unrelated.
- TypeScript and Surface Vite build pass.
- Protected artifacts: **15/15** SHA-256 match. Legacy Runner/Gate/Evidence sources: **40/40** match. Source diff for `src-tauri`, Main App/entry/HTML/config and package-lock is empty.
- Independent read-only goal, quality, security and context reviews pass; dedicated independent QA runs the renderer/source/real-build tests. The quality and context lanes also inspect responsive screenshots.

Independent focused QA: **3 files / 9 tests passed**, no edits or Native execution. Final full Frontend: **166 files / 997 tests passed**, exit 0 (`frontend-final.log`), with generated Main ACL verification enabled.

## Runtime audit hypotheses

1. Main imports might leak through shared entry/chunks: actual closed module graph contains only approved Surface/React modules; forbidden unused-import builds reject, and Main outputs are byte-identical.
2. Mount/render might touch browser state or IPC despite a static-looking component: actual compiled entry executes under throwing browser traps with zero accesses, only three same-origin asset requests, and no page errors.
3. A narrow viewport might expose overflow or active controls: four actual Chromium viewport observations show no overflow and two disabled actions; 320/375/1280 screenshots were inspected.

## Remaining verification limits

Actual Tauri Surface creation, WebView2 storage/UDF/origin isolation, custom protocol CSP headers, Main/WebView2 noninterference and native Surface cleanup are **NOT VERIFIED**. No Windows Native lifecycle, OS message retrieval/dispatch, Explorer backend, producer wiring, IPC, retry or replacement is implemented or approved. Existing Native A+B Proof is not reused as a Surface/WebView cleanup receipt.

Protection manifests: `C:/Users/Public/Documents/BOGUNON-9b3jc-output/protected-before.sha256` (15) and `C:/Users/Public/Documents/BOGUNON-9b3jd-2200063/existing-runner-before.sha256` (40). Both were also checked independently by the context reviewer.

All added source files remain below 100 lines, with one responsibility each. No untrusted runtime input or new union variants are introduced, and no type suppression or logging is added. Scoped rustfmt is not applicable because no Rust file changes. JavaScript config/plugin syntax and diff whitespace checks pass.

## Changed files

`surface.html`; `vite.surface.config.mjs`; `src/surface/main.tsx`; `src/surface/SurfaceRoot.tsx`; `src/surface/surface.css`; `src/surface/SurfaceRoot.test.tsx`; `src/surface/DESIGN.md`; `scripts/surface-isolation.mjs`; `scripts/surface-isolation.test.mjs`; `scripts/surface-renderer.test.mjs`; `package.json` (one new build script); `.gitignore` (Surface output); this verification record.

The first full frontend run started before the graph checker was fixed and loaded that old checker: 991 passed / 3 failed, all three being the forbidden unused-import fixtures. The corrected checker passes all three in the focused and independent runs. A final full run is performed against the fixed files before checkpointing; no failing test is removed or weakened.

## Final outcome

**RENDERER_READY**. Source implementation, actual bundle graph, static browser observations, existing regressions, five independent review lanes and scoped diff audit completed. All requested source-stage checks pass. No Tauri Surface/Native/Explorer/operational app execution took place; Windows storage and WebView2 claims remain NOT VERIFIED. Only the 13 listed files are included in the local checkpoint; no push or PR.
