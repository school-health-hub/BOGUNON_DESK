# SCHOOL WORKSPACE H1 — isolated authenticated HTTP candidate

Base: `3ed1be5765b9abad4115de0d30b76088407c4539`.
Branch: `feature/school-hosted-h1`. Integration/main remain unchanged.
Operating project: **UNASSIGNED**. No Hosted SQL, Auth configuration, real accounts or data are accessed.

## Runtime and IPC boundary

- `school-workspace/hosted-h1/server/http.ts`: `H1Http`, `checkedConfig`, `H1Error`. Fixed Auth paths and exact D0 public54 RPC argument manifest plus a separately identified Instructor pair. No arbitrary URL/REST/table proxy. Loopback test origin is exactly `http://127.0.0.1:<explicit nonprivileged port>`; dormant Hosted config requires an explicit matching20-character project ref and HTTPS Supabase origin. Public publishable key only; legacy anon JWT compatibility only in isolated tests. No secret/service key. Redirect/cookies/ambient credential forwarding forbidden. Request1.1MB/response4MiB/10s limits; abort/drain; no automatic write retries. Same logical RPC retries must keep the exact request UUID/payload; server receipts/version remain authoritative.
- `server/auth.ts`: `H1Auth(http, vault, openBrowser, optionalTestCredentials)`. Independent official Supabase2.117.2 client, in-memory SDK storage and separate encrypted vault. Tokens never enter DTO/IPC/UI. `getUser(accessToken)` verifies identity against the Auth server before authorized work; no user_metadata authorization. Official Google PKCE flow-ID + random-path loopback uses a new `AccountLoopback`, never the personal AccountService/session. Expiry/refresh serialized, latest user checked; logout clears locally, purpose-revokes server session then Auth local signout, reports remote revocation unconfirmed if offline. Normal dispose drains owned I/O, clears memory but retains encrypted vault for restore; explicit logout deletes it.
- `server/runtime.ts`: `createH1Runtime(auth)` composes existing School/Task/Activity/Inventory/Instructor controllers and strict context DTO decoder. Every RPC uses current user Auth context; server RLS/RPC reads current membership/session. School/account/logout transitions invalidate controllers and pending results. No personal JSON/data upload path. Unsupported reauth remains explicit, never fabricated by editing Auth tables.
- `server/contracts.ts`: exact54 argument names generated from frozen D0/H3 function evidence; Instructor2 remain distinct. SQL and client payload contracts are unchanged.

Main changes are limited to `workspace-product.ts` H1 gate and `main.mts` external-provider selection. Existing Preload and purpose IPC are unchanged. No generic HTTP/RPC method is exposed. `WorkspaceProductStatus.mode` remains `qa`, not a new operating-enabled mode. TD2/Home/Dock/QuickMemo/geometry, all Renderer/Preload, private stores, Instructor calculations/stamps/output and all original SCHOOL01–09 files are unchanged.

### Explicit QA gate

All conditions are required: nonpackaged app, validated isolated QA profile, valid UUID run ID, `NODE_ENV=development`, `SCHOOL_WORKSPACE_MODE=hosted-test`, `SCHOOL_H1_OPT_IN=isolated-h1`. Default/production/packaged modes stay CLOSED. `SCHOOL_H1_QA_CONFIG` must be a bounded nonsymlink file inside the approved QA root; it can configure **loopback only**. It contains generated test accounts only and is outside uploaded evidence. The external provider is built to `build/school-h1-qa`, outside the product app/Portable. No ordinary user can enable Hosted access with the new flags.

QA vault: `<isolated userData>/hosted-h1/school-workspace-auth-v1/session.bin`, protected by Windows safeStorage/DPAPI. Personal BOGUNON, Tauri, Finance and other vaults are not read or copied. Test account switch indices exist only in the external QA provider; they are not a Hosted account selector or authorization mechanism.

## Separate CLOSED Instructor addon

`school-workspace/hosted-h1/sql/01-instructor-addon-closed.sql` is a **review candidate**, not an applied migration or approved operating installer. It requires the exact D0 digest54 in CLOSED state and explicit `bogunon.h1_plan=REVIEW-CLOSED`, nonsuper postgres installer and no preexisting Instructor addon. Business validation/calculation DTO logic derives from the existing local candidate, but the local installer is not reused as an operating installer:

- New separate `workspace_instructor` and `workspace_instructor_private` schemas; avoids changing D0's catalog fingerprint or its manifest54.
- FORCE RLS on table/ledger, fixed owner/runtime roles with no new raw Auth access. Definer business functions keep existing current actor/session/member checks and empty search_path.
- Additional owner-only guard checks **both** parent D0 state and addon state on every read/write. Parent emergency CLOSED therefore blocks the addon even if a client grant remains.
- Creation uses explicit owner/runtime SET ROLE and temporary schema CREATE rights, all withdrawn before COMMIT. No extra role inheritance, BYPASSRLS, Auth grants or parent function policy changes.
- Scrub PUBLIC/anon/authenticated/service_role and inherited unknown default function/table/schema grants on new objects; leave only required owner/runtime rights. Both public2 and private2 client EXECUTE remain CLOSED.
- Transaction atomicity; duplicate installation fails closed before changes rather than deleting/replacing existing objects/data. Reinstallation/upgrade requires review. `02-emergency-close-addon.sql` closes and revokes without deleting data or reopening anything.

Local test activation is **not** an operating activation package. CI alone activates its disposable database. The frozen D0 lexical `xxownwxxajzrviuvvfiu` marker is passed only after checking an owned local Docker DB identity; it does not select or prove an operating project. D0's historical review marker must not be mistaken for approval to install on BogunOn.

## Verification and evidence

Existing workflow `.github/workflows/electron-cloud-g0.yml`, manual exact H1 branch only. No new deployment/Portable workflow. Two independent jobs:

1. Linux Ubuntu24.04: pinned Supabase CLI2.121.0 starts only isolated PostgreSQL/Auth/PostgREST/Kong. Official GoTrue signup/password sessions with generated synthetic accounts, real signed JWT/refresh/logout, Auth signature rejection, exact D0 CLOSED install, separate addon, PostgREST user RPCs, school/role/member denial, replay/conflict and Inventory writes. Valid Auth-issued token expiry is awaited (not fabricated), and a refreshed admin token is checked immediately before emergency closure. No key/status/credential/DB artifact; sanitized check summary only. Local fixture superuser may seed synthetic Workspace rows; installer itself remains nonsuper postgres. This is real **local** Supabase, never Hosted.
2. Windows2025: existing isolated native SCHOOL08 DB fixtures and real Electron Main/Preload/Renderer. H1 network/session runtime uses an explicit signed-JWT **simulated Auth/REST HTTP fixture** backed by native PostgreSQL. It is not GoTrue/PostgREST, and cannot prove the actual Windows-to-GoTrue route. Exercise shared tasks/events/handovers/Inventory, role/pending/school switch/logout/offline, separate DPAPI vault/restart, Instructor PDF/XLSX, private-data separation, TD210 memo/Dock cases and normal process cleanup. Ordinary/production gates are tested disabled. The fixture config is deleted and signing material remains memory-only.

Unit tests are explicitly MOCK, covering endpoint/key/path/DTO/redirect/size/timeout, ignored AbortSignal, drain, auth login/rejection/restore/refresh, stale logout and metadata nonauthority. Existing focused business/TD2 tests are rerun only where Main/connection changes affect them. Frozen native D0 evidence is historical, not added to new HTTP counts. Each job records its own source SHA; final run IDs, exact counts, hashes and residual processes are in the final report/artifacts.

Commands:

```
node node_modules/typescript/bin/tsc -p school-workspace/hosted-h1/tsconfig.json
node node_modules/vitest/vitest.mjs run school-workspace/hosted-h1/tests
node scripts/qa/school-h1-build.mjs
# Real HTTP CI: dedicated GitHub Linux runner only, never a local/operating DB fallback
node school-workspace/hosted-h1/qa/ci.mjs
# Windows: existing workflow creates owned profiles/native DB before this entry
node scripts/qa/school-h1-windows.mjs
```

## H2 prerequisites / explicit NOT RUN

Confirm the operating project and compatibility/backup/recovery evidence first. Existing BogunOn public Auth configuration does not establish Workspace target ownership. D0 requires a fresh nonconflicting namespace/role/function inventory and supported existing managed-Auth capabilities; existing operating data must never be reset or forced into this package. Instructor addon is separately reviewed; do not silently turn54 into56 or apply the original local-only candidate.

Separate approvals are needed for operating schema/RLS/GRANT/SQL, OAuth provider/redirect settings, actual user/school data, ordinary user Gate activation, integration/main merge, deployment or Portable replacement. No new project or paid service is required/created.

Hosted Auth/Google login/real registered schools, operating PostgREST/DB and user roles, actual Google callback allowlists, real user session behavior, OS DPI125/150, actual native dialogs/Explorer drop, physical print/Excel application and a new Portable are NOT RUN. Windows simulated Auth must not be promoted to Hosted PASS. A dormant `hosted-candidate` constructor is not an operating-ready product switch. H1 results do not authorize H2 automatically.

### QA corrections found during H1

The separate addon must explicitly switch to each schema/function owner under a nonsuper installer; inherited owner capabilities are not assumed. No broadening of a caller role/SECURITY DEFINER was used to bypass the error. Windows encrypted-vault checks were changed from the old synthetic-provider path to the H1 path, and restore is checked before explicit signout. An independent TD2 process check was found to adopt older unrelated processes after parent PID reuse; QA-only ownership now requires each child's creation time to be at or after its live parent's creation time, while final PID+creation matching and zero-residual assertions remain strict. Three pure ownership regression tests cover real descendants, PID reuse and missing identity. No unrelated process is killed.

Auth expiry checks accept the standard401/403 authentication rejection statuses and record the measured verifier skew allowance (maximum90s after original token exp), rather than assuming status401 or changing server clocks/claims. Client authorization still refreshes before expiry; no expiry policy is loosened.

The HTTP fixture explicitly seeds both the existing school table and SCHOOL02's directory table. Membership requests intentionally deny schools absent from the directory; tests must not bypass that policy. The existing manual workflow accepts `h1_focus=http-only` to rerun a changed Linux HTTP fixture without repeating an unchanged Windows product. A Windows run and a later HTTP-only QA commit are always reported with separate exact SHAs and a product-source diff; no Source SHA is relabelled.

The actual RPC contract may return `{error:"INPUT_REJECTED"}` with HTTP200. H1 normalizes this to INPUT before any controller can claim success; a unit regression and a real HTTP negative handover case cover it. The existing sensitive-content policy is preserved; even explanatory fixture text containing a forbidden term must be rejected, not used to weaken the policy. Definitive Auth rejection discards memory/vault and blocks the RPC port, while a network outage retains only the encrypted restore opportunity and still fails closed.
