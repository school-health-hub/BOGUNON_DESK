SCHOOL-01C local integrated contract verification
Base: 166df05dd45402cb1a7526c9ae824ec11fcdb579
Branch: feature/school-01c-integrated-contract. No commit is part of this package.

Requirements: Node.js 22+, npm, Python3, Bash, local Docker Unix socket.
No Supabase URL, API key, real user or hosted database is required or accepted.
Run from repository root restored using the package RESTORE_INTO_REPO.py:
  npm ci --ignore-scripts --no-audit --no-fund
  node node_modules/typescript/bin/tsc -p school-workspace/integration/tsconfig.json
  bash school-workspace/integration/run-local-db.sh
  node node_modules/vitest/vitest.mjs run --config school-workspace/auth/vitest.config.ts
  npm run electron:p0:build
Root npm run build has 13 unchanged baseline TS errors. There are no root lint or
 typecheck scripts. Do not interpret those absent scripts as passing.

Fresh DB harness refuses existing containers, uses pinned PG17.6 image, no network
or published ports, tmpfs data, and removes only the container it creates.
The network is used only for image pull/npm install. RPC success uses school_client
SET LOCAL ROLE authenticated, never postgres/service_role. postgres is restricted
to DDL/fixture/catalog or explicit failure injection. Auth users/sessions are minimal
local stubs, not GoTrue. SyntheticIdentityProvider and token registry are MOCK.
Windows safeStorage tests use a fake cipher: actual DPAPI/Windows NOT RUN.

Development UI (MOCK preview only, no API calls):
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort
Open /school-workspace/integration/dev-ui/mobile.html or desktop.html on localhost.
Optional ?scenario=pending, session-expired, denied renders the matching safe state.
In another shell, with Chromium installed:
  node school-workspace/integration/browser-check.mjs
SCHOOL01C_CHROMIUM can point to an installed Chromium binary. Default /usr/bin/chromium.
This records 390x844 / 980x700 screenshots and checks no horizontal overflow.

Electron P0App entry is behind import.meta.env.DEV AND
ELECTRON_P0_PUBLIC_SCHOOL01C_DEV=1. Production build excludes it.
The entry uses the same browser-only MOCK preview. It does not install a real
Main authentication provider or host login callback. Dedicated Main/Preload IPC
integration is tested with synthetic IPC events -> actual Main auth -> LOCAL DB;
it is not registered by production Main or existing production Preload.
Windows app/packaging/manual GUI QA is NOT RUN. No Portable is built.

Actual integration path in tests:
B ElectronMainAuthAdapter OR WebBffAuthAdapter -> C platform port -> shared
WorkspaceCoordinator -> B validated RPC DTO -> C LocalDatabaseRpcTransport ->
actual A public RPC -> runtime/reader RLS -> synthetic rows. Tokens stay server/Main.
C uses a local-only self-membership status SQL extension because A get_context
correctly denies pending/suspended members without exposing their shared context.
The extension returns only self status; it is not an approved hosted migration.

B adaptation: one server-only runAccountRequest method supports bootstrap/status
before selecting a school. Original B ZIP and manifest are retained separately.
Nested Electron request scopes must be distinct: school switch invalidates its
context scope, not the enclosing authorized-token scope. Generation and abort
checks discard even delayed transports that ignore AbortSignal.

SCHOOL-02 can begin isolated UI work against these contracts. Before hosted use:
provider/redirect/PKCE callback, JWT/GoTrue session and revocation behavior,
managed auth.sessions grants, public/private PostgREST and role deployment need
separate verification. The status RPC naming/DTO and account-level request_join
UI orchestration must be finalized before wiring SCHOOL-02. No shared business
content tables, real join approval UI, or first-admin operator verification is added.
