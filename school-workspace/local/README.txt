SCHOOL-01A local synthetic DB/RLS prototype

Base: 38b45c2a762224f0af976026519b3d47463e4454
Branch: feature/school-01a-local-rls (uncommitted, local only)
Scope: DB/RLS/RPC only. No SCHOOL-02/03 UI, Electron/Web authentication adapter,
production deployment or hosted Supabase operation.

Reproduce from a Docker-enabled isolated machine:
  bash school-workspace/local/run.sh
Dependencies: Docker local socket, Python 3, Bash. No npm dependencies needed for
reproduction. PostgreSQL image is pinned by digest in run.sh. Network is used only
for image pull; database container uses --network none, listen_addresses='', no
published ports, tmpfs data. The runner deletes only the container it creates.
Existing container with the same name causes a refusal, never implicit reuse.

SQL is generated under supabase/migrations using official CLI 3.0.0 migration new.
It is a LOCAL PROTOTYPE, not approved production migration. The first database
name guard requires school01a; existing workspace namespace causes refusal.
Never apply this SQL to the existing BogunOn or any other hosted project.

Auth stub: tests/auth_fixture.sql creates minimal auth.users/auth.sessions and
trusted request.jwt.claims readers. It does not implement Supabase Auth, JWT
signature verification, GoTrue, PostgREST, refresh tokens or MFA. Test SQL supplies
synthetic claims as a trusted gateway stand-in. psql runs RPCs as school_client
with only authenticated membership; it cannot SET ROLE runtime/owner/reader.
Privileged postgres use is limited to schema creation, synthetic fixture setup,
catalog inspection and explicitly marked constraint/role-probe/failure injection.
No core success RPC executes with postgres or service_role privileges.

13 private tables, 30 RLS policies, 10 invoker public RPC wrappers. ws_runtime and
ws_authz_reader are NOLOGIN/NOBYPASSRLS and nonowners of workspace tables.
ws_owner is a separate NOLOGIN/NOBYPASSRLS DDL owner; all tables ENABLE/FORCE RLS.
Metadata reader has narrow metadata access; client cannot call its helpers.
Purpose implementations enter ws_runtime through SECURITY DEFINER with empty
search_path. No existing public function is reused or its ACL changed.

Concurrency: transaction-scoped advisory lock per school, plus per-actor/request
lock for idempotency. This intentionally serializes small-school commands rather
than optimizing throughput. All RPCs use current DB state after acquiring locks.
Membership terms preserve immutable participation epochs; old overrides cannot
become current after rejoin. Self role promotion requires proposal and candidate
acceptance, and only an already approved teacher is eligible.

Prototype boundaries requiring future implementation/review:
- Hosted managed auth.sessions schema and grants; runtime role creation rights.
- Auth service/global disable integration; local tests use workspace account state.
- Operator verification and recovery are synthetic fixtures only; no live approval.
- General business permission mutation UI/RPC, invitations, retention jobs, disaster
  recovery executor and first-admin operator workflow are outside this minimum.
- get_context returns access_denied to pending users. bootstrap returns account ID;
  pending-status/member-list UI DTOs from the full design are deferred to SCHOOL-02.
- Receipts store ONLY structural role/state/UUID parameters for this local prototype,
  rather than business text. Hashing/redaction contract must be completed before
  general task/handover text is accepted. Receipt expiry is checked at 7 days;
  physical retention cleanup is not implemented.
- New RPC recent-login check uses synthetic session created_at, not a verified MFA
  or reauthentication provider marker. Confirm hosted semantics before adapters.
- A last admin cannot use ordinary leave/demotion/suspend to orphan an active
  school. Natural expiry/no valid admin fails closed; operational recovery_locked
  reconciliation and emergency operator recovery remain outside this prototype.
- Arbitrary-text student privacy validation is not claimed: no task/event/handover
  content table or input API is introduced. Role and request parameters are enums.
- Existing 19 SECURITY DEFINER warning functions were not called, changed or audited.

Evidence:
  evidence/results.json        final 34 tests, 0 failures, explicit NOT RUN list
  evidence/test-output.txt     final execution output
  evidence/pre_fix_results.json development run: 33 pass/1 failure, kept transparently
  evidence/catalog.json       actual roles/table ownership/RLS/function ACL metadata
  evidence/migration-apply.log actual fresh database DDL application
  evidence/isolation.txt       network none, no published ports
  evidence/image-digest.txt    actual pinned image digest
  evidence/static-check.txt   bounded static checks, not a hosted schema audit

Bug found by extra bootstrap test: accounts SELECT originally used actor ID before
that ID existed, causing ON CONFLICT INSERT RLS rejection for a brand-new account.
Fixed to user_id=auth.uid() with a live session check. Reapplied migration to a
fresh database and reran the full suite. pre_fix_results.json is not final status.

Final label: CONDITIONAL. Local required 15 scenarios all PASS. Hosted Auth,
PostgREST and managed grants remain NOT RUN. No commit/push/PR/merge/deployment.
