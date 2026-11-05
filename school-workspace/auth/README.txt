SCHOOL-01B isolated authentication adapters (implementation, not design-only)
Base: 9934ff56d462c4748956c7fa5b7111f7a1a92c26
Branch: feature/school-01b-auth-adapters

Layout
 common/types.ts          Safe DTOs/errors and status/restore/logout AuthAdapter.
 common/rpc.ts            Seven RPC types + abort/generation and approved context.
 server/ports.ts          MAIN/BFF-only secret session/provider/vault interfaces.
 server/session.ts        Internal session validation; never a Renderer DTO.
 server/flow.ts           Random state/flow, exact callback URL/parameter validation,
                         constant-time matching, TTL and synchronous one-use claim.
 server/supabase-provider.ts Official supabase-js Google PKCE/exchange/refresh/logout.
                         No default network transport; explicit injected fetch only.
 server/rpc-adapter.ts    Exact seven RPCs, user-token-only SDK transport, DTO
                         allowlists, cancellation. Never use service-role requests.
 electron/vault.ts        Windows safeStorage port + atomic, isolated encrypted blob.
 electron/main-adapter.ts Main authentication ownership, restore/logout and clearing.
 electron/ipc-contract.ts Four fixed channels: status/begin/restore/logout.
 electron/ipc.ts          Registers guarded Main handlers, reuses real assertSender.
 electron/preload.ts      Sandbox-safe frozen bridge; no Node fs/crypto/Main imports.
 electron/composition.ts  Explicit Main assembly seam; no automatic runtime wiring.
 web/session-store.ts     Replaceable store + TEST-ONLY RAM store, CAS/shared lock.
 web/bff-adapter.ts       Origin/CSRF/flow cookie, private Auth tokens, opaque handle,
                         refresh serialization and shared workspace generations.
 tests/                  MOCK providers/HTTP/RPC/safeStorage; real state/file/IPC
                         boundary logic and existing LocalTaskStore integration.
 evidence/               Test/build results and baseline comparison.
 reference/              Original SCHOOL-01A handoff ZIP, preserved byte-for-byte.

Run from an exact base repository after locked npm dependencies are installed:
  bash school-workspace/auth/run-checks.sh
Requires Node/npm per repository toolchain, Python3 for package verification, and
npm ci --ignore-scripts. This does not download/start Electron binaries or log in.
It rewrites local auth evidence. Keep the delivered evidence or use a second copy.
The original SCHOOL-01A SQL tests can separately run with Docker via local/run.sh;
its 34 PASS is historic evidence, not rerun or counted as new auth tests.

Current results: 59/59 isolated auth tests; 100/100 selected existing regressions.
Dedicated strict TypeScript and emitted JS/module-import checks PASS.
Existing electron:p0:build PASS (OCR staging, Main/Preload/Renderer/test tsc + Vite).
Root npm run build FAIL with 13 existing diagnostics; clean exact-SHA baseline
reproduces the same 13. No unrelated product fixes were made. See report/evidence.
No lint/typecheck npm scripts exist; their absence is not a PASS.

Boundaries and usage
- No Dashboard/Dock/legacy UI or Main entrypoint is changed or gated by login.
  Composition/preload exports are opt-in integration seams, not enabled features.
- Instantiate the SDK provider in Main/BFF only. Inject a vetted transport only in
  a separately authorized integration. Factory imports do not connect anywhere.
  All tests use synthetic .invalid hosts and in-memory HTTP responses.
- callbackBase is operator-selected, HTTPS for BFF and distinct desktop scheme
  for Main. Actual OS protocol registration/GoTrue allowlists are NOT verified.
- Flow state is carried as ws_state/ws_flow in redirectTo; official SDK owns PKCE
  verifier privately per flow. Provider state remains Supabase's responsibility.
- Common AuthAdapter deliberately covers status/restore/logout only. Sign-in and
  callback entry methods are platform-specific (Main beginSignIn/handleCallback,
  BFF begin/callback), with no platform storage/callback logic in common DTOs.
- BFF auth APIs accept POST with exact Origin and CSRF proof for existing sessions.
  Initial begin uses exact Origin; callback navigation uses state + HttpOnly flow
  cookie. Route code must forward actual headers and must not trust body Origin.
  Browser receives opaque __Host cookies + non-auth CSRF proof, never Auth tokens.
- BFF session store keeps refresh tokens server-side. MemoryWebSessionStore is
  rejected in production mode. A future production store must encrypt secrets at
  rest, supply atomic CAS/revoke and per-key locking across all BFF instances.
  No production store/host/routes are configured by this implementation.
- Workspace generation is kept in shared BFF records as well as local request
  scope. Even if abort is ignored or another instance switches school, stale
  success/error responses are discarded. Every real authorization remains DB/RLS.
- RPC transport requires publishable key and authenticated user access token, not
  service_role. JWT role-shape rejection is NOT signature verification or a grant
  of access; actual verification remains with Auth/API server (NOT RUN here).
- Callback, token, verifier and raw provider errors are not logged. Errors exposed
  by IPC use fixed codes only. getStatus returns UUID/expiry, not email/real name.
- Windows encryption tests use a marked MOCK safeStorage port. Actual DPAPI,
  Electron binary/browser callback, production OAuth/provider/PostgREST/remote
  session expiry/revocation are NOT RUN. Remote logout failure is unconfirmed;
  local deletion failure reports STORAGE_UNAVAILABLE and keeps Workspace locked.
- Initial memory-only OAuth flows do not survive process restart; retry sign-in.
  A durable/shared pending-flow store and network timeouts/limits must be reviewed
  before multi-instance production OAuth (session locking alone is insufficient).
- This foundation has no student-text/file input, personal-data upload, Finance
  vault integration, new school UI, task board, calendar/handover or inventory UI.
- New adapters and SQL are not deployed. Existing operating SECURITY DEFINER
  functions and Auth settings are untouched. No production Supabase calls occurred.
