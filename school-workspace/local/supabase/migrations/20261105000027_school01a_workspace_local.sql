-- SCHOOL-01A LOCAL SYNTHETIC PROTOTYPE ONLY; not an approved production migration.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'school01a' THEN RAISE EXCEPTION 'synthetic_database_required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='workspace') THEN RAISE EXCEPTION 'namespace_collision'; END IF;
END $$;
CREATE ROLE ws_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_runtime NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_authz_reader NOLOGIN NOBYPASSRLS;
CREATE SCHEMA workspace AUTHORIZATION ws_owner;
CREATE SCHEMA workspace_private AUTHORIZATION ws_owner;
REVOKE ALL ON SCHEMA workspace,workspace_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA workspace,workspace_private,auth TO ws_runtime,ws_authz_reader;
GRANT USAGE ON SCHEMA workspace_private TO authenticated;
GRANT USAGE ON SCHEMA auth TO ws_owner;
GRANT REFERENCES(id) ON auth.users TO ws_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO ws_runtime,ws_authz_reader;
GRANT SELECT(id,user_id,created_at,not_after) ON auth.sessions TO ws_authz_reader;
-- Ownership is separate from both execution roles. FORCE RLS also applies to owner.
SET ROLE ws_owner;
CREATE TABLE workspace.accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),version bigint NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE workspace.schools(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text NOT NULL DEFAULT 'NEIS' CHECK(source='NEIS'),
 office_code text NOT NULL CHECK(office_code ~ '^[A-Z][0-9]{2}$'),school_code text NOT NULL CHECK(school_code ~ '^[0-9]{7}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 150),state text NOT NULL CHECK(state IN ('unclaimed','active','recovery_locked','closed')),
 authz_version bigint NOT NULL DEFAULT 1,UNIQUE(source,office_code,school_code));
CREATE TABLE workspace.school_memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES workspace.schools,
 actor_id uuid NOT NULL REFERENCES workspace.accounts,member_code text NOT NULL,
 role text CHECK(role IN ('SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT')),
 status text NOT NULL CHECK(status IN ('pending','active','rejected','suspended','expired','left','revoked')),
 valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),valid_until timestamptz,
 epoch integer NOT NULL DEFAULT 1 CHECK(epoch>0),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(valid_until IS NULL OR valid_until>valid_from),CHECK((status='pending' AND role IS NULL) OR status<>'pending'),
 CHECK(status<>'active' OR role IS NOT NULL),UNIQUE(school_id,actor_id),UNIQUE(school_id,id),UNIQUE(school_id,member_code));
CREATE TABLE workspace.membership_terms(
 school_id uuid NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL CHECK(epoch>0),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),ended_at timestamptz,
 PRIMARY KEY(school_id,membership_id,epoch), FOREIGN KEY(school_id,membership_id) REFERENCES workspace.school_memberships(school_id,id));
ALTER TABLE workspace.school_memberships ADD CONSTRAINT current_term FOREIGN KEY(school_id,id,epoch)
 REFERENCES workspace.membership_terms(school_id,membership_id,epoch) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE workspace.join_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL, membership_id uuid NOT NULL, epoch integer NOT NULL,
 requested_role text NOT NULL CHECK(requested_role IN ('HEALTH_TEACHER','HEALTH_ASSISTANT')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','withdrawn')),
 version bigint NOT NULL DEFAULT 1,reviewer_id uuid,
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms,
 FOREIGN KEY(school_id,reviewer_id) REFERENCES workspace.school_memberships(school_id,id));
CREATE UNIQUE INDEX one_pending_join ON workspace.join_requests(school_id,membership_id) WHERE state='pending';
CREATE TABLE workspace.first_admin_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 actor_id uuid NOT NULL REFERENCES workspace.accounts,case_ref uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','verified','rejected')),version bigint NOT NULL DEFAULT 1);
CREATE TABLE workspace.role_permission_defaults(
 role text NOT NULL CHECK(role IN ('SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT')),
 permission text NOT NULL,scope text NOT NULL CHECK(scope IN ('school','assigned','targeted','own')),PRIMARY KEY(role,permission));
INSERT INTO workspace.role_permission_defaults VALUES
 ('SCHOOL_ADMIN','membership.manage','school'),('SCHOOL_ADMIN','admin.transfer','school'),('SCHOOL_ADMIN','task.read','school'),
 ('SCHOOL_ADMIN','audit.read','school'),('HEALTH_TEACHER','task.read','school'),('HEALTH_TEACHER','handover.create','school'),
 ('HEALTH_ASSISTANT','task.read','school'),('HEALTH_ASSISTANT','task.change_status','assigned');
CREATE TABLE workspace.membership_permission_overrides(
 school_id uuid NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,permission text NOT NULL,
 effect text NOT NULL CHECK(effect IN ('allow','deny')),scope text NOT NULL CHECK(scope IN ('school','assigned','targeted','own')),
 PRIMARY KEY(school_id,membership_id,epoch,permission),FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms,
 CHECK(permission IN ('task.read','handover.create')),CHECK(permission<>'handover.create' OR scope='school'));
CREATE TABLE workspace.role_change_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,
 actor_id uuid NOT NULL REFERENCES workspace.accounts,action text NOT NULL,old_role text,new_role text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.audit_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid REFERENCES workspace.schools,actor_id uuid NOT NULL REFERENCES workspace.accounts,
 action text NOT NULL,request_id uuid NOT NULL,entity_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE workspace.command_receipts(
 actor_id uuid NOT NULL REFERENCES workspace.accounts,request_id uuid NOT NULL,school_id uuid REFERENCES workspace.schools,
 command text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,request_id));
CREATE TABLE workspace.admin_transfers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL,from_id uuid NOT NULL,to_id uuid NOT NULL,to_epoch integer NOT NULL,
 mode text NOT NULL CHECK(mode IN ('add','transfer')),state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','completed','expired')),
 expires_at timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '24 hours'),version bigint NOT NULL DEFAULT 1,
 CHECK(from_id<>to_id),FOREIGN KEY(school_id,from_id) REFERENCES workspace.school_memberships(school_id,id),
 FOREIGN KEY(school_id,to_id,to_epoch) REFERENCES workspace.membership_terms,UNIQUE(school_id,id));
CREATE TABLE workspace.revoked_sessions(session_id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES workspace.accounts,revoked_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX member_lookup ON workspace.school_memberships(actor_id,school_id,status);
CREATE INDEX member_admin ON workspace.school_memberships(school_id,role,status);
CREATE INDEX audit_school ON workspace.audit_entries(school_id,created_at,id);
RESET ROLE;
-- These helpers read only authorization metadata, not workspace content.
CREATE FUNCTION workspace_private.actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
 $$ SELECT id FROM workspace.accounts WHERE user_id=auth.uid() $$;
ALTER FUNCTION workspace_private.actor() OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.session_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean,false)=false
 AND COALESCE((auth.jwt()->>'exp')::numeric,0)>extract(epoch FROM statement_timestamp())
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=NULLIF(auth.jwt()->>'session_id','')::uuid AND s.user_id=auth.uid()
 AND s.created_at>statement_timestamp()-interval '7 days' AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
 AND NOT EXISTS(SELECT 1 FROM workspace.revoked_sessions WHERE session_id=NULLIF(auth.jwt()->>'session_id','')::uuid)
 AND NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE user_id=auth.uid() AND status<>'active')
 AND auth.uid() IS NOT NULL
 $$;
ALTER FUNCTION workspace_private.session_ok() OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.member_role(s uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.role FROM workspace.school_memberships m JOIN workspace.accounts a ON a.id=m.actor_id
 JOIN workspace.schools z ON z.id=m.school_id WHERE m.school_id=s AND a.user_id=auth.uid() AND a.status='active'
 AND z.state='active' AND m.status='active' AND m.valid_from<=statement_timestamp() AND (m.valid_until IS NULL OR m.valid_until>statement_timestamp())
 AND workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.school_memberships ad JOIN workspace.accounts aa ON aa.id=ad.actor_id
 WHERE ad.school_id=s AND ad.role='SCHOOL_ADMIN' AND ad.status='active' AND aa.status='active' AND aa.user_id IS NOT NULL
 AND ad.valid_from<=statement_timestamp() AND(ad.valid_until IS NULL OR ad.valid_until>statement_timestamp()))
 $$;
ALTER FUNCTION workspace_private.member_role(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.allowed(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS
 $$ SELECT workspace_private.member_role(s) IS NOT NULL $$;
ALTER FUNCTION workspace_private.allowed(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.admin(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS
 $$ SELECT COALESCE(workspace_private.member_role(s)='SCHOOL_ADMIN',false) $$;
ALTER FUNCTION workspace_private.admin(uuid) OWNER TO ws_authz_reader;
-- All tables protected, including non-exposed ones. Reader policy avoids recursive membership policy lookup.
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['accounts','schools','school_memberships','membership_terms','join_requests','first_admin_requests',
 'role_permission_defaults','membership_permission_overrides','role_change_history','audit_entries','command_receipts','admin_transfers','revoked_sessions'] LOOP
 EXECUTE format('ALTER TABLE workspace.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE workspace.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['accounts','schools','school_memberships','revoked_sessions'] LOOP
 EXECUTE format('GRANT SELECT ON workspace.%I TO ws_authz_reader',t);
 EXECUTE format('CREATE POLICY authz_read ON workspace.%I FOR SELECT TO ws_authz_reader USING (true)',t);
 END LOOP;
END $rls$;
-- Client roles have no raw table privileges; only runtime functions can get this role.
GRANT SELECT,INSERT ON workspace.accounts TO ws_runtime;
CREATE POLICY accounts_read ON workspace.accounts FOR SELECT TO ws_runtime USING(user_id=auth.uid() AND workspace_private.session_ok());
CREATE POLICY accounts_insert ON workspace.accounts FOR INSERT TO ws_runtime WITH CHECK(user_id=auth.uid() AND status='active' AND workspace_private.session_ok());
GRANT SELECT,UPDATE ON workspace.schools TO ws_runtime;
CREATE POLICY schools_read ON workspace.schools FOR SELECT TO ws_runtime USING(workspace_private.allowed(id));
CREATE POLICY schools_update ON workspace.schools FOR UPDATE TO ws_runtime USING(workspace_private.allowed(id)) WITH CHECK(workspace_private.allowed(id));
GRANT SELECT,INSERT,UPDATE ON workspace.school_memberships TO ws_runtime;
CREATE POLICY memberships_read ON workspace.school_memberships FOR SELECT TO ws_runtime USING(actor_id=workspace_private.actor() OR workspace_private.allowed(school_id));
CREATE POLICY memberships_insert ON workspace.school_memberships FOR INSERT TO ws_runtime WITH CHECK(workspace_private.session_ok() AND actor_id=workspace_private.actor() AND role IS NULL AND status='pending');
CREATE POLICY memberships_update ON workspace.school_memberships FOR UPDATE TO ws_runtime
 USING(actor_id=workspace_private.actor() OR workspace_private.admin(school_id))
 WITH CHECK(workspace_private.session_ok() AND (workspace_private.admin(school_id) OR (actor_id=workspace_private.actor() AND status IN ('left','pending'))));
GRANT SELECT,INSERT,UPDATE ON workspace.membership_terms TO ws_runtime;
CREATE POLICY terms_read ON workspace.membership_terms FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id) OR EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
CREATE POLICY terms_write ON workspace.membership_terms FOR INSERT TO ws_runtime WITH CHECK(workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
CREATE POLICY terms_update ON workspace.membership_terms FOR UPDATE TO ws_runtime USING(workspace_private.admin(school_id) OR EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
GRANT SELECT,INSERT,UPDATE ON workspace.join_requests TO ws_runtime;
CREATE POLICY joins_read ON workspace.join_requests FOR SELECT TO ws_runtime USING(workspace_private.admin(school_id) OR EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
CREATE POLICY joins_insert ON workspace.join_requests FOR INSERT TO ws_runtime WITH CHECK(state='pending' AND workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.id=membership_id AND m.actor_id=workspace_private.actor()));
CREATE POLICY joins_update ON workspace.join_requests FOR UPDATE TO ws_runtime USING(workspace_private.admin(school_id)) WITH CHECK(workspace_private.admin(school_id));
GRANT SELECT ON workspace.membership_permission_overrides,workspace.role_permission_defaults TO ws_runtime;
CREATE POLICY overrides_read ON workspace.membership_permission_overrides FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY defaults_read ON workspace.role_permission_defaults FOR SELECT TO ws_runtime USING(workspace_private.session_ok());
GRANT SELECT,INSERT ON workspace.role_change_history,workspace.audit_entries TO ws_runtime;
CREATE POLICY history_read ON workspace.role_change_history FOR SELECT TO ws_runtime USING(workspace_private.admin(school_id));
CREATE POLICY history_insert ON workspace.role_change_history FOR INSERT TO ws_runtime WITH CHECK(actor_id=workspace_private.actor() AND workspace_private.session_ok());
CREATE POLICY audit_read ON workspace.audit_entries FOR SELECT TO ws_runtime USING(workspace_private.admin(school_id));
CREATE POLICY audit_insert ON workspace.audit_entries FOR INSERT TO ws_runtime WITH CHECK(actor_id=workspace_private.actor() AND workspace_private.session_ok());
GRANT SELECT,INSERT ON workspace.command_receipts TO ws_runtime;
CREATE POLICY receipts_read ON workspace.command_receipts FOR SELECT TO ws_runtime USING(actor_id=workspace_private.actor() AND workspace_private.session_ok());
CREATE POLICY receipts_insert ON workspace.command_receipts FOR INSERT TO ws_runtime WITH CHECK(actor_id=workspace_private.actor() AND workspace_private.session_ok());
GRANT SELECT,INSERT,UPDATE ON workspace.admin_transfers TO ws_runtime;
CREATE POLICY transfers_read ON workspace.admin_transfers FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY transfers_insert ON workspace.admin_transfers FOR INSERT TO ws_runtime WITH CHECK(workspace_private.admin(school_id));
CREATE POLICY transfers_update ON workspace.admin_transfers FOR UPDATE TO ws_runtime USING(workspace_private.allowed(school_id)) WITH CHECK(workspace_private.allowed(school_id));
GRANT INSERT ON workspace.revoked_sessions TO ws_runtime;
CREATE POLICY revoked_insert ON workspace.revoked_sessions FOR INSERT TO ws_runtime WITH CHECK(actor_id=workspace_private.actor() AND session_id=NULLIF(auth.jwt()->>'session_id','')::uuid);
CREATE FUNCTION workspace_private.school_open(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
 $$ SELECT workspace_private.session_ok() AND EXISTS(SELECT 1 FROM workspace.schools WHERE id=s AND state='active') $$;
ALTER FUNCTION workspace_private.school_open(uuid) OWNER TO ws_authz_reader;
GRANT SELECT ON workspace.admin_transfers TO ws_authz_reader;
CREATE POLICY transfer_authz_read ON workspace.admin_transfers FOR SELECT TO ws_authz_reader USING(true);
CREATE FUNCTION workspace_private.promotion_allowed(s uuid,mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.admin_transfers t JOIN workspace.school_memberships m ON m.id=t.to_id
 JOIN workspace.school_memberships f ON f.id=t.from_id JOIN workspace.accounts a ON a.id=f.actor_id
 WHERE t.school_id=s AND t.to_id=mid AND m.actor_id=workspace_private.actor() AND t.to_epoch=m.epoch
 AND t.state='proposed' AND t.expires_at>statement_timestamp() AND f.role='SCHOOL_ADMIN' AND f.status='active'
 AND a.status='active' AND f.valid_from<=statement_timestamp() AND(f.valid_until IS NULL OR f.valid_until>statement_timestamp()))
 $$;
ALTER FUNCTION workspace_private.promotion_allowed(uuid,uuid) OWNER TO ws_authz_reader;
DROP POLICY memberships_update ON workspace.school_memberships;
CREATE POLICY memberships_update ON workspace.school_memberships FOR UPDATE TO ws_runtime
 USING(actor_id=workspace_private.actor() OR workspace_private.admin(school_id))
 WITH CHECK(workspace_private.session_ok() AND(workspace_private.admin(school_id)
 OR(actor_id=workspace_private.actor() AND status IN ('left','pending'))
 OR(actor_id=workspace_private.actor() AND role='SCHOOL_ADMIN' AND workspace_private.promotion_allowed(school_id,id))));
CREATE FUNCTION workspace_private.recent_login() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id=NULLIF(auth.jwt()->>'session_id','')::uuid AND user_id=auth.uid()
 AND created_at>statement_timestamp()-interval '10 minutes') AND workspace_private.session_ok() $$;
ALTER FUNCTION workspace_private.recent_login() OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.immutable_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NEW.id<>OLD.id OR NEW.school_id<>OLD.school_id OR NEW.actor_id<>OLD.actor_id THEN RAISE EXCEPTION 'immutable_identity'; END IF;
 RETURN NEW; END $$;
ALTER FUNCTION workspace_private.immutable_identity() OWNER TO ws_owner;
CREATE TRIGGER memberships_identity BEFORE UPDATE ON workspace.school_memberships FOR EACH ROW EXECUTE FUNCTION workspace_private.immutable_identity();
-- Advisory locks serialize each school's commands, including readers. No runtime may SET ROLE ws_owner/reader.
CREATE FUNCTION workspace_private.enter(s uuid,need_admin boolean DEFAULT false) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('school01a:'||s::text,0));
 IF NOT workspace_private.allowed(s) THEN RAISE EXCEPTION 'access_denied'; END IF;
 IF need_admin AND NOT workspace_private.admin(s) THEN RAISE EXCEPTION 'admin_required'; END IF;
 END $$;
ALTER FUNCTION workspace_private.enter(uuid,boolean) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.receipt(s uuid,r uuid,c text,p jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 DECLARE x workspace.command_receipts; BEGIN
 IF r IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('request:'||workspace_private.actor()::text||r::text,0));
 SELECT * INTO x FROM workspace.command_receipts WHERE actor_id=workspace_private.actor() AND request_id=r;
 IF FOUND THEN
 IF x.school_id IS DISTINCT FROM s OR x.command<>c OR x.payload<>p THEN RAISE EXCEPTION 'idempotency_mismatch'; END IF;
 IF x.created_at<statement_timestamp()-interval '7 days' THEN RAISE EXCEPTION 'receipt_expired'; END IF;
 RETURN x.result; END IF; RETURN NULL; END $$;
ALTER FUNCTION workspace_private.receipt(uuid,uuid,text,jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.finish(s uuid,r uuid,c text,p jsonb,v jsonb,e uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 INSERT INTO workspace.audit_entries(school_id,actor_id,action,request_id,entity_id) VALUES(s,workspace_private.actor(),c,r,e);
 INSERT INTO workspace.command_receipts(actor_id,request_id,school_id,command,payload,result) VALUES(workspace_private.actor(),r,s,c,p,v);
 RETURN v; END $$;
ALTER FUNCTION workspace_private.finish(uuid,uuid,text,jsonb,jsonb,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.bump(s uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
 $$ UPDATE workspace.schools SET authz_version=authz_version+1 WHERE id=s $$;
ALTER FUNCTION workspace_private.bump(uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.guard_last(s uuid,mid uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM workspace.school_memberships WHERE id=mid AND school_id=s AND role='SCHOOL_ADMIN' AND status='active')
 AND NOT EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.accounts a ON a.id=m.actor_id WHERE m.school_id=s AND m.id<>mid
 AND m.role='SCHOOL_ADMIN' AND m.status='active' AND a.status='active' AND m.valid_from<=statement_timestamp()
 AND(m.valid_until IS NULL OR m.valid_until>statement_timestamp())) THEN RAISE EXCEPTION 'last_admin'; END IF; END $$;
ALTER FUNCTION workspace_private.guard_last(uuid,uuid) OWNER TO ws_runtime;
-- guard_last needs account status of other admins; use a bool/count metadata helper instead of broad accounts grants.
CREATE FUNCTION workspace_private.other_admin(s uuid,mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.accounts a ON a.id=m.actor_id WHERE m.school_id=s AND m.id<>mid
 AND m.role='SCHOOL_ADMIN' AND m.status='active' AND a.status='active' AND a.user_id IS NOT NULL AND m.valid_from<=statement_timestamp()
 AND(m.valid_until IS NULL OR m.valid_until>statement_timestamp())) $$;
ALTER FUNCTION workspace_private.other_admin(uuid,uuid) OWNER TO ws_authz_reader;
CREATE OR REPLACE FUNCTION workspace_private.guard_last(s uuid,mid uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM workspace.school_memberships WHERE id=mid AND school_id=s AND role='SCHOOL_ADMIN' AND status='active')
 AND NOT workspace_private.other_admin(s,mid) THEN RAISE EXCEPTION 'last_admin'; END IF; END $$;
-- Purpose implementations are definer only to enter a non-owner NOBYPASSRLS runtime role.
CREATE FUNCTION workspace_private.bootstrap() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE a uuid; BEGIN
 IF NOT workspace_private.session_ok() THEN RAISE EXCEPTION 'unauthenticated_or_revoked'; END IF;
 INSERT INTO workspace.accounts(user_id) VALUES(auth.uid()) ON CONFLICT(user_id) DO NOTHING;
 a:=workspace_private.actor();
 INSERT INTO workspace.audit_entries(actor_id,action,request_id) VALUES(a,'bootstrap',gen_random_uuid());
 RETURN jsonb_build_object('actor_id',a); END $$;
ALTER FUNCTION workspace_private.bootstrap() OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.get_context(s uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE v jsonb; BEGIN
 PERFORM workspace_private.enter(s);
 SELECT jsonb_build_object('school_id',s,'role',m.role,'member_code',m.member_code,'epoch',m.epoch,'version',m.version,
 'permissions',(SELECT COALESCE(jsonb_agg(p.permission ORDER BY p.permission),'[]') FROM(
 SELECT permission FROM workspace.role_permission_defaults WHERE role=m.role
 UNION SELECT permission FROM workspace.membership_permission_overrides WHERE membership_id=m.id AND epoch=m.epoch AND effect='allow'
 EXCEPT SELECT permission FROM workspace.membership_permission_overrides WHERE membership_id=m.id AND epoch=m.epoch AND effect='deny')p))
 INTO v FROM workspace.school_memberships m WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.audit_entries(school_id,actor_id,action,request_id) VALUES(s,workspace_private.actor(),'get_context',gen_random_uuid());
 RETURN v; END $$;
ALTER FUNCTION workspace_private.get_context(uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.request_join(s uuid,requested text,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE m workspace.school_memberships; j uuid;v jsonb;p jsonb:=jsonb_build_object('role',requested); BEGIN
 IF NOT workspace_private.session_ok() OR workspace_private.actor() IS NULL THEN RAISE EXCEPTION 'unauthenticated_or_revoked'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('school01a:'||s::text,0));
 IF NOT workspace_private.school_open(s) THEN RAISE EXCEPTION 'not_found_or_denied'; END IF;
 IF requested NOT IN('HEALTH_TEACHER','HEALTH_ASSISTANT') OR requested IS NULL THEN RAISE EXCEPTION 'invalid_role'; END IF;
 v:=workspace_private.receipt(s,r,'request_join',p);IF v IS NOT NULL THEN RETURN v; END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF FOUND THEN
 IF m.status IN('active','pending','suspended') THEN RAISE EXCEPTION 'membership_not_rejoinable'; END IF;
 UPDATE workspace.membership_terms SET ended_at=clock_timestamp() WHERE school_id=s AND membership_id=m.id AND epoch=m.epoch;
 UPDATE workspace.school_memberships SET status='pending',role=NULL,epoch=epoch+1,version=version+1,valid_from=clock_timestamp(),valid_until=NULL WHERE id=m.id RETURNING * INTO m;
 ELSE
 INSERT INTO workspace.school_memberships(school_id,actor_id,member_code,status) VALUES(s,workspace_private.actor(),'M-'||replace(gen_random_uuid()::text,'-',''),'pending') RETURNING * INTO m;
 END IF;
 INSERT INTO workspace.membership_terms(school_id,membership_id,epoch) VALUES(s,m.id,m.epoch);
 INSERT INTO workspace.join_requests(school_id,membership_id,epoch,requested_role) VALUES(s,m.id,m.epoch,requested) RETURNING id INTO j;
 RETURN workspace_private.finish(s,r,'request_join',p,jsonb_build_object('join_request_id',j,'membership_id',m.id,'epoch',m.epoch),j);END $$;
ALTER FUNCTION workspace_private.request_join(uuid,text,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.decide_join(s uuid,j uuid,decision text,new_role text,until_at timestamptz,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE q workspace.join_requests;m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(j,decision,new_role,until_at,ev);BEGIN
 PERFORM workspace_private.enter(s,true);
 v:=workspace_private.receipt(s,r,'decide_join',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO q FROM workspace.join_requests WHERE id=j AND school_id=s;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE id=q.membership_id AND school_id=s;
 IF m.actor_id=workspace_private.actor() THEN RAISE EXCEPTION 'self_approval';END IF;
 IF q.version<>ev OR q.state<>'pending' OR m.status<>'pending' OR q.epoch<>m.epoch THEN RAISE EXCEPTION 'conflict';END IF;
 IF decision NOT IN('approve','reject') OR decision IS NULL THEN RAISE EXCEPTION 'invalid_decision';END IF;
 IF decision='approve' AND(new_role IS NULL OR new_role NOT IN('HEALTH_TEACHER','HEALTH_ASSISTANT')) THEN RAISE EXCEPTION 'invalid_role';END IF;
 IF decision='approve' AND new_role='HEALTH_ASSISTANT' AND until_at IS NULL THEN RAISE EXCEPTION 'assistant_end_required';END IF;
 IF until_at IS NOT NULL AND until_at<=statement_timestamp() THEN RAISE EXCEPTION 'invalid_expiry';END IF;
 UPDATE workspace.school_memberships SET status=CASE WHEN decision='approve' THEN 'active' ELSE 'rejected' END,
 role=CASE WHEN decision='approve' THEN new_role ELSE NULL END,valid_until=until_at,version=version+1 WHERE id=m.id;
 UPDATE workspace.join_requests SET state=CASE WHEN decision='approve' THEN 'approved' ELSE 'rejected' END,version=version+1,
 reviewer_id=(SELECT id FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor()) WHERE id=j;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 VALUES(s,m.id,m.epoch,workspace_private.actor(),'decide_join',NULL,CASE WHEN decision='approve' THEN new_role ELSE NULL END);
 PERFORM workspace_private.bump(s);
 RETURN workspace_private.finish(s,r,'decide_join',p,jsonb_build_object('approved',decision='approve'),j);END $$;
ALTER FUNCTION workspace_private.decide_join(uuid,uuid,text,text,timestamptz,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.set_member_role(s uuid,mid uuid,new_role text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(mid,new_role,ev);BEGIN
 PERFORM workspace_private.enter(s,true);
 IF NOT workspace_private.recent_login() THEN RAISE EXCEPTION 'reauth_required';END IF;
 v:=workspace_private.receipt(s,r,'set_member_role',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND id=mid;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 IF m.version<>ev OR m.status<>'active' THEN RAISE EXCEPTION 'conflict';END IF;
 IF new_role IS NULL OR new_role NOT IN('HEALTH_TEACHER','HEALTH_ASSISTANT') THEN RAISE EXCEPTION 'admin_promotion_requires_transfer';END IF;
 IF new_role='HEALTH_ASSISTANT' AND m.valid_until IS NULL THEN RAISE EXCEPTION 'assistant_end_required';END IF;
 IF m.role='SCHOOL_ADMIN' THEN PERFORM workspace_private.guard_last(s,mid);END IF;
 UPDATE workspace.school_memberships SET role=new_role,version=version+1 WHERE id=mid;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 VALUES(s,mid,m.epoch,workspace_private.actor(),'set_member_role',m.role,new_role);
 PERFORM workspace_private.bump(s);
 RETURN workspace_private.finish(s,r,'set_member_role',p,jsonb_build_object('version',m.version+1),mid);END $$;
ALTER FUNCTION workspace_private.set_member_role(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.set_membership_state(s uuid,mid uuid,new_state text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(mid,new_state,ev);BEGIN
 PERFORM workspace_private.enter(s,true);
 v:=workspace_private.receipt(s,r,'set_membership_state',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND id=mid;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 IF m.version<>ev OR m.status NOT IN('active','suspended') THEN RAISE EXCEPTION 'conflict';END IF;
 IF new_state IS NULL OR new_state NOT IN('active','suspended','revoked') THEN RAISE EXCEPTION 'invalid_state';END IF;
 IF new_state='active' AND(m.valid_until IS NOT NULL AND m.valid_until<=statement_timestamp()) THEN RAISE EXCEPTION 'expired';END IF;
 IF new_state<>'active' THEN PERFORM workspace_private.guard_last(s,mid);END IF;
 UPDATE workspace.school_memberships SET status=new_state,version=version+1 WHERE id=mid;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 VALUES(s,mid,m.epoch,workspace_private.actor(),'state:'||new_state,m.role,m.role);
 PERFORM workspace_private.bump(s);
 RETURN workspace_private.finish(s,r,'set_membership_state',p,jsonb_build_object('version',m.version+1),mid);END $$;
ALTER FUNCTION workspace_private.set_membership_state(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.leave_school(s uuid,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(ev);BEGIN
 PERFORM workspace_private.enter(s);
 v:=workspace_private.receipt(s,r,'leave_school',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF m.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 PERFORM workspace_private.guard_last(s,m.id);
 PERFORM workspace_private.bump(s);
 UPDATE workspace.school_memberships SET status='left',version=version+1 WHERE id=m.id;
 UPDATE workspace.membership_terms SET ended_at=clock_timestamp() WHERE school_id=s AND membership_id=m.id AND epoch=m.epoch;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 VALUES(s,m.id,m.epoch,workspace_private.actor(),'leave_school',m.role,m.role);
 RETURN workspace_private.finish(s,r,'leave_school',p,jsonb_build_object('left',true),m.id);END $$;
ALTER FUNCTION workspace_private.leave_school(uuid,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.propose_admin_change(s uuid,target uuid,mode_value text,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE m workspace.school_memberships;source_id uuid;t uuid;v jsonb;p jsonb:=jsonb_build_array(target,mode_value);BEGIN
 PERFORM workspace_private.enter(s,true);IF NOT workspace_private.recent_login() THEN RAISE EXCEPTION 'reauth_required';END IF;
 v:=workspace_private.receipt(s,r,'propose_admin_change',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND id=target AND status='active' AND role='HEALTH_TEACHER';
 IF NOT FOUND THEN RAISE EXCEPTION 'eligible_teacher_required';END IF;
 SELECT id INTO source_id FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF source_id=target OR mode_value IS NULL OR mode_value NOT IN('add','transfer') THEN RAISE EXCEPTION 'invalid_transfer';END IF;
 INSERT INTO workspace.admin_transfers(school_id,from_id,to_id,to_epoch,mode) VALUES(s,source_id,m.id,m.epoch,mode_value) RETURNING id INTO t;
 RETURN workspace_private.finish(s,r,'propose_admin_change',p,jsonb_build_object('transfer_id',t),t);END $$;
ALTER FUNCTION workspace_private.propose_admin_change(uuid,uuid,text,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.accept_admin_change(s uuid,t uuid,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE x workspace.admin_transfers;m workspace.school_memberships;v jsonb;p jsonb:=jsonb_build_array(t,ev);BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.recent_login() THEN RAISE EXCEPTION 'reauth_required';END IF;
 v:=workspace_private.receipt(s,r,'accept_admin_change',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.admin_transfers WHERE id=t AND school_id=s;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_denied';END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE id=x.to_id AND school_id=s;
 IF m.actor_id<>workspace_private.actor() OR m.role<>'HEALTH_TEACHER' OR m.status<>'active' OR m.epoch<>x.to_epoch
 OR x.state<>'proposed' OR x.version<>ev OR x.expires_at<=statement_timestamp()
 OR NOT workspace_private.promotion_allowed(s,m.id) THEN RAISE EXCEPTION 'invalid_transfer';END IF;
 UPDATE workspace.school_memberships SET role='SCHOOL_ADMIN',version=version+1 WHERE id=m.id;
 IF x.mode='transfer' THEN UPDATE workspace.school_memberships SET role='HEALTH_TEACHER',version=version+1 WHERE id=x.from_id; END IF;
 UPDATE workspace.admin_transfers SET state='completed',version=version+1 WHERE id=t;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 VALUES(s,m.id,m.epoch,workspace_private.actor(),'accept_admin_change','HEALTH_TEACHER','SCHOOL_ADMIN');
 IF x.mode='transfer' THEN
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)
 SELECT s,mf.id,mf.epoch,workspace_private.actor(),'transfer_admin_out','SCHOOL_ADMIN','HEALTH_TEACHER' FROM workspace.school_memberships mf WHERE id=x.from_id;
 END IF;
 PERFORM workspace_private.bump(s);
 RETURN workspace_private.finish(s,r,'accept_admin_change',p,jsonb_build_object('accepted',true),t);END $$;
ALTER FUNCTION workspace_private.accept_admin_change(uuid,uuid,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.revoke_current_session(r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 DECLARE v jsonb;BEGIN
 IF NOT workspace_private.session_ok() OR workspace_private.actor() IS NULL THEN RAISE EXCEPTION 'unauthenticated_or_revoked';END IF;
 v:=workspace_private.finish(NULL,r,'revoke_current_session','{}',jsonb_build_object('revoked',true));
 INSERT INTO workspace.revoked_sessions(session_id,actor_id) VALUES((auth.jwt()->>'session_id')::uuid,workspace_private.actor());
 RETURN v;END $$;
ALTER FUNCTION workspace_private.revoke_current_session(uuid) OWNER TO ws_runtime;
-- Tight ACLs for all new private functions, including helpers. No global public ACL changes.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workspace_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA workspace_private TO ws_runtime;
-- The following wrappers are the sole client API. Helpers remain uncallable by clients.
GRANT EXECUTE ON FUNCTION workspace_private.bootstrap() TO authenticated;
CREATE FUNCTION public.ws_v1_bootstrap() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.bootstrap() $$;
ALTER FUNCTION public.ws_v1_bootstrap() OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_bootstrap() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_bootstrap() TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.get_context(uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_get_context(p_school_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.get_context(p_school_id) $$;
ALTER FUNCTION public.ws_v1_get_context(uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.request_join(uuid,text,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_request_join(p_school_id uuid,p_requested_role text,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.request_join(p_school_id,p_requested_role,p_request_id) $$;
ALTER FUNCTION public.ws_v1_request_join(uuid,text,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_request_join(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_request_join(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.decide_join(uuid,uuid,text,text,timestamptz,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_decide_join(p_school_id uuid,p_join_request_id uuid,p_decision text,p_approved_role text,p_valid_until timestamptz,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.decide_join(p_school_id,p_join_request_id,p_decision,p_approved_role,p_valid_until,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_decide_join(uuid,uuid,text,text,timestamptz,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_decide_join(uuid,uuid,text,text,timestamptz,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_decide_join(uuid,uuid,text,text,timestamptz,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.set_member_role(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_set_member_role(p_school_id uuid,p_membership_id uuid,p_new_role text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.set_member_role(p_school_id,p_membership_id,p_new_role,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_set_member_role(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_set_member_role(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_set_member_role(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.set_membership_state(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_set_membership_state(p_school_id uuid,p_membership_id uuid,p_state text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.set_membership_state(p_school_id,p_membership_id,p_state,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_set_membership_state(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_set_membership_state(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_set_membership_state(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.leave_school(uuid,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_leave_school(p_school_id uuid,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.leave_school(p_school_id,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_leave_school(uuid,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_leave_school(uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_leave_school(uuid,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.propose_admin_change(uuid,uuid,text,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_propose_admin_change(p_school_id uuid,p_target_membership_id uuid,p_mode text,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.propose_admin_change(p_school_id,p_target_membership_id,p_mode,p_request_id) $$;
ALTER FUNCTION public.ws_v1_propose_admin_change(uuid,uuid,text,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_propose_admin_change(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_propose_admin_change(uuid,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.accept_admin_change(uuid,uuid,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_accept_admin_change(p_school_id uuid,p_transfer_id uuid,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.accept_admin_change(p_school_id,p_transfer_id,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_accept_admin_change(uuid,uuid,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_accept_admin_change(uuid,uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_accept_admin_change(uuid,uuid,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.revoke_current_session(uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_revoke_current_session(p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.revoke_current_session(p_request_id) $$;
ALTER FUNCTION public.ws_v1_revoke_current_session(uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_revoke_current_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_revoke_current_session(uuid) TO authenticated;
COMMIT;
