-- ONE-SHOT LOCAL PROTOTYPE ONLY, not a Hosted deployable migration.
BEGIN;
DO $$BEGIN
 IF current_database()<>'school01a'OR current_user<>session_user OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 's09c_isolated_required';END IF;
 IF to_regclass('workspace_private.s08_release')IS NULL THEN RAISE EXCEPTION 's08_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s08_release WHERE state='closed')THEN RAISE EXCEPTION 's08_closed_required';END IF;
 IF to_regnamespace('workspace_auth_bridge')IS NOT NULL OR to_regnamespace('workspace_bootstrap')IS NOT NULL THEN RAISE EXCEPTION 'prototype_already_installed_review_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s08_release WHERE fingerprint=(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state','ws_v1_list_inventory_items','ws_v1_get_inventory_item','ws_v1_list_inventory_lots','ws_v1_list_inventory_movements','ws_v1_list_inventory_alerts','ws_v1_list_inventory_locations','ws_v1_get_inventory_context','ws_v1_create_inventory_item','ws_v1_edit_inventory_item','ws_v1_save_inventory_location','ws_v1_receive_inventory','ws_v1_use_inventory','ws_v1_adjust_inventory','ws_v1_dispose_inventory','ws_v1_set_inventory_lot_state']::text[]))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q))THEN RAISE EXCEPTION 's08_input_drift';END IF;
END$$;

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

-- Draft policy executable ONLY in isolation. Two independently provisioned DB operator principals.
-- No public RPC, no end-user operation, no service_role request path, no real verification asserted.
CREATE ROLE ws_bootstrap_executor NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_bootstrap_operator NOLOGIN NOBYPASSRLS;
CREATE SCHEMA workspace_bootstrap AUTHORIZATION ws_owner;
REVOKE ALL ON SCHEMA workspace_bootstrap FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;
GRANT USAGE ON SCHEMA workspace_bootstrap TO ws_bootstrap_executor,ws_bootstrap_operator;
GRANT USAGE ON SCHEMA workspace TO ws_bootstrap_executor;
SET LOCAL ROLE ws_owner;
CREATE TABLE workspace_bootstrap.operators(db_principal name PRIMARY KEY,actor_id uuid NOT NULL UNIQUE REFERENCES workspace.accounts,active boolean NOT NULL DEFAULT true);
CREATE TABLE workspace_bootstrap.cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 first_request_id uuid NOT NULL UNIQUE REFERENCES workspace.first_admin_requests,
 target_actor_id uuid NOT NULL REFERENCES workspace.accounts,target_membership_id uuid NOT NULL,
 proposer name NOT NULL REFERENCES workspace_bootstrap.operators,approver name REFERENCES workspace_bootstrap.operators,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256~'^[a-f0-9]{64}$'),consent_ref uuid NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '24 hours'),
 state text NOT NULL DEFAULT 'proposed' CHECK(state IN('proposed','approved')),version bigint NOT NULL DEFAULT 1,
 UNIQUE(school_id,id),FOREIGN KEY(school_id,target_membership_id)REFERENCES workspace.school_memberships(school_id,id),CHECK(approver IS NULL OR approver<>proposer));
CREATE UNIQUE INDEX first_bootstrap_pending ON workspace_bootstrap.cases(school_id)WHERE state='proposed';
CREATE TABLE workspace_bootstrap.receipts(operator_name name NOT NULL,request_id uuid NOT NULL,command text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(operator_name,request_id));
CREATE TABLE workspace_bootstrap.audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES workspace_bootstrap.cases,school_id uuid NOT NULL,operator_name name NOT NULL,action text NOT NULL,request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(school_id,case_id)REFERENCES workspace_bootstrap.cases(school_id,id));
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['operators','cases','receipts','audit']LOOP
 EXECUTE format('ALTER TABLE workspace_bootstrap.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE workspace_bootstrap.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON workspace_bootstrap.%I FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader,ws_bootstrap_operator',t);
 EXECUTE format('CREATE POLICY operator_exec ON workspace_bootstrap.%I TO ws_bootstrap_executor USING(true)WITH CHECK(true)',t);
END LOOP;END$$;
GRANT SELECT ON workspace_bootstrap.operators TO ws_bootstrap_executor;
GRANT SELECT,INSERT,UPDATE ON workspace_bootstrap.cases TO ws_bootstrap_executor;
GRANT SELECT,INSERT ON workspace_bootstrap.receipts TO ws_bootstrap_executor;
GRANT INSERT ON workspace_bootstrap.audit TO ws_bootstrap_executor;
GRANT SELECT ON workspace.accounts,workspace.s02_directory,workspace.schools,workspace.first_admin_requests,workspace.school_memberships,workspace.membership_terms TO ws_bootstrap_executor;
GRANT UPDATE ON workspace.schools,workspace.first_admin_requests,workspace.school_memberships TO ws_bootstrap_executor;
GRANT INSERT ON workspace.school_memberships,workspace.membership_terms,workspace.audit_entries,workspace.role_change_history TO ws_bootstrap_executor;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['accounts','s02_directory','schools','first_admin_requests','school_memberships','membership_terms','audit_entries','role_change_history']LOOP
 EXECUTE format('CREATE POLICY bootstrap_exec ON workspace.%I TO ws_bootstrap_executor USING(true)WITH CHECK(true)',t);
END LOOP;END$$;
RESET ROLE;
CREATE FUNCTION workspace_bootstrap.command(op text,s uuid,target uuid,case_id uuid,proof text,consent uuid,ev bigint,r uuid)RETURNS jsonb
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;q workspace.first_admin_requests;c workspace_bootstrap.cases;m workspace.school_memberships;
 payload_value jsonb:=jsonb_build_array(op,s,target,case_id,proof,consent,ev);v jsonb;mid uuid;cid uuid;
BEGIN
 IF NOT pg_catalog.pg_has_role(session_user,'ws_bootstrap_operator','MEMBER')THEN RAISE EXCEPTION 'operator_required';END IF;
 SELECT actor_id INTO actor FROM workspace_bootstrap.operators WHERE db_principal=session_user AND active;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=actor AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'operator_required';END IF;
 IF ev IS NULL OR ev<0 THEN RAISE EXCEPTION 'expected_version_required';END IF;
 IF r IS NULL OR s IS NULL THEN RAISE EXCEPTION 'request_id_required';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('school01a:'||s::text,0));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bootstrap:'||session_user||r::text,0));
 SELECT result INTO v FROM workspace_bootstrap.receipts WHERE operator_name=session_user AND request_id=r;
 IF FOUND THEN
 IF NOT EXISTS(SELECT 1 FROM workspace_bootstrap.receipts WHERE operator_name=session_user AND request_id=r AND command=op AND receipts.payload=payload_value)THEN RAISE EXCEPTION 'idempotency_mismatch';END IF;
 RETURN v;END IF;
 IF op='propose' THEN
 IF target IS NULL OR target=actor OR proof IS NULL OR proof!~'^[a-f0-9]{64}$'OR consent IS NULL OR ev<>0 THEN RAISE EXCEPTION 'verification_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.schools z JOIN workspace.s02_directory d ON d.school_id=z.id WHERE z.id=s AND z.state='unclaimed')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF EXISTS(SELECT 1 FROM workspace.school_memberships WHERE school_id=s AND role='SCHOOL_ADMIN')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=target AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 SELECT * INTO q FROM workspace.first_admin_requests WHERE school_id=s AND actor_id=target AND state='pending'FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_required';END IF;
 SELECT * INTO m FROM workspace.school_memberships WHERE school_id=s AND actor_id=target;
 IF FOUND AND(m.status<>'pending'OR m.role IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 IF NOT FOUND THEN
 INSERT INTO workspace.school_memberships(school_id,actor_id,member_code,status)VALUES(s,target,'M-'||replace(gen_random_uuid()::text,'-',''),'pending')RETURNING *INTO m;
 INSERT INTO workspace.membership_terms(school_id,membership_id,epoch)VALUES(s,m.id,m.epoch);
 END IF;
 INSERT INTO workspace_bootstrap.cases(school_id,first_request_id,target_actor_id,target_membership_id,proposer,evidence_sha256,consent_ref)VALUES(s,q.id,target,m.id,session_user,proof,consent)RETURNING id INTO cid;
 v:=jsonb_build_object('case_id',cid,'version',1,'state','proposed');
 ELSIF op='approve' THEN
 SELECT *INTO c FROM workspace_bootstrap.cases WHERE school_id=s AND id=case_id FOR UPDATE;
 IF NOT FOUND OR c.proposer=session_user OR c.target_actor_id=actor THEN RAISE EXCEPTION 'independent_operator_required';END IF;
 IF c.state<>'proposed'OR c.version<>ev OR c.expires_at<=statement_timestamp()THEN RAISE EXCEPTION 'conflict';END IF;
 IF proof IS DISTINCT FROM c.evidence_sha256 OR consent IS DISTINCT FROM c.consent_ref OR target IS DISTINCT FROM c.target_actor_id THEN RAISE EXCEPTION 'verification_mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.schools WHERE id=s AND state='unclaimed')OR EXISTS(SELECT 1 FROM workspace.school_memberships WHERE school_id=s AND role='SCHOOL_ADMIN')THEN RAISE EXCEPTION 'bootstrap_not_allowed';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.accounts WHERE id=c.target_actor_id AND status='active'AND user_id IS NOT NULL)THEN RAISE EXCEPTION 'invalid_target';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace.first_admin_requests WHERE school_id=s AND id=c.first_request_id AND actor_id=c.target_actor_id AND state='pending')THEN RAISE EXCEPTION 'request_required';END IF;
 SELECT *INTO m FROM workspace.school_memberships WHERE school_id=s AND id=c.target_membership_id FOR UPDATE;
 IF m.status<>'pending'OR m.role IS NOT NULL THEN RAISE EXCEPTION 'invalid_target';END IF;
 UPDATE workspace.school_memberships SET role='SCHOOL_ADMIN',status='active',approved_at=clock_timestamp(),version=version+1 WHERE school_id=s AND id=m.id;
 UPDATE workspace.first_admin_requests SET state='verified',version=version+1 WHERE school_id=s AND id=c.first_request_id;
 UPDATE workspace.schools SET state='active',authz_version=authz_version+1 WHERE id=s;
 UPDATE workspace_bootstrap.cases SET state='approved',approver=session_user,version=version+1 WHERE id=c.id;
 INSERT INTO workspace.role_change_history(school_id,membership_id,epoch,actor_id,action,old_role,new_role)VALUES(s,m.id,m.epoch,actor,'first_admin_bootstrap',NULL,'SCHOOL_ADMIN');
 cid:=c.id;v:=jsonb_build_object('case_id',cid,'membership_id',m.id,'state','approved','version',c.version+1);
 ELSE RAISE EXCEPTION 'invalid_command';END IF;
 INSERT INTO workspace.audit_entries(school_id,actor_id,action,request_id,entity_id)VALUES(s,actor,'first_admin_'||op,r,cid);
 INSERT INTO workspace_bootstrap.audit(case_id,school_id,operator_name,action,request_id)VALUES(cid,s,session_user,op,r);
 INSERT INTO workspace_bootstrap.receipts VALUES(session_user,r,op,payload_value,v);
 RETURN v;
END $$;
ALTER FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)OWNER TO ws_bootstrap_executor;
REVOKE ALL ON FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader,ws_bootstrap_operator;
-- Operator EXECUTE remains CLOSED until separate isolated QA activation; no end-user grant.

-- Remove any additional creator default-ACL grants, not only PUBLIC/anon/authenticated.
DO $$DECLARE g record;f oid:='workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)'::regprocedure;BEGIN
 FOR g IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f AND x.grantee<>p.proowner LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f::regprocedure,CASE WHEN g.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(g.grantee))END);
 END LOOP;
END$$;

COMMIT;
