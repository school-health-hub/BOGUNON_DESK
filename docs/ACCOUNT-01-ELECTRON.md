# ACCOUNT-01 — existing BOGUNON Google account connection

Base: `integration/electron-feature-baseline` / `86f4fceed7b7a8774affc0c9db556f592eaa29ba`, confirmed against remote before implementation. New isolated branch: `feature/electron-bogunon-account`.

## Original implementation and missing Electron boundary

The existing Tauri flow is `src/auth/authService.ts.signInWithGoogle` → `getSupabaseClient().auth.signInWithOAuth(provider:'google')` → `src-tauri/src/auth.rs.open_auth_url` → system browser. It uses the existing Supabase project (`config/production-supabase.json`), the public/anon client key, PKCE, `experimental.appendPkceFlowIdToRedirects`, and the `sb_flow_id` correlation contract. `school-health-desk://auth/callback` is parsed by `src/auth/authCallback.ts`, then `exchangeCodeForSession(code,{flowId})` completes the existing account login. Supabase `User.id` is the account identifier; email/display name come from its user DTO.

Tauri session storage is `secureSessionStorage` → `secure_session_get/set/remove/clear` → Windows user-scope DPAPI `auth-session.bin`. `AuthService.initialize` restores the SDK session and handles auth changes; sign-out revokes through the provider and clears the local vault. The existing school repository reads only `user_settings` columns `neis_office_code,neis_school_code,neis_school_name,neis_office_name`, filtered by `user_id`, with `maybeSingle()`. See `src/auth/*.test.ts`, `src/school-info/*test.ts`, `src-tauri/src/auth/tests.rs` for original test contracts. File presence is not evidence of live login in this task.

Electron's closed renderer deliberately excludes `@tauri-apps`, `@supabase`, and the Tauri auth service. Before ACCOUNT-01 there was no account Main service/typed Preload API, and school settings displayed an unsupported notice. The underlying provider, account UUID, server table, and schema do not need replacement.

## Implemented path

- Existing settings → school profile / initial school setup now embeds `BogunonAccount`. It shows configuration/security availability, login state, current account, registered school, refresh, cancel, disconnect and account switch. NEIS manual school selection remains available.
- `account-sdk.ts` reuses the installed official Supabase SDK, same Google provider, PKCE S256 and flow-ID mode. No second Google authentication implementation, password collection, account creation, new provider or Rust helper.
- Main owns the SDK, storage, request validation, native confirmations and external browser opening. Preload exposes only `status/signIn/signOut/cancel/refresh/applySchool`; no URL, arbitrary user ID/query, password, token, session import or generic HTTP API.
- Cached local session alone does not authorize a signed-in DTO: Main calls the existing provider's `getUser`, checks the session's user ID, then reads only that user's original school fields. Invalid/incomplete/unsupported school data does not overwrite local settings or imply no registered school. School query errors are distinct from successful account login.
- Refresh uses the SDK refresh-token flow, rotating persisted credentials through the same encrypted adapter. Main owns the refresh timer; SDK auto refresh is disabled to avoid duplicate timers. 10-second bounded API requests, bounded 256 KiB bodies, exact endpoint/method/query allowlist, no redirects/cookies/NTLM/downloads and generic sanitized transport errors. Local transport cancellation maps to an SDK error without SDK network retry loops. Responses do not include provider diagnostics, tokens or raw session JSON.
- Account switch clears the previous identity/school cache before a new flow. Logout immediately invalidates access and in-flight work, clears the Electron vault, and attempts local-scope server revocation using a separate temporary SDK instance/memory storage. A network revocation failure is reported separately from successful local logout. A failed local vault clear is **not successful logout**: server access stays blocked in that process, a storage error warns that disconnect must be retried before restart; old on-disk credentials may still exist until a successful clear.
- Generation checks and precommit storage guards reject old callbacks, network replies and storage writes after cancel/logout/switch. Callback listener, refresh timer, requests and SDK resources are cleaned on actual exit. Renderer invalidation suspends and permits safe reconstruction; tray hide does not dispose the account service. No forced whole-app remount/restart. Actual Windows behavior is untested.

## Callback compatibility / required operational review

The original custom-scheme callback remains owned by the existing Tauri registration. Electron does **not** register or take over `school-health-desk://`, inspect its authentication files, or modify OS protocol associations.

Electron uses the official Google/Supabase PKCE flow with a process-owned `http://127.0.0.1:<ephemeral-port>/auth/callback/<random-path>` listener. Strict path/host/method, random path, matching flow ID, duplicate query, token-fragment, size and timeout checks apply. Only one valid return is accepted. The browser return page contains no code/token values. Callback codes/verifiers never enter Renderer or logs. Google/Supabase provider-side state handling and code verification remain the SDK/provider's responsibility.

**This redirect must be allowed by the existing production Supabase OAuth redirect configuration. Its present allowlist was NOT inspected or changed.** If a corresponding loopback pattern (including the SDK's flow-ID query) is absent, an operator-approved provider configuration change is required. No production Google settings, redirect allowlists, RLS, DB schemas or server policies were modified. This is a compatibility condition, not proof that current production login works. New loopback behavior does not claim binary parity with Tauri's custom-scheme callback.

## Build configuration / packaging

`scripts/electron-p0/build.mjs` loads the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` public build variables as the existing release contract (`docs/RELEASE.md`). Origin must match `config/production-supabase.json`; only public publishable/legacy anon keys are accepted, never a service-role/server publishing credential. Config values are not printed or committed. Missing/invalid config produces a functioning offline product with explicit account-login disabled state; it does not substitute synthetic login.

The existing SDK is bundled once for **Main only** by `vite.account.config.ts` into `main/account-sdk.js`. `account-config.json` is a public app resource, not a user credential store. Main's relative runtime graph and standalone bundled SDK are checked; the renderer's existing closed-dependency build guard remains unchanged. No new dependencies, native CLI, workflow or Portable build. Existing native CLI 5/OCR declarations remain unchanged.

Observed Cloud build: **public auth configuration missing or invalid; login disabled**. No key was discovered from other user files, generated, or borrowed from a different service. A correctly configured release build plus approved callback compatibility and Windows verification are prerequisites for actual use.

## Token and data protection

Electron-only path: `<userData>/work-data/bogunon-account/session.bin`, including the existing isolated QA profile root. Windows `safeStorage`/DPAPI is mandatory; no Linux/plaintext fallback. The versioned SDK storage map is encrypted, capped and written via exclusive temp file + sync + existing bounded EPERM atomic replacement. Linked/unsafe paths are refused. Corrupt storage is not silently reset; explicit disconnect is needed to forget it. Tests use an explicit synthetic test cipher, not actual DPAPI.

No Tauri auth file, Finance key/database, school portal cookie, certificate, school credential or API key is read/moved. Existing local tasks, events, templates and app settings stay separate. User-visible account UUID/email/display name and registered school are intentional DTO fields; tokens, Google provider tokens and PKCE verifiers remain Main-only encrypted SDK state.

## School application and Cloud C contract

Account school is displayed beside the current local school. Only explicit user selection and native confirmation authorize `applySchool({accountRevision,expectedSchoolRevision})`. Main revalidates the authenticated user and registered school, then uses `SchoolProfileStore.save` with revision/recovery checks and a narrow prewrite guard. Logout, switch, a changed account school or a changed local revision invalidates application. Write failure/cancel preserves the existing school bytes.

Applied school uses the same four-field `SchoolInfo` DTO, and refreshes the existing `SchoolProfileProvider`. STABILITY-03 address review then reads that selected office code. Addresses are **not applied automatically**. Logout/switch intentionally preserves explicitly applied local school, existing URLs, leave/Excel data, tasks and other local work. No Tauri migration or server writes.

For Cloud C, the canonical principal remains the existing Supabase `User.id` UUID, verified in Main; school metadata comes from the existing per-user `user_settings` projection under existing authenticated RLS. Renderer IDs must never authorize a server operation. This is not School Workspace membership/approval, a tenant identifier, shared-calendar synchronization, settings synchronization or an admin role. Those remain separate future Main-owned APIs and server-authorized contracts. The legacy local `SchoolLoad.bogunon:'unavailable'` field is retained for DTO compatibility; connection status is now the dedicated `AccountBridge` state, not that old synchronization marker.

## Validation / limits

- Focused regression: **108 PASS / 16 files** (not a full-suite rerun): account, school/NEIS/portal, original launcher boundary, STABILITY-01/02, Quick Add, TD2 Glass and QA isolation.
- Final account-specific set: **16 PASS / 2 files**, including real installed SDK PKCE against synthetic responses, fresh-service disk restoration, refresh/expiry, logout/switch, pending reply invalidation, failed clear/write, reconstructed renderer lifecycle, school confirm/cancel, unsafe IPC/network/callback inputs, actual Cloud loopback listener close, UI and Preload. These overlap the regression count and are not additive. No actual external auth requests.
- Electron Main/Preload, renderer and tests TypeScript + production build PASS. One test mock signature type defect was fixed during implementation; no product workaround. Root `tsc --noEmit` has the existing **13 errors**, identical to STABILITY-03, **0 new**. No standalone lint script exists; none added.
- **7 PASS** ASAR/runtime/native/SDK contracts: temporary ASAR includes the complete Main graph, existing native 5 resources/provenance, self-contained built SDK runs offline S256 PKCE with 0 requests, public config origin matches the original project, and closed renderer remains closed. No Windows packaging performed.
- Existing Purchase Excel debug resource and Record provenance were reused for unchanged focused test boundaries only; temporary local symlink removed. No engine/source changes. Diff, changed-path and credential-pattern checks before commit.
- Local logs: `/tmp/account-regressions.log`, `/tmp/account-final-focused.log`, `/tmp/account-package-tests.log`, `/tmp/account-build-checked.log`, `/tmp/account-root-types.log`. No credentials or tokens in those logs.

**NOT RUN:** production Google/BOGUNON login, live session refresh/revocation, current OAuth redirect allowlist, authenticated production school/RLS reads, Windows DPAPI/native browser/dialogs/tray/quit/process cleanup, small-window/DPI GUI and Portable. No operating account creation or real school/student/financial data access. Prior Windows PASS / TD2 PARTIAL is not promoted to this SHA.

## Changed files / assessment

New `electron-p0/account-protocol.ts`; `main/account-{vault,network,sdk,loopback,service,ipc}.ts`; `renderer/school-profile/BogunonAccount.tsx`; `vite.account.config.ts`; account tests and `scripts/electron-p0/account-package.test.mjs`. Wiring changes: `main/main.mts`, `main/school-profile.ts`, `preload/preload.cts`, `protocol.ts`, `builder.json`, `renderer/P0App.tsx`, `renderer/school-profile/SchoolProfile.tsx`, existing school-profile UI test, and existing build script. No production provider configuration or schema changes.

**CONDITIONAL**: implementation/Cloud tests complete; public release configuration, approved callback compatibility and real Windows/production login remain prerequisites. Cloud B can fast-forward only if its target is still this base or another ancestor of the feature commit; remote HEAD must be rechecked. Integration/main, other worktrees, existing EXEs and user data are not updated by this task.
