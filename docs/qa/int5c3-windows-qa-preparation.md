# INT-5C-3 Windows QA preparation (NOT RUN)

Product: 32d40c1769b587f917416f17bc588d7e62d7084f.
Workflow: .github/workflows/int5c3-module-ui-windows-qa.yml.
Controller branch: codex/int5c3-windows-qa. Local only; not dispatched or registered.

The reviewed INT-5B frontend template is reused in a NEW file. Existing workflow definitions are unchanged. Checkout is immutable, verifies exact HEAD, has contents:read, pinned action SHAs, Windows2022/Node22.23.3/npm10, no operational secrets, no deployment. Stages: npm ci -> local tsc -> five actual focused test files -> full Vitest worker1/no file parallelism -> production build. Failure stops subsequent gates; no retries. Evidence summary/hashes uploaded even on failure. Artifacts include logs/results/build manifest, not node_modules or operational data. This workflow is frontend-only; visualQa explicitly remains NOT RUN.

Registration gate: new filename is not currently registered (API404). Existing INT5B CI/visual workflows pin different product SHAs and refs. Do not modify or dispatch them as if they tested this product. Main registration is outside INT5C3 authorization. No main commit/push/registration/dispatch occurs here. Do not publish this controller branch without next-stage authorization; current approval explicitly covers product branch push.

## Visual controller requirements for next approved stage
Reuse E:/BOGUNON_DEV/build-workspaces/BOGUNON_DESK-int5b-visual-ci/scripts/qa/int5b-visual and its locked browser tools only after inspecting their pinned source assumptions. Old Dashboard captures alone cannot validate these module defects. Existing user data and authorization are forbidden. If native-backed synthetic states need a harness, keep it in the QA controller; do not modify product source or bypass production authentication.

At 980x700,1280x720,1366x768,1440x900:
- Finance both area/phase2 tab groups: selected rest, selected hover, selected keyboard focus-visible, unselected hover. Capture computed foreground/background plus alpha-composited contrast (4.5:1), focused element/outline, selected state and selector provenance. Keep inactive/disabled distinction; test native-unavailable banner separately from populated fixture.
- Purchase settlement: every actual status option selected via DOM select/native event; verify selected value, rendered label text area including arrow/padding, first and other column rectangles, table scrollWidth/clientWidth, page scrollWidth/clientWidth. Internal horizontal table scrolling is intentional; page overflow is a failure. Record before/after scroll reachability and state change without real save/import/export.
- Official helper: actual unchanged sentence, Range client rectangles per word to detect orphan ending, text access at narrow width/long token. No overflow hidden workaround. Screenshot and matching DOM coordinates captured at same scroll state/time.
- Dashboard clock/Dock and Finder confirmation: reuse unchanged-source evidence plus targeted smoke if harness route changes. Preserve Finder keyboard contract; modal lifecycle changes to Official/Purchase remain excluded.
- Record actual Korean font load, console/page errors, viewport,DPR (separate from native WindowsDPI), source/controller/workflow SHAs, screenshot SHA256. Loopback127.0.0.1 only; owned browser/server cleanup receipt.

No visual PASS from a build or historical screenshots. Fresh screenshot and DOM agreement, actual contrast and focused/native select state coverage are required. Remote artifacts should be downloaded to a NEW E: subdirectory and ZIP digest + per-file hashes verified. Native IPC/data encryption/Windows125%150%DPI remain separate.

## INT-5C-4 execution update
The same never-registered workflow file now adds a dispatch-SHA controller checkout, locked browser tools, isolated Chromium and real product DOM captures after the sequential frontend gates. No product source changes. scripts/qa/int5c4 uses only actual production dist UI actions: Finance area tabs without Native snapshot; Purchase one manually-entered synthetic item and native select value changes; Official helper text. Native Finance Phase2 is NOT RUN if no product snapshot is available. No storage mock/injected Tauri bridge or fake module DOM.
Expected captures without Native Phase2: 40 (10 states x4 viewports); additional Phase2 states only if product renders them naturally. Screenshot/DOM/provenance and hash pairing must be manually reviewed; visual-summary never auto-declares design PASS. No local installs/build/browser. Remote dispatch at most1, no retry. Native storage, actual Windows DPI and excluded modal lifecycle remain unverified. Existing Dashboard/Finder evidence reused; Dashboard smoke included, Finder new capture excluded as unchanged.
