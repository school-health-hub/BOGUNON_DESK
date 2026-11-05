-- LOCAL SCHOOL-01C extension only. Original SCHOOL-01A migration remains byte-identical.
BEGIN;
DO $$ BEGIN IF current_database()<>'school01a' THEN RAISE EXCEPTION 'synthetic_database_required'; END IF; END $$;
CREATE FUNCTION workspace_private.c_membership_status(s uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE m workspace.school_memberships;z text;st text;
BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('school01a:'||s::text,0));
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF NOT FOUND THEN RETURN jsonb_build_object('status','access_denied'); END IF;
 SELECT state INTO z FROM workspace.schools WHERE id=s;
 st:=CASE WHEN z='recovery_locked' THEN 'recovery_locked' WHEN z<>'active' THEN 'access_denied'
 WHEN m.status='pending' THEN 'pending' WHEN m.status='suspended' THEN 'suspended'
 WHEN m.status='expired' OR(m.valid_until IS NOT NULL AND m.valid_until<=statement_timestamp()) THEN 'expired_membership'
 WHEN m.status<>'active' OR m.valid_from>statement_timestamp() THEN 'access_denied'
 WHEN workspace_private.member_role(s) IS NULL THEN 'recovery_locked' ELSE 'active' END;
 RETURN jsonb_build_object('status',st);
END $$;
ALTER FUNCTION workspace_private.c_membership_status(uuid) OWNER TO ws_authz_reader;
REVOKE ALL ON FUNCTION workspace_private.c_membership_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.c_membership_status(uuid) TO authenticated;
CREATE FUNCTION public.ws_c_membership_status(p_school_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.c_membership_status(p_school_id) $$;
ALTER FUNCTION public.ws_c_membership_status(uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_c_membership_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_c_membership_status(uuid) TO authenticated;
COMMIT;
