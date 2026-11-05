-- LOCAL SYNTHETIC DATABASE ONLY; NOT A HOSTED MIGRATION.
BEGIN;
DO $$ BEGIN IF current_database()<>'school01a' THEN RAISE EXCEPTION 'local_only';END IF;END $$;
SET ROLE ws_owner;
ALTER TABLE workspace.join_requests ADD COLUMN requested_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE workspace.school_memberships ADD COLUMN approved_at timestamptz;
ALTER TABLE workspace.schools ADD CONSTRAINT s02_school_codes UNIQUE(id,office_code,school_code);
CREATE TABLE workspace.s02_directory(
 school_id uuid PRIMARY KEY REFERENCES workspace.schools,office_code text NOT NULL,school_code text NOT NULL,
 school_name text NOT NULL,office_name text NOT NULL,kind text NOT NULL,
 FOREIGN KEY(school_id,office_code,school_code) REFERENCES workspace.schools(id,office_code,school_code),
 CHECK(office_code ~ '^[A-Z][0-9]{2}$'),CHECK(school_code ~ '^[0-9]{7}$'),UNIQUE(office_code,school_code));
ALTER TABLE workspace.s02_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.s02_directory FORCE ROW LEVEL SECURITY;
GRANT SELECT ON workspace.s02_directory TO ws_runtime,ws_authz_reader;
CREATE POLICY directory_read ON workspace.s02_directory FOR SELECT TO ws_runtime,ws_authz_reader USING(workspace_private.session_ok());
CREATE UNIQUE INDEX s02_pending_space ON workspace.first_admin_requests(school_id,actor_id) WHERE state='pending';
GRANT SELECT,INSERT ON workspace.first_admin_requests TO ws_runtime;
CREATE POLICY first_self_select ON workspace.first_admin_requests FOR SELECT TO ws_runtime USING(actor_id=workspace_private.actor() AND workspace_private.session_ok());
CREATE POLICY first_self_insert ON workspace.first_admin_requests FOR INSERT TO ws_runtime WITH CHECK(actor_id=workspace_private.actor() AND state='pending' AND workspace_private.session_ok());
GRANT SELECT ON workspace.first_admin_requests,workspace.join_requests TO ws_authz_reader;
CREATE POLICY first_reader ON workspace.first_admin_requests FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY joins_reader ON workspace.join_requests FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY joins_withdraw ON workspace.join_requests FOR UPDATE TO ws_runtime
 USING(state='pending' AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.school_id=join_requests.school_id AND m.actor_id=workspace_private.actor()))
 WITH CHECK(state='withdrawn' AND workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
RESET ROLE;
CREATE FUNCTION workspace_private.s02_directory(q text,o text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 IF length(q)<2 OR length(q)>60 OR length(o)>3 THEN RAISE EXCEPTION 'invalid_query';END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO v FROM(SELECT d.*,z.state AS space_state FROM workspace.s02_directory d JOIN workspace.schools z ON z.id=d.school_id
 WHERE position(lower(q) IN lower(d.school_name))>0 AND(o='' OR d.office_code=o) ORDER BY d.office_code,d.school_code LIMIT 20)x;RETURN v;END $$;
ALTER FUNCTION workspace_private.s02_directory(text,text) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s02_self() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x.school_id),'[]') INTO v FROM(
 SELECT m.school_id,m.id AS membership_id,m.member_code,m.role,
 CASE WHEN z.state='recovery_locked' THEN 'recovery_locked' WHEN m.status='active' AND m.valid_until<=statement_timestamp() THEN 'expired' ELSE m.status END AS status,
 m.valid_until,m.approved_at,m.version,m.epoch,z.name AS school_name,
 (SELECT jsonb_build_object('id',j.id,'version',j.version,'state',j.state,'requested_role',j.requested_role,'requested_at',j.requested_at) FROM workspace.join_requests j
 WHERE j.school_id=m.school_id AND j.membership_id=m.id AND j.epoch=m.epoch ORDER BY j.requested_at DESC LIMIT 1) AS request
 FROM workspace.school_memberships m JOIN workspace.schools z ON z.id=m.school_id WHERE m.actor_id=workspace_private.actor())x;
 RETURN jsonb_build_object('memberships',v,'space_requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('school_id',f.school_id,'state',f.state,'school_name',z.name,'space_state',z.state)),'[]') FROM workspace.first_admin_requests f JOIN workspace.schools z ON z.id=f.school_id WHERE actor_id=workspace_private.actor()));END $$;
ALTER FUNCTION workspace_private.s02_self() OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s02_admin(s uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN
 PERFORM workspace_private.enter(s,true);
 SELECT jsonb_build_object('members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'member_code',m.member_code,'role',m.role,'status',CASE WHEN m.status='active' AND m.valid_until<=statement_timestamp() THEN 'expired' ELSE m.status END,'version',m.version,'approved_at',m.approved_at,'valid_until',m.valid_until) ORDER BY m.member_code),'[]') FROM workspace.school_memberships m WHERE school_id=s),
 'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',j.id,'member_code',m.member_code,'requested_role',j.requested_role,'version',j.version,'requested_at',j.requested_at) ORDER BY j.requested_at),'[]') FROM workspace.join_requests j JOIN workspace.school_memberships m ON m.school_id=j.school_id AND m.id=j.membership_id WHERE j.school_id=s AND j.state='pending' AND j.epoch=m.epoch)) INTO v;RETURN v;END $$;
ALTER FUNCTION workspace_private.s02_admin(uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s02_unclaimed(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.s02_directory d JOIN workspace.schools z ON z.id=d.school_id WHERE d.school_id=s AND z.state='unclaimed') $$;
ALTER FUNCTION workspace_private.s02_unclaimed(uuid) OWNER TO ws_authz_reader;
REVOKE ALL ON FUNCTION workspace_private.s02_unclaimed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s02_unclaimed(uuid) TO ws_runtime;
CREATE FUNCTION workspace_private.s02_space(s uuid,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;j uuid;BEGIN
 IF NOT workspace_private.session_ok() OR workspace_private.actor() IS NULL THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('school01a:'||s::text,0));
 IF NOT workspace_private.s02_unclaimed(s) THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 v:=workspace_private.receipt(s,r,'s02_space','{}');IF v IS NOT NULL THEN RETURN v;END IF;
 IF EXISTS(SELECT 1 FROM workspace.first_admin_requests WHERE school_id=s AND actor_id=workspace_private.actor() AND state='pending') THEN RAISE EXCEPTION 'duplicate_request';END IF;
 INSERT INTO workspace.first_admin_requests(school_id,actor_id,case_ref,state) VALUES(s,workspace_private.actor(),r,'pending') RETURNING id INTO j;
 RETURN workspace_private.finish(s,r,'s02_space','{}',jsonb_build_object('pending',true),j);END $$;
ALTER FUNCTION workspace_private.s02_space(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s02_withdraw(s uuid,j uuid,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE q workspace.join_requests;m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(j,ev);BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('school01a:'||s::text,0));
 v:=workspace_private.receipt(s,r,'s02_withdraw',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO q FROM workspace.join_requests WHERE school_id=s AND id=j;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND id=q.membership_id AND actor_id=workspace_private.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;
 IF q.state<>'pending' OR q.version<>ev OR m.status<>'pending' OR m.epoch<>q.epoch THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.join_requests SET state='withdrawn',version=version+1 WHERE id=j;
 UPDATE workspace.school_memberships SET status='left',version=version+1 WHERE id=m.id;
 UPDATE workspace.membership_terms SET ended_at=clock_timestamp() WHERE school_id=s AND membership_id=m.id AND epoch=m.epoch;
 RETURN workspace_private.finish(s,r,'s02_withdraw',p,jsonb_build_object('withdrawn',true),j);END $$;
ALTER FUNCTION workspace_private.s02_withdraw(uuid,uuid,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s02_expiry(s uuid,mid uuid,until_at timestamptz,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(mid,until_at,ev);BEGIN
 PERFORM workspace_private.enter(s,true);IF NOT workspace_private.recent_login() THEN RAISE EXCEPTION 'reauth_required';END IF;
 v:=workspace_private.receipt(s,r,'s02_expiry',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND id=mid;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 IF m.role<>'HEALTH_ASSISTANT' OR m.status NOT IN('active','suspended') OR m.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 IF until_at IS NULL OR until_at<=statement_timestamp() THEN RAISE EXCEPTION 'invalid_expiry';END IF;
 UPDATE workspace.school_memberships SET valid_until=until_at,version=version+1 WHERE id=mid;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role) VALUES(s,mid,m.epoch,workspace_private.actor(),'s02_expiry',m.role,m.role);
 PERFORM workspace_private.bump(s);RETURN workspace_private.finish(s,r,'s02_expiry',p,jsonb_build_object('version',m.version+1),mid);END $$;
ALTER FUNCTION workspace_private.s02_expiry(uuid,uuid,timestamptz,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s02_transfers(s uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN PERFORM workspace_private.enter(s);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'mode',t.mode,'state',t.state,'expires_at',t.expires_at,'to_code',m.member_code,'can_accept',m.actor_id=workspace_private.actor())),'[]') INTO v
 FROM workspace.admin_transfers t JOIN workspace.school_memberships m ON m.school_id=t.school_id AND m.id=t.to_id
 WHERE t.school_id=s AND t.state='proposed' AND t.expires_at>statement_timestamp() AND(workspace_private.admin(s) OR m.actor_id=workspace_private.actor());RETURN v;END $$;
ALTER FUNCTION workspace_private.s02_transfers(uuid) OWNER TO ws_runtime;
-- Keep the original public join contract, but require the trusted local directory.
-- The original A command still owns epoch/idempotency/audit semantics.
CREATE FUNCTION workspace_private.s02_request_join(s uuid,requested text,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.s02_directory WHERE school_id=s) THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 RETURN workspace_private.request_join(s,requested,r);END $$;
ALTER FUNCTION workspace_private.s02_request_join(uuid,text,uuid) OWNER TO ws_runtime;
REVOKE ALL ON FUNCTION workspace_private.s02_request_join(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_request_join(uuid,text,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION workspace_private.request_join(uuid,text,uuid) FROM authenticated;
CREATE OR REPLACE FUNCTION public.ws_v1_request_join(p_school_id uuid,p_requested_role text,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.s02_request_join(p_school_id,p_requested_role,p_request_id) $$;
-- Persist actual approval timestamp, using invoker trigger under the existing checked runtime command.
CREATE FUNCTION workspace_private.s02_approval_time() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF OLD.status='pending' AND NEW.status='active' THEN NEW.approved_at:=clock_timestamp();END IF;RETURN NEW;END $$;
ALTER FUNCTION workspace_private.s02_approval_time() OWNER TO ws_owner;
CREATE TRIGGER s02_approval_time BEFORE UPDATE ON workspace.school_memberships FOR EACH ROW EXECUTE FUNCTION workspace_private.s02_approval_time();
-- Invoker public wrappers; explicit narrow ACLs, no table grants to end-user roles.
REVOKE ALL ON FUNCTION workspace_private.s02_directory(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_directory(text,text) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_directory(q text,o text) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_directory(q,o) $$;
ALTER FUNCTION public.ws_s02_directory(text,text) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_directory(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_directory(text,text) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_self() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_self() TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_self() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_self() $$;
ALTER FUNCTION public.ws_s02_self() OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_self() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_self() TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_admin(uuid) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_admin(s uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_admin(s) $$;
ALTER FUNCTION public.ws_s02_admin(uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_space(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_space(uuid,uuid) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_space(s uuid,r uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_space(s,r) $$;
ALTER FUNCTION public.ws_s02_space(uuid,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_space(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_space(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_withdraw(uuid,uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_withdraw(uuid,uuid,bigint,uuid) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_withdraw(s uuid,j uuid,ev bigint,r uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_withdraw(s,j,ev,r) $$;
ALTER FUNCTION public.ws_s02_withdraw(uuid,uuid,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_withdraw(uuid,uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_withdraw(uuid,uuid,bigint,uuid) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_expiry(uuid,uuid,timestamptz,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_expiry(uuid,uuid,timestamptz,bigint,uuid) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_expiry(s uuid,mid uuid,until_at timestamptz,ev bigint,r uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_expiry(s,mid,until_at,ev,r) $$;
ALTER FUNCTION public.ws_s02_expiry(uuid,uuid,timestamptz,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_expiry(uuid,uuid,timestamptz,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_expiry(uuid,uuid,timestamptz,bigint,uuid) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_transfers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION workspace_private.s02_transfers(uuid) TO authenticated,ws_runtime;
CREATE FUNCTION public.ws_s02_transfers(s uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s02_transfers(s) $$;
ALTER FUNCTION public.ws_s02_transfers(uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_s02_transfers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_s02_transfers(uuid) TO authenticated;
REVOKE ALL ON FUNCTION workspace_private.s02_approval_time() FROM PUBLIC,anon,authenticated;
COMMIT;
