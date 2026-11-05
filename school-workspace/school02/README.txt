SCHOOL-02 local school membership implementation
Base 166df05dd45402cb1a7526c9ae824ec11fcdb579
Branch feature/school-02-school-membership. No commit/push/deployment.

Restore the package using its root RESTORE_INTO_REPO.py into an exact clean product
clone, then run all commands from that repository root:
 npm ci --ignore-scripts --no-audit --no-fund
 node node_modules/typescript/bin/tsc -p school-workspace/school02/tsconfig.json
 SCHOOL02_BROWSER=1 bash school-workspace/school02/run-local.sh
 node node_modules/vitest/vitest.mjs run --config school-workspace/auth/vitest.config.ts
 npm run electron:p0:build
Dependencies: Node.js22+, npm, Bash, Python3, Docker local Unix socket, ripgrep,
OpenSSL, Chromium (/usr/bin/chromium by default; SCHOOL02_CHROMIUM may override).
For Windows browser testing use a compatible Bash/Docker/Chromium environment;
this package does not claim native Windows runtime verification.
The full command builds the local UI/server, creates a fresh PostgreSQL container,
runs contract + React/Main/BFF tests, resets only synthetic fixtures, starts local
HTTPS BFF, runs real Chromium UI->BFF->RPC flows, then deletes its own container,
server process and temporary self-signed TLS material. No TLS keys are packaged.
Use bash run-local.sh without SCHOOL02_BROWSER for contract/React tests only.
Test timeout30s allows repeated docker exec/psql calls; tests are serialized.
Image pinned to postgres17.6 digest. Database network none, no published ports,
tmpfs; refusal if the named container already exists. No remote DB URL accepted.
Local SQL requires school01a database and new workspace extension names.

The HTTP browser harness uses actual WebBffAuthAdapter and opaque HttpOnly Secure
SameSite=Lax handle, in-memory CSRF, Origin checks, no-store JSON and a fixed
command allowlist. Browser JS has no Supabase access/refresh tokens. Authentication
itself is SyntheticIdentityProvider + local auth.users/auth.sessions stubs, NOT GoTrue.
School authority is actual local RLS/RPC, never the synthetic fixture account picker.
The BFF MemoryWebSessionStore and session registry are TEST ONLY, not production.
The local server binds only https://127.0.0.1:5192. Do not deploy this harness.

Electron React integration tests use actual ElectronMainAuthAdapter, C coordinator,
validated purpose RPCs, and a dedicated frozen Preload bridge with fake IPC events
and the existing sender/frame/URL checks. The cipher is MOCK, not real DPAPI.
Electron Main -> UI integration is exercised in jsdom and actual local DB. The
980x700 Chromium layout uses the BFF route; it is not a Windows Electron run.
The product P0App entry is gated by DEV + ELECTRON_P0_PUBLIC_SCHOOL02_LOCAL=1.
Its optional window.school02 bridge must be registered by an isolated local harness
using server/ipc.ts; production Main/Preload are intentionally not registered.
If the bridge is absent, real actions are disabled with an explicit explanation.
No generic HTTP/SQL/file IPC is added. Do not inject this test bridge into production.

School search reuses existing EDUCATION_OFFICES and validateSchoolQuery.
Only the synthetic server directory is connected; NEIS live search/import trust is
NOT VERIFIED. Directory codes remain text and use composite school/code foreign
keys. Local personal school profile can only prefill a search term (prefill prop);
it cannot select a server membership or approve a user.

New local RPCs: ws_s02_directory, ws_s02_self, ws_s02_admin, ws_s02_space,
ws_s02_withdraw, ws_s02_expiry, ws_s02_transfers. Public wrappers are INVOKER;
private metadata helpers use nonowner NOBYPASSRLS reader, commands use existing
nonowner NOBYPASSRLS runtime. Tables remain unexposed and deny raw user access.
Existing A RPCs handle joining/decisions/roles/states/leaving/propose/accept.
The first-admin UI creates pending requests only; no operator approval RPC exists.
Synthetic reauth explicitly updates only the synthetic session fixture timestamp;
it is not actual provider reauthentication/MFA or operator employment verification.
Actual hosted opening/admin promotion controls remain disabled.

Root npm build has13 pre-existing TS errors identical to the clean base. No lint
or typecheck npm scripts exist. New strict TS check and Electron build are separate.
No private local files auto-upload; no student/clinical text field is collected.
SCHOOL-03 may begin isolated UI/RPC work; hosted Auth/PostgREST/managed auth.sessions
GRANTs and directory/first-admin verification require separate decisions/audit.
