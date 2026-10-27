# S-2H-15 — MainLifetime origin observation

## Scope and current conclusion

Baseline: `11ae4451818ee2db3b8f848512bdea1ed4364d19`.
S-2H-14 reproduced `lifetime_origin_mismatch` after Caller installation;
Host launch and MainEvents installation were not reached. The old diagnostic
does not identify the current URL or the executing binary's source.

Three hypotheses were checked independently:

1. Missing `custom-protocol`: the QA Cargo feature enables it, and the S-2H-13
   Windows regression asserted `!tauri::is_dev()`. This proves the compiled
   mode, not the WebView's current URL.
2. Expected-origin/config disagreement: the QA overlay removes `devUrl`,
   keeps the Main app URL and does not enable `useHttpsScheme`. No additional
   deterministic configuration defect was established.
3. Initial navigation timing: pinned Tauri 2.11.5 builds configured windows
   before the setup callback (`src/app.rs`, setup function). Wry 0.55.1 starts
   `Navigate` during creation, without establishing completion before setup.
   Its URL method reads WebView2 `Source`; Tauri then parses that string.
   A transient initial reading is possible, but has not been observed here.

The actual runtime cause remains UNKNOWN. This checkpoint adds observation
only; it does not defer installation or widen origin admission.

## Diagnostic contract

`mainOriginState` is captured from the same URL read and exact-origin decision
used by lifetime installation, before resource registration or Host launch:

| State | Observation |
|---|---|
| `main_webview_missing` | Configured Main resource not found |
| `url_unavailable` | URL read failed for a non-parser reason |
| `url_parse_failed` | Tauri returned its typed `InvalidUrl` error |
| `initial_navigation_pending` | Exact `about:blank` bootstrap marker, rejected |
| `expected_origin` | Existing exact-origin policy returned true |
| `unexpected_origin` | Any other available URL rejected by that policy |

`initial_navigation_pending` is a classification of the bootstrap marker,
not proof of a future navigation or permission to proceed. Blank URLs with
query/fragment additions are not assigned this marker. The first observation
is sticky. Before a URL is observed, the field is null.

`embeddedAppMode` records `!tauri::is_dev()` in the actual binary;
`sourceSha` records the build-validated QA source SHA. The record accepts no
URL, host, query, path, PID, SID, error string or free-text observation.
Diagnostic write failure blocks QA installation instead of allowing Host
startup without evidence. The extra observer is compiled only for Windows
`desktop-surface-qa`; production admission behavior is unchanged.

## Preserved security boundaries

- Exact origin, user-info, host, port and scheme rules are unchanged.
- Caller → Lifetime → Events order and Host-after-install remain unchanged.
- Missing, transient, malformed or foreign URLs still fail closed.
- Duplicate installation and navigation retirement remain unchanged.
- No Native execution, authentication, finance data, UDF or WorkerW access.
- No workflow, dependency, lockfile, production or QA configuration changes.

## Verification and next step

- Added integration-seam contract failed before implementation; 16 focused
  Node contracts pass after implementation.
- An ignored local harness, using production-lock URL/Serde versions, runs
  18 actual classifier, matcher and lifetime-state tests without Tauri or
  WebView2 execution. Its first offline dependency resolution failed without
  the production lock; the isolated harness then reused that lock. No tracked
  lockfile changed. This does not replace Windows adapter compilation.
- Windows CI must compile the full QA adapter and run its diagnostic
  serialization/privacy, Caller/Lifetime/Events and other library regressions.
- The new portable artifact must match this checkpoint's source and hashes.
- GUI startup and the remaining cause are NOT_VERIFIED. A separately approved
  single user-session launch should capture the fixed classification and
  source binding before any further behavioral fix is chosen.
