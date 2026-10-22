# Finder Phase 2E-1B: disabled entrypoint composition

Bases: Desktop `22793f45dbb70d6152b25d6921ec1a952a1a2589`; Proxy `f2f68505e516f39319043f90959074a4e072aef2`.

## Runtime changes

Desktop's ordinary `education_video_search` command is now async and calls shared `command_core::run` with only the fixed `http_transport::execute`. The core prepares the validated request before invoking its adapter and converts failures to existing fixed messages. The adapter's first action is the unchanged `REAL_DISPATCH_ENABLED=false` gate, before HTTP-client construction. Request ID, Bearer, fixed destination, 12-second timeout, redirect prohibition and 256KiB response cap are unchanged. No webview-selected transport or runtime QA switch exists. The existing QA command remains separate and unchanged.

The actual Next POST route still exports the server handler. That handler now uses `createFinderRoute`, sharing the same `authenticateFinder`, cookie CSRF checks and prepared-handler composition as the synthetic tests. Trusted prepared configuration requires an injected RPC and provider transport; `createRpcFinderStore` reuses the existing coordinator/RPC contract. Production passes only `finderMode()` output (`mock` or `live-disabled`); it never supplies a prepared configuration, RPC, service credential or network transport. `EDUCATION_VIDEO_EXTERNAL_DISPATCH_ENABLED=false` remains unchanged. No environment variable, request header, URL parameter or JSON field can select prepared mode in the actual POST handler.

No Auth, quota, SQL, cache or schema rewrite was performed. Missing prepared configuration or RPC failure is fail-closed. No real key, service credential, user token or search data is logged or returned. Test fixtures contain fixed synthetic values only.

## Executed checks on 2026-10-22

- Proxy focused suite: 40/40 (route composition 10, actual POST gate 3, previous request contract 16, prepared handler 5, RPC adapter 6).
- Independent QA: Proxy 34/34 and Desktop identity/Finder regression 14/14.
- Native worker: new command tests 6/6; lightweight exact-source harness 34/34. A focused failing test first confirmed the old unconditional-disabled core could not execute the injected transport.
- Both TypeScript projects passed `node node_modules/typescript/bin/tsc --noEmit --incremental false` before the bridge addition; final Proxy check is recorded below.
- Personal HTTP driver against a temporary 127.0.0.1 server using the new composition and real RPC adapter returned 200/200/200/401. Same-ID replay was identical; two independent searches created two reservations/provider calls. Auth, RPC and provider were synthetic. Server shutdown and port closure were confirmed.
- Cross-language synthetic test passed independently and in the parent run: native shared command core → serialized request plan → in-process Proxy composition → actual RPC adapter → synthetic RPC/provider → native bounded response decoder. Five child-process roundtrips verified a video result, same-ID replay, new-ID search, expired and missing authentication. Provider-shaped fixture results use `source: live` to exercise the live contract; they are synthetic data and were never displayed as real search results.
- One combined Node/jsdom two-file run timed out at 30 seconds after printing an interop PASS. It is not counted as a passing command. Isolated interop (1.29s, exit 0) and composition (2.42s, exit 0) both passed; no further mixed-run retries were needed. The reason for that runner timeout is unconfirmed.

Runtime audit hypotheses and observations: request-selected prepared mode might bypass the gate (actual POST override tests returned NOT_CONFIGURED with zero Auth/fetch); composing through RPC might lose idempotency (replay and cross-process tests preserved UUID and avoided extra reservations); authentication/provider failures might dispatch or leak details (missing/expired/RPC-outage/malformed/timeout tests returned safe errors without unauthorized provider calls).

## Reproduction without rebuilding the app

From the Desktop worktree:

```sh
CARGO_INCREMENTAL=0 cargo test --offline --jobs 2 --manifest-path src-tauri/education-video-harness/Cargo.toml
CARGO_INCREMENTAL=0 cargo test --offline --jobs 2 --manifest-path src-tauri/education-video-harness/Cargo.toml --no-run
```

The second command prints the test executable path. From the Proxy worktree, use that absolute path explicitly (do not persist a machine-specific path in source):

```sh
EDUCATION_VIDEO_NATIVE_BRIDGE='<test executable path>' node node_modules/vitest/vitest.mjs run lib/education-video/native-interop.integration.test.ts --no-file-parallelism
node node_modules/vitest/vitest.mjs run lib/education-video/route-composition.test.ts lib/education-video/route-entry.test.ts lib/education-video/request-contract.test.ts lib/education-video/prepared-handler.test.ts lib/education-video/rpc-store.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The native stdio bridge is an ignored `cfg(test)` harness test, not part of the app. Without the explicit executable variable, the cross-repository interop test skips; that skip is not an interop PASS. Both repositories are needed to reproduce it. Only literal synthetic token labels are accepted before any bridge plan is emitted. Existing QA artifacts/caches were preserved; ignored local receipts are not uploaded in this source checkpoint.

## Boundaries and next approval

This is synthetic composition verification, not full Desktop UI/Tauri IPC/reqwest or external network E2E. The harness compiles the shared pure modules, not the Tauri macro or complete HTTP adapter. Full release builds, actual Supabase Auth/PostgREST/YouTube calls, SQL application, deployment and external-dispatch activation were NOT RUN.

Next real-auth/PostgREST verification needs explicit approval for an isolated non-production project/account, required Auth and server-only credential setup (values never logged), reviewed migration/RPC privileges and RLS, service-only RPC access, project quota budgets and cleanup/run markers. Verify cookie origin/CSRF and Bearer expiry/account binding, then transactional reservation/dispatch/finish contracts through actual PostgREST before considering a separately approved limited YouTube call. Do not activate either dispatch flag as part of this checkpoint.

Final receipts: after the bridge addition, a parallel combined typecheck/lint attempt reached its 60-second bound without diagnostics; it was not counted as PASS. An isolated `node --max-old-space-size=2048 node_modules/typescript/bin/tsc --noEmit --incremental false` passed (exit 0, about 17 seconds). Final native harness passed 34 tests with the explicit bridge ignored by default (1 ignored). The cross-language bridge was separately executed and passed rather than treating that default ignore as validation. All five review lanes returned terminal PASS for the final source scope; no full-native or live approval is implied.

Final changed-file ESLint and Rust formatting/diff checks passed. Complete intended checkpoint files were scanned with best-effort key/JWT/private-key/credential/PII patterns and scoped source review: no findings. A dedicated secret scanner was unavailable, so residual detection risk remains. No `.env`, build output, executable, ignored evidence or unrelated work is included. The temporary HTTP server was stopped; child bridge processes exited normally.
