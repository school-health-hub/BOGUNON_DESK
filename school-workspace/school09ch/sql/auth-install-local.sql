-- LOCAL ONLY Auth-boundary feasibility probe. NOT a Hosted/fresh cumulative migration.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$DECLARE r text;BEGIN
 IF current_database()<>'school01a'OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 'isolated_probe_required';END IF;
 IF current_user<>session_user THEN RAISE EXCEPTION 'direct_install_identity_required';END IF;
 IF to_regnamespace('workspace_auth_bridge')IS NOT NULL THEN RAISE EXCEPTION 'auth_bridge_collision';END IF;
 FOREACH r IN ARRAY ARRAY['supabase_auth_admin','ws_owner','ws_authz_reader']LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r)THEN RAISE EXCEPTION 'role_prerequisite_missing';END IF;
 IF NOT pg_has_role(session_user,r,'SET')THEN RAISE EXCEPTION 'role_set_capability_required:%',r;END IF;
 END LOOP;
 IF NOT has_database_privilege(current_user,current_database(),'CREATE')THEN RAISE EXCEPTION 'database_create_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s08_release WHERE state='closed')THEN RAISE EXCEPTION 'closed_baseline_required';END IF;
 IF(SELECT count(*)FROM workspace_private.s08_rpc_manifest)<>54 OR EXISTS(SELECT 1 FROM workspace_private.s08_rpc_manifest m WHERE has_function_privilege('authenticated',m.public_signature,'EXECUTE')OR has_function_privilege('authenticated',m.private_signature,'EXECUTE')OR has_function_privilege('anon',m.public_signature,'EXECUTE'))THEN RAISE EXCEPTION 'all54_closed_required';END IF;
 IF(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions'))<>2 THEN RAISE EXCEPTION 'auth_tables_missing';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions')AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname='supabase_auth_admin'))THEN RAISE EXCEPTION 'auth_owner_mismatch';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.oid=(SELECT x.oid FROM pg_class x JOIN pg_namespace z ON z.oid=x.relnamespace WHERE z.nspname='auth'AND x.relname='sessions') AND c.relforcerowsecurity AND NOT(r.rolsuper OR r.rolbypassrls))THEN RAISE EXCEPTION 'auth_force_rls_review_required';END IF;
END$$;
-- LOCAL DESIGN PROTOTYPE. Requires an Auth-owned, non-exposed boolean bridge.
-- No client or Workspace execution role receives auth.sessions SELECT.
CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;
SET LOCAL ROLE supabase_auth_admin;
REVOKE ALL ON SCHEMA workspace_auth_bridge FROM PUBLIC,anon,authenticated,ws_owner,ws_runtime,ws_authz_reader;
GRANT USAGE ON SCHEMA workspace_auth_bridge TO ws_authz_reader;
SET LOCAL ROLE supabase_auth_admin;
CREATE FUNCTION workspace_auth_bridge.session_valid() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 AND coalesce((auth.jwt()->>'exp')::numeric,0)>extract(epoch FROM statement_timestamp())
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=nullif(auth.jwt()->>'session_id','')::uuid
 AND s.user_id=auth.uid() AND s.created_at>statement_timestamp()-interval '7 days'
 AND(s.not_after IS NULL OR s.not_after>statement_timestamp()))
$$;
CREATE FUNCTION workspace_auth_bridge.recent_login() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_auth_bridge.session_valid()
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=nullif(auth.jwt()->>'session_id','')::uuid
 AND s.user_id=auth.uid() AND s.created_at>statement_timestamp()-interval '10 minutes')
$$;
REVOKE ALL ON FUNCTION workspace_auth_bridge.session_valid(),workspace_auth_bridge.recent_login() FROM PUBLIC,anon,authenticated,ws_owner,ws_runtime;
GRANT EXECUTE ON FUNCTION workspace_auth_bridge.session_valid(),workspace_auth_bridge.recent_login() TO ws_authz_reader;
-- Removing the old reader's raw access is part of the same transaction as installing replacement helpers.
REVOKE SELECT(id,user_id,created_at,not_after) ON auth.sessions FROM ws_authz_reader;
DO $$DECLARE f record;g record;BEGIN
 FOR f IN SELECT p.oid,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_auth_bridge'LOOP
 FOR g IN SELECT DISTINCT x.grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=f.oid),acldefault('f',f.proowner)))x WHERE x.grantee<>f.proowner AND x.grantee<>(SELECT oid FROM pg_roles WHERE rolname='ws_authz_reader')LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.oid::regprocedure,CASE WHEN g.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(g.grantee))END);
 END LOOP;END LOOP;
END$$;
RESET ROLE;
SET LOCAL ROLE ws_owner;
GRANT CREATE ON SCHEMA workspace_private TO ws_authz_reader;
RESET ROLE;
SET LOCAL ROLE ws_authz_reader;
CREATE OR REPLACE FUNCTION workspace_private.session_ok() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_auth_bridge.session_valid()
 AND NOT EXISTS(SELECT 1 FROM workspace.revoked_sessions WHERE session_id=nullif(auth.jwt()->>'session_id','')::uuid)
 AND NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE user_id=auth.uid() AND status<>'active')
$$;
ALTER FUNCTION workspace_private.session_ok() OWNER TO ws_authz_reader;
CREATE OR REPLACE FUNCTION workspace_private.recent_login() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_auth_bridge.recent_login() AND workspace_private.session_ok()
$$;
ALTER FUNCTION workspace_private.recent_login() OWNER TO ws_authz_reader;
REVOKE ALL ON FUNCTION workspace_private.session_ok(),workspace_private.recent_login() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.session_ok(),workspace_private.recent_login() TO ws_runtime,ws_authz_reader;

RESET ROLE;
SET LOCAL ROLE ws_owner;
REVOKE CREATE ON SCHEMA workspace_private FROM ws_authz_reader;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['ws_owner','ws_runtime','ws_authz_reader','authenticated','anon'])r WHERE has_any_column_privilege(r,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname='sessions'),'SELECT'))THEN RAISE EXCEPTION 'raw_auth_select_forbidden';END IF;
 IF has_schema_privilege('ws_authz_reader','workspace_private','CREATE')THEN RAISE EXCEPTION 'temporary_schema_create_not_removed';END IF;
END$$;
-- END AUTH INSTALL BOUNDARY
COMMIT;
