-- REVIEW CANDIDATE ONLY. D0 must be installed CLOSED. No client grants or Auth hook.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h3:fresh', 0));
DO $install$
BEGIN
 IF current_setting('bogunon.admin_mfa_plan', true) IS DISTINCT FROM 'REVIEW-CLOSED'
 OR current_user <> session_user OR current_user <> 'postgres'
 OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
 THEN RAISE EXCEPTION 'admin_mfa_closed_review_required'; END IF;
END
$install$;
SET LOCAL ROLE ws_owner;
DO $dependency$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM workspace_private.h3_release
  WHERE state = 'closed' AND digest = '16243d5a443e6b7d40fc92a1ea14f3cd451798583aca740f3f1550d80354360f'
 ) OR (SELECT count(*) FROM workspace_private.h3_rpc_manifest) <> 54
 THEN RAISE EXCEPTION 'admin_mfa_requires_closed_d0'; END IF;
END
$dependency$;
RESET ROLE;

CREATE ROLE ws_admin_mfa_verifier NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION NOINHERIT;
CREATE SCHEMA workspace_admin_mfa AUTHORIZATION ws_runtime;
SET LOCAL ROLE ws_runtime;

CREATE TABLE workspace_admin_mfa.intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 session_id uuid NOT NULL,
 member_id uuid NOT NULL,
 member_version bigint NOT NULL,
 school_id uuid NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('propose', 'accept')),
 target_id uuid NOT NULL,
 transfer_mode text,
 expected_version bigint,
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 factor_challenge_id uuid UNIQUE,
 bound_at timestamptz,
 verified_at timestamptz,
 closed_at timestamptz,
 CHECK (expires_at > issued_at),
 CHECK ((factor_challenge_id IS NULL) = (bound_at IS NULL)),
 CHECK (verified_at IS NULL OR verified_at >= bound_at),
 CHECK ((purpose = 'propose' AND transfer_mode IS NOT NULL AND transfer_mode IN ('add', 'transfer') AND expected_version IS NULL)
     OR (purpose = 'accept' AND transfer_mode IS NULL AND expected_version IS NOT NULL AND expected_version > 0))
);
CREATE UNIQUE INDEX one_open_intent ON workspace_admin_mfa.intents(user_id, session_id) WHERE closed_at IS NULL;
ALTER TABLE workspace_admin_mfa.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_admin_mfa.intents FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON workspace_admin_mfa.intents TO ws_runtime USING (true) WITH CHECK (true);

CREATE FUNCTION workspace_admin_mfa.assert_legacy_closed() RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
 IF EXISTS (
  SELECT 1 FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS client(role_name)
  CROSS JOIN unnest(ARRAY[
   'public.ws_v1_propose_admin_change(uuid,uuid,text,uuid)'::regprocedure,
   'public.ws_v1_accept_admin_change(uuid,uuid,bigint,uuid)'::regprocedure,
   'workspace_private.propose_admin_change(uuid,uuid,text,uuid)'::regprocedure,
   'workspace_private.accept_admin_change(uuid,uuid,bigint,uuid)'::regprocedure
  ]) AS legacy(signature)
  WHERE has_function_privilege(client.role_name, legacy.signature, 'EXECUTE')
 ) THEN RAISE EXCEPTION 'legacy_admin_transfer_must_stay_closed'; END IF;
END
$fn$;
SELECT workspace_admin_mfa.assert_legacy_closed();

CREATE FUNCTION workspace_admin_mfa.begin_intent(p_school uuid, p_purpose text, p_target uuid, p_mode text, p_version bigint)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 uid uuid := workspace_private.request_uid();
 sid uuid := (workspace_private.request_jwt()->>'session_id')::uuid;
 issued timestamptz;
 intent_id uuid;
 membership workspace.school_memberships;
BEGIN
 PERFORM workspace_admin_mfa.assert_legacy_closed();
 IF uid IS NULL OR sid IS NULL OR p_school IS NULL OR p_target IS NULL
 OR p_purpose IS NULL OR p_purpose NOT IN ('propose', 'accept')
 THEN RAISE EXCEPTION 'invalid_admin_mfa_intent'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-mfa:'||sid::text, 0));
 PERFORM workspace_private.enter(p_school, p_purpose = 'propose');
 IF p_purpose = 'accept' AND workspace_private.member_role(p_school) IS DISTINCT FROM 'HEALTH_TEACHER'
 THEN RAISE EXCEPTION 'eligible_teacher_required'; END IF;
 SELECT * INTO STRICT membership FROM workspace.school_memberships WHERE school_id = p_school AND actor_id = workspace_private.actor();
 issued := clock_timestamp();
 UPDATE workspace_admin_mfa.intents SET closed_at = issued
 WHERE user_id = uid AND session_id = sid AND closed_at IS NULL;
 INSERT INTO workspace_admin_mfa.intents(user_id, session_id, member_id, member_version, school_id, purpose, target_id, transfer_mode, expected_version, issued_at, expires_at)
 VALUES (uid, sid, membership.id, membership.version, p_school, p_purpose, p_target, p_mode, p_version, issued, issued + interval '2 minutes')
 RETURNING id INTO intent_id;
 RETURN intent_id;
END
$fn$;

-- The verifier principal must create the provider challenge after begin_intent,
-- bind its exact ID before verification, and report only a matching provider result.
CREATE FUNCTION workspace_admin_mfa.bind_factor(p_intent uuid, p_user uuid, p_session uuid, p_factor_challenge uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 UPDATE workspace_admin_mfa.intents SET factor_challenge_id = p_factor_challenge, bound_at = clock_timestamp()
 WHERE id = p_intent AND user_id = p_user AND session_id = p_session AND p_factor_challenge IS NOT NULL
 AND closed_at IS NULL AND factor_challenge_id IS NULL AND expires_at > clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'admin_mfa_binding_denied'; END IF;
END
$fn$;

CREATE FUNCTION workspace_admin_mfa.attest_factor(p_intent uuid, p_user uuid, p_session uuid, p_factor_challenge uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 UPDATE workspace_admin_mfa.intents SET verified_at = clock_timestamp()
 WHERE id = p_intent AND user_id = p_user AND session_id = p_session AND factor_challenge_id = p_factor_challenge
 AND closed_at IS NULL AND verified_at IS NULL AND expires_at > clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'admin_mfa_attestation_denied'; END IF;
END
$fn$;

CREATE FUNCTION workspace_admin_mfa.cancel_intent(p_intent uuid) RETURNS void
 LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
 UPDATE workspace_admin_mfa.intents SET closed_at = clock_timestamp()
 WHERE id = p_intent AND user_id = workspace_private.request_uid()
 AND session_id = (workspace_private.request_jwt()->>'session_id')::uuid AND closed_at IS NULL
$fn$;

GRANT USAGE, CREATE ON SCHEMA workspace_admin_mfa TO ws_authz_reader;
SET LOCAL ROLE ws_authz_reader;
CREATE FUNCTION workspace_admin_mfa.inviter_active(p_school uuid, p_transfer uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT EXISTS (
  SELECT 1 FROM workspace.admin_transfers t
  JOIN workspace.school_memberships m ON m.id = t.from_id AND m.school_id = t.school_id
  JOIN workspace.accounts a ON a.id = m.actor_id
  WHERE t.id = p_transfer AND t.school_id = p_school AND t.state = 'proposed'
  AND t.expires_at > statement_timestamp()
  AND m.status = 'active' AND m.role = 'SCHOOL_ADMIN' AND a.status = 'active' AND a.user_id IS NOT NULL
  AND m.valid_from <= statement_timestamp() AND (m.valid_until IS NULL OR m.valid_until > statement_timestamp())
 )
$fn$;
DO $scrub$
DECLARE recipient text;
BEGIN
 FOR recipient IN
  SELECT CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee)) END
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))
  WHERE p.oid = 'workspace_admin_mfa.inviter_active(uuid,uuid)'::regprocedure AND grantee <> p.proowner
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION workspace_admin_mfa.inviter_active(uuid,uuid) FROM %s', recipient); END LOOP;
END
$scrub$;
GRANT EXECUTE ON FUNCTION workspace_admin_mfa.inviter_active(uuid,uuid) TO ws_runtime;
SET LOCAL ROLE ws_runtime;
REVOKE CREATE ON SCHEMA workspace_admin_mfa FROM ws_authz_reader;

CREATE FUNCTION workspace_admin_mfa.execute_intent(p_intent uuid, p_school uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 uid uuid := workspace_private.request_uid();
 sid uuid := (workspace_private.request_jwt()->>'session_id')::uuid;
 intent workspace_admin_mfa.intents;
BEGIN
 PERFORM workspace_admin_mfa.assert_legacy_closed();
 IF uid IS NULL OR sid IS NULL OR NOT workspace_private.session_ok()
 THEN RAISE EXCEPTION 'unauthenticated_or_revoked'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-mfa:'||sid::text, 0));
 SELECT * INTO intent FROM workspace_admin_mfa.intents
 WHERE id = p_intent AND user_id = uid AND session_id = sid AND school_id = p_school
 AND closed_at IS NULL AND verified_at IS NOT NULL AND expires_at > clock_timestamp()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'admin_mfa_required'; END IF;
 PERFORM workspace_private.enter(p_school, intent.purpose = 'propose');
 IF NOT EXISTS (SELECT 1 FROM workspace.school_memberships
  WHERE school_id = p_school AND actor_id = workspace_private.actor()
  AND id = intent.member_id AND version = intent.member_version)
 THEN RAISE EXCEPTION 'admin_mfa_membership_changed'; END IF;
 IF intent.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'admin_mfa_required'; END IF;
 IF intent.purpose = 'accept' AND workspace_private.member_role(p_school) IS DISTINCT FROM 'HEALTH_TEACHER'
 THEN RAISE EXCEPTION 'eligible_teacher_required'; END IF;
 IF intent.purpose = 'accept' AND NOT workspace_admin_mfa.inviter_active(p_school, intent.target_id)
 THEN RAISE EXCEPTION 'admin_mfa_inviter_changed'; END IF;
 UPDATE workspace_admin_mfa.intents SET closed_at = clock_timestamp() WHERE id = intent.id;
 IF intent.purpose = 'propose' THEN
  RETURN workspace_private.propose_admin_change(p_school, intent.target_id, intent.transfer_mode, intent.id);
 END IF;
 RETURN workspace_private.accept_admin_change(p_school, intent.target_id, intent.expected_version, intent.id);
END
$fn$;

-- Scrub even custom creator default grants on the new schema, relation and functions.
DO $acl$
DECLARE entry record;
BEGIN
 FOR entry IN
  SELECT DISTINCT kind, target, CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee)) END AS recipient
  FROM (
   SELECT 'SCHEMA' AS kind, quote_ident(nspname) AS target, (aclexplode(coalesce(nspacl, acldefault('n', nspowner)))).grantee
   FROM pg_namespace WHERE nspname = 'workspace_admin_mfa'
   UNION ALL
   SELECT 'TABLE', 'workspace_admin_mfa.intents', (aclexplode(coalesce(relacl, acldefault('r', relowner)))).grantee
   FROM pg_class WHERE oid = 'workspace_admin_mfa.intents'::regclass
   UNION ALL
   SELECT 'FUNCTION', p.oid::regprocedure::text, (aclexplode(coalesce(proacl, acldefault('f', proowner)))).grantee
   FROM pg_proc p WHERE pronamespace = 'workspace_admin_mfa'::regnamespace AND proname <> 'inviter_active'
  ) acl WHERE grantee <> (SELECT oid FROM pg_roles WHERE rolname = 'ws_runtime')
 LOOP EXECUTE format('REVOKE ALL ON %s %s FROM %s', entry.kind, entry.target, entry.recipient); END LOOP;
END
$acl$;

GRANT USAGE ON SCHEMA workspace_admin_mfa TO ws_authz_reader, ws_admin_mfa_verifier;
GRANT EXECUTE ON FUNCTION workspace_admin_mfa.bind_factor(uuid, uuid, uuid, uuid),
 workspace_admin_mfa.attest_factor(uuid, uuid, uuid, uuid) TO ws_admin_mfa_verifier;
RESET ROLE;
COMMIT;
