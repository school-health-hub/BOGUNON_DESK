-- LOCAL DESIGN PROTOTYPE. Requires an Auth-owned, non-exposed boolean bridge.
-- No client or Workspace execution role receives auth.sessions SELECT.
CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;
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
