# Purchase Phase 2A-3 browser QA

Windows GitHub-hosted runner only. Product checkpoint is pinned to `d12d76107e1166f0f6eb146a634a8f9d2eed3e67`; QA controller is independently recorded. No production entry point imports this directory.

The runner overlays this QA directory onto a separate immutable product checkout, installs product and QA locked dependencies separately, then typechecks and lists tests before installing Chromium and running Playwright. Browser tests use real product components, hook, reducer, CSS and Pretendard fonts. Playwright 1.56.1 is pinned; package-lock tarball URLs/integrities were collected from the official npm registry without local installation.

Synthetic controls operate on memory only. `import` means parent append simulation, not file parsing or native IPC. `corrupt-*` intentionally supplies inconsistent state to the real reducer through a QA-only fault adapter. Duplicate IDs intentionally cause a recorded React duplicate-key diagnostic in that one fault test; other console errors fail the tests.

Browser evidence covers rendered UI, values, focus, layout and transactions. Dashboard integration, actual file import/export, native Tauri/WebView2, real IME composition and Windows display DPI are **NOT RUN**. Viewport changes do not emulate Windows DPI.

Isolation: headed Chromium, fresh BrowserContext per test, loopback-only requests/WebSockets, blocked service workers/popups, no auth or application storage, native repository calls rejected. No global Tauri object is fabricated. Test attempts are not retried. Vite binds 127.0.0.1:1420 with strictPort; Playwright owns and stops its server. The runner checks for a leftover listener and fails on leakage.

Evidence: stage stdout/stderr, HTML/JSON/JUnit reports, screenshots, failure traces, console/network diagnostics, versions, source hashes and SHA-256 inventory. Workflow uploads evidence on success/failure for 14 days. Screenshot existence alone never yields PASS; each scenario asserts state/DOM behavior.
