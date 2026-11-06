-- Atomic cumulative application migration. RPC exposure remains CLOSED.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));
DO $core$ DECLARE f record;acl_item record;old text;target text;private_oid oid;BEGIN
IF current_user<>session_user THEN RAISE EXCEPTION 'direct_migration_session_required';END IF;
IF current_setting('bogunon.ws_install_mode',true) IS DISTINCT FROM 'isolated' THEN
 IF current_setting('bogunon.ws_target_project',true) IS DISTINCT FROM 'xxownwxxajzrviuvvfiu' OR length(coalesce(current_setting('bogunon.ws_change_ticket',true),''))<8 THEN RAISE EXCEPTION 'explicit_change_approval_required';END IF;
 ELSIF current_database()<>'school01a' THEN RAISE EXCEPTION 'isolated_fixture_database_required';END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'postgres17_required';END IF;
IF to_regclass('workspace_private.s06_install_manifest')IS NULL THEN RAISE EXCEPTION 'foundation_required';END IF;
IF(SELECT count(*)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)<>3 THEN RAISE EXCEPTION 'workspace_role_contract_mismatch';END IF;
 IF NOT pg_has_role(current_user,'ws_owner','SET')OR NOT pg_has_role(current_user,'ws_runtime','SET')OR NOT pg_has_role(current_user,'ws_authz_reader','SET')THEN RAISE EXCEPTION 'migration_owner_context_not_available';END IF;
IF to_regclass('auth.users')IS NULL OR to_regclass('auth.sessions')IS NULL OR to_regprocedure('auth.uid()')IS NULL OR to_regprocedure('auth.jwt()')IS NULL THEN RAISE EXCEPTION 'auth_contract_missing';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid='auth.sessions'::regclass AND relrowsecurity)THEN RAISE EXCEPTION 'auth_sessions_rls_requires_hosted_review';END IF;
 IF NOT has_schema_privilege('ws_owner','auth','USAGE')OR NOT has_schema_privilege('ws_runtime','auth','USAGE')OR NOT has_schema_privilege('ws_authz_reader','auth','USAGE')OR NOT has_column_privilege('ws_owner','auth.users','id','REFERENCES')THEN RAISE EXCEPTION 'external_auth_capability_required';END IF;
 IF NOT has_function_privilege('ws_runtime','auth.uid()','EXECUTE')OR NOT has_function_privilege('ws_runtime','auth.jwt()','EXECUTE')OR NOT has_function_privilege('ws_authz_reader','auth.uid()','EXECUTE')OR NOT has_function_privilege('ws_authz_reader','auth.jwt()','EXECUTE')THEN RAISE EXCEPTION 'external_auth_function_capability_required';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','created_at','not_after'])c WHERE NOT has_column_privilege('ws_authz_reader','auth.sessions',c,'SELECT'))THEN RAISE EXCEPTION 'external_auth_sessions_capability_required';END IF;
 IF has_table_privilege('ws_authz_reader','auth.sessions','SELECT')OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='auth.sessions'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname NOT IN('id','user_id','created_at','not_after')AND has_column_privilege('ws_authz_reader','auth.sessions',a.attname,'SELECT'))OR has_any_column_privilege('ws_runtime','auth.sessions','SELECT')OR has_any_column_privilege('ws_authz_reader','auth.users','SELECT')THEN RAISE EXCEPTION 'auth_capability_not_minimal';END IF;
IF EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core')THEN
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core'AND digest='92c6268eee5944e733132515b2fcd7895739c00c174a2dfc348ec891e283400a'AND state IN('closed','active')AND fingerprint=(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[]))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q))THEN RAISE EXCEPTION 'installed_package_or_catalog_drift';END IF;RETURN;
END IF;
IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind IN('r','v','m','p'))OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace','workspace_private')OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[])))THEN RAISE EXCEPTION 'new_object_collision';END IF;
IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='foundation'AND digest='7afd993fbd977fe56e83daca2276f4e4b94a63d855cb9da2c4e72af777b2a8c9'AND fingerprint=(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[]))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q))THEN RAISE EXCEPTION 'foundation_catalog_drift';END IF;
EXECUTE $ws06_payload$
-- Derived from school-workspace/local/supabase/migrations/20261105000027_school01a_workspace_local.sql
-- SCHOOL-01A LOCAL SYNTHETIC PROTOTYPE ONLY; not an approved production migration.
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

RESET ROLE;

-- Derived from school-workspace/integration/sql/local-status.sql
-- LOCAL SCHOOL-01C extension only. Original SCHOOL-01A migration remains byte-identical.

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

RESET ROLE;

-- Derived from school-workspace/school02/sql/extension.sql
-- LOCAL SYNTHETIC DATABASE ONLY; NOT A HOSTED MIGRATION.

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

RESET ROLE;

-- Derived from school-workspace/school03/sql/extension.sql
-- SCHOOL-03 LOCAL ONLY compatible extension. A/B/C/02 source migrations remain unchanged.

SET ROLE ws_owner;
CREATE TABLE workspace.shared_tasks(
 task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),description text NOT NULL DEFAULT '' CHECK(length(description)<=400),
 status text NOT NULL DEFAULT 'TODO' CHECK(status IN('TODO','IN_PROGRESS','DONE','CANCELLED')),
 priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN('LOW','NORMAL','HIGH')),due_date date,
 created_by_membership_id uuid NOT NULL,created_by_epoch integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_by_membership_id uuid NOT NULL,updated_by_epoch integer NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,
 UNIQUE(school_id,task_id),FOREIGN KEY(school_id,created_by_membership_id,created_by_epoch) REFERENCES workspace.membership_terms,
 FOREIGN KEY(school_id,updated_by_membership_id,updated_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_task_assignees(
 school_id uuid NOT NULL,task_id uuid NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,
 PRIMARY KEY(school_id,task_id,membership_id),FOREIGN KEY(school_id,task_id) REFERENCES workspace.shared_tasks(school_id,task_id),
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_task_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL,task_id uuid NOT NULL,
 actor_membership_id uuid NOT NULL,actor_epoch integer NOT NULL,action text NOT NULL,version bigint NOT NULL,
 from_status text,to_status text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,task_id,version),FOREIGN KEY(school_id,task_id) REFERENCES workspace.shared_tasks(school_id,task_id),
 FOREIGN KEY(school_id,actor_membership_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE INDEX s03_due ON workspace.shared_tasks(school_id,due_date,task_id) WHERE archived_at IS NULL;
CREATE INDEX s03_member_tasks ON workspace.shared_task_assignees(school_id,membership_id,epoch,task_id);
CREATE INDEX s03_history ON workspace.shared_task_history(school_id,task_id,version DESC);
ALTER TABLE workspace.shared_tasks ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace.shared_task_assignees ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_task_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace.shared_task_history ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace.shared_task_history FORCE ROW LEVEL SECURITY;
GRANT SELECT ON workspace.membership_permission_overrides,workspace.role_permission_defaults TO ws_authz_reader;
CREATE POLICY s03_overrides_reader ON workspace.membership_permission_overrides FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY s03_defaults_reader ON workspace.role_permission_defaults FOR SELECT TO ws_authz_reader USING(true);
RESET ROLE;
CREATE FUNCTION workspace_private.s03_read(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=s AND m.actor_id=workspace_private.actor()
 AND(EXISTS(SELECT 1 FROM workspace.role_permission_defaults d WHERE d.role=m.role AND d.permission='task.read') OR EXISTS(SELECT 1 FROM workspace.membership_permission_overrides o WHERE o.school_id=s AND o.membership_id=m.id AND o.epoch=m.epoch AND o.permission='task.read' AND o.effect='allow'))
 AND NOT EXISTS(SELECT 1 FROM workspace.membership_permission_overrides o WHERE o.school_id=s AND o.membership_id=m.id AND o.epoch=m.epoch AND o.permission='task.read' AND o.effect='deny')) $$;
ALTER FUNCTION workspace_private.s03_read(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s03_manage(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.s03_read(s) AND workspace_private.member_role(s) IN('SCHOOL_ADMIN','HEALTH_TEACHER') $$;
ALTER FUNCTION workspace_private.s03_manage(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s03_valid_epoch(s uuid,m uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT x.epoch FROM workspace.school_memberships x JOIN workspace.accounts a ON a.id=x.actor_id WHERE x.school_id=s AND x.id=m
 AND workspace_private.allowed(s) AND x.status='active' AND x.role IS NOT NULL AND a.status='active' AND a.user_id IS NOT NULL
 AND x.valid_from<=statement_timestamp() AND(x.valid_until IS NULL OR x.valid_until>statement_timestamp()) $$;
ALTER FUNCTION workspace_private.s03_valid_epoch(uuid,uuid) OWNER TO ws_authz_reader;
GRANT EXECUTE ON FUNCTION workspace_private.s03_read(uuid),workspace_private.s03_manage(uuid),workspace_private.s03_valid_epoch(uuid,uuid) TO ws_runtime;
CREATE FUNCTION workspace_private.s03_assigned(s uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.shared_task_assignees a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.task_id=t AND m.actor_id=workspace_private.actor() AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch) $$;
ALTER FUNCTION workspace_private.s03_assigned(uuid,uuid) OWNER TO ws_runtime;
GRANT SELECT,INSERT,UPDATE ON workspace.shared_tasks TO ws_runtime;
CREATE POLICY s03_task_read ON workspace.shared_tasks FOR SELECT TO ws_runtime USING(workspace_private.s03_read(school_id));
CREATE POLICY s03_task_insert ON workspace.shared_tasks FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_manage(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_tasks.school_id AND m.id=created_by_membership_id AND m.epoch=created_by_epoch AND m.actor_id=workspace_private.actor()));
CREATE POLICY s03_task_update ON workspace.shared_tasks FOR UPDATE TO ws_runtime
 USING(workspace_private.s03_manage(school_id) OR(workspace_private.s03_read(school_id) AND workspace_private.s03_assigned(school_id,task_id)))
 WITH CHECK(workspace_private.s03_read(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_tasks.school_id AND m.id=updated_by_membership_id AND m.epoch=updated_by_epoch AND m.actor_id=workspace_private.actor()));
GRANT SELECT,INSERT,DELETE ON workspace.shared_task_assignees TO ws_runtime;
CREATE POLICY s03_assignee_read ON workspace.shared_task_assignees FOR SELECT TO ws_runtime USING(workspace_private.s03_read(school_id));
CREATE POLICY s03_assignee_insert ON workspace.shared_task_assignees FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_manage(school_id) AND workspace_private.s03_valid_epoch(school_id,membership_id)=epoch);
CREATE POLICY s03_assignee_delete ON workspace.shared_task_assignees FOR DELETE TO ws_runtime USING(workspace_private.s03_manage(school_id));
GRANT SELECT,INSERT ON workspace.shared_task_history TO ws_runtime;
CREATE POLICY s03_history_read ON workspace.shared_task_history FOR SELECT TO ws_runtime USING(workspace_private.s03_manage(school_id));
CREATE POLICY s03_history_insert ON workspace.shared_task_history FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s03_read(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=shared_task_history.school_id AND m.id=actor_membership_id AND m.epoch=actor_epoch AND m.actor_id=workspace_private.actor()));
CREATE FUNCTION workspace_private.s03_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uuid;e integer;BEGIN
 IF NEW.task_id<>OLD.task_id OR NEW.school_id<>OLD.school_id OR NEW.created_at<>OLD.created_at OR NEW.created_by_membership_id<>OLD.created_by_membership_id OR NEW.created_by_epoch<>OLD.created_by_epoch THEN RAISE EXCEPTION 'access_denied';END IF;
 IF OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s03_manage(OLD.school_id) THEN
 IF workspace_private.member_role(OLD.school_id)<>'HEALTH_ASSISTANT' OR NOT workspace_private.s03_assigned(OLD.school_id,OLD.task_id)
 OR NOT((OLD.status='TODO' AND NEW.status='IN_PROGRESS') OR(OLD.status='IN_PROGRESS' AND NEW.status='DONE'))
 OR ROW(NEW.title,NEW.description,NEW.priority,NEW.due_date,NEW.archived_at) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.priority,OLD.due_date,OLD.archived_at) THEN RAISE EXCEPTION 'access_denied';END IF;END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=OLD.school_id AND actor_id=workspace_private.actor();
 NEW.updated_by_membership_id:=a;NEW.updated_by_epoch:=e;NEW.updated_at:=clock_timestamp();NEW.version:=OLD.version+1;RETURN NEW;END $$;
ALTER FUNCTION workspace_private.s03_guard() OWNER TO ws_runtime;
CREATE TRIGGER s03_guard BEFORE UPDATE ON workspace.shared_tasks FOR EACH ROW EXECUTE FUNCTION workspace_private.s03_guard();
CREATE FUNCTION workspace_private.s03_safe(title text,body text) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT title IS NOT NULL AND body IS NOT NULL AND length(title) BETWEEN 1 AND 100 AND length(btrim(title))>0 AND length(body)<=400
 AND title!~'[[:cntrl:]]' AND replace(body,E'\n','')!~'[[:cntrl:]]' AND length(body)-length(replace(body,E'\n',''))<=3
 AND (title||' '||body)!~*'(학생|학번|상담|투약|처치|보건일지|건강정보|비밀번호|인증서|주민등록|password|finance|medical|secret|01[016789][- ]?[0-9]{3,4}[- ]?[0-9]{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})' $$;
ALTER FUNCTION workspace_private.s03_safe(text,text) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_hash(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS
$$ SELECT jsonb_build_object('sha256',encode(sha256(convert_to(p::text,'UTF8')),'hex')) $$;
ALTER FUNCTION workspace_private.s03_hash(jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_json(s uuid,t uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(x)||jsonb_build_object('assignees',(SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',a.membership_id,'epoch',a.epoch,'member_code',m.member_code,'active',coalesce(workspace_private.s03_valid_epoch(s,m.id)=a.epoch,false)) ORDER BY m.member_code),'[]') FROM workspace.shared_task_assignees a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id WHERE a.school_id=s AND a.task_id=t)) FROM workspace.shared_tasks x WHERE x.school_id=s AND x.task_id=t $$;
ALTER FUNCTION workspace_private.s03_json(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_record(s uuid,t uuid,c text,old_status text,r uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;a uuid;e integer;BEGIN
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.shared_task_history(school_id,task_id,actor_membership_id,actor_epoch,action,version,from_status,to_status) VALUES(s,t,a,e,c,x.version,old_status,x.status);
 RETURN workspace_private.finish(s,r,c,p,jsonb_build_object('task_id',t,'version',x.version),t);END $$;
ALTER FUNCTION workspace_private.s03_record(uuid,uuid,text,text,uuid,jsonb) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_assign(s uuid,t uuid,ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m uuid;e integer;BEGIN
 IF ids IS NULL OR cardinality(ids)>10 OR array_position(ids,NULL) IS NOT NULL OR cardinality(ids)<>(SELECT count(DISTINCT v) FROM unnest(ids)v) THEN RAISE EXCEPTION 'input_rejected';END IF;
 -- Validate every target before deleting existing assignments.
 FOREACH m IN ARRAY ids LOOP IF workspace_private.s03_valid_epoch(s,m) IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;END LOOP;
 DELETE FROM workspace.shared_task_assignees WHERE school_id=s AND task_id=t;
 FOREACH m IN ARRAY ids LOOP e:=workspace_private.s03_valid_epoch(s,m);INSERT INTO workspace.shared_task_assignees VALUES(s,t,m,e);END LOOP;END $$;
ALTER FUNCTION workspace_private.s03_assign(uuid,uuid,uuid[]) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_list(s uuid,filter_status text,sort_value text,scope_value text,archives boolean) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;a uuid;e integer;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF filter_status IS NOT NULL AND filter_status NOT IN('TODO','IN_PROGRESS','DONE','CANCELLED') OR sort_value IS NULL OR sort_value NOT IN('DUE','PRIORITY') OR scope_value IS NULL OR scope_value NOT IN('ALL','MINE','TODAY') THEN RAISE EXCEPTION 'input_rejected';END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 SELECT coalesce(jsonb_agg(workspace_private.s03_json(s,q.task_id) ORDER BY q.n),'[]') INTO v FROM(
 SELECT task_id,row_number()over(ORDER BY CASE WHEN sort_value='PRIORITY' THEN CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END END DESC NULLS LAST,due_date ASC NULLS LAST,CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC,created_at,task_id)n
 FROM workspace.shared_tasks WHERE school_id=s AND(archives OR archived_at IS NULL) AND(filter_status IS NULL OR status=filter_status)
 AND(scope_value<>'MINE' OR workspace_private.s03_assigned(s,task_id)) AND(scope_value<>'TODAY' OR(due_date<=(statement_timestamp() AT TIME ZONE 'Asia/Seoul')::date AND status IN('TODO','IN_PROGRESS'))) ORDER BY n LIMIT 100)q;
 RETURN jsonb_build_object('tasks',v,'self',jsonb_build_object('membership_id',a,'epoch',e,'role',workspace_private.member_role(s)),
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'epoch',m.epoch,'member_code',m.member_code,'role',m.role) ORDER BY m.member_code),'[]') FROM workspace.school_memberships m WHERE m.school_id=s AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch),'limit',100);END $$;
ALTER FUNCTION workspace_private.s03_list(uuid,text,text,text,boolean) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_get(s uuid,t uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;v:=workspace_private.s03_json(s,t);IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END $$;
ALTER FUNCTION workspace_private.s03_get(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_create(s uuid,title_value text,body text,priority_value text,due date,ids uuid[],r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb;v jsonb;t uuid;a uuid;e integer;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 -- Return a safe error without raising a text-bearing SQL error or persisting rejected content.
 IF NOT workspace_private.s03_safe(title_value,body) OR priority_value IS NULL OR priority_value NOT IN('LOW','NORMAL','HIGH') THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(title_value,body,priority_value,due,ids));v:=workspace_private.receipt(s,r,'s03_create',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.shared_tasks(school_id,title,description,priority,due_date,created_by_membership_id,created_by_epoch,updated_by_membership_id,updated_by_epoch) VALUES(s,title_value,body,priority_value,due,a,e,a,e) RETURNING task_id INTO t;
 PERFORM workspace_private.s03_assign(s,t,ids);RETURN workspace_private.s03_record(s,t,'s03_create',NULL,r,p);END $$;
ALTER FUNCTION workspace_private.s03_create(uuid,text,text,text,date,uuid[],uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_edit(s uuid,t uuid,title_value text,body text,priority_value text,due date,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s03_safe(title_value,body) OR priority_value IS NULL OR priority_value NOT IN('LOW','NORMAL','HIGH') THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(t,title_value,body,priority_value,due,ev));v:=workspace_private.receipt(s,r,'s03_edit',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.shared_tasks SET title=title_value,description=body,priority=priority_value,due_date=due WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_edit',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_edit(uuid,uuid,text,text,text,date,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_reassign(s uuid,t uuid,ids uuid[],ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,ids,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_assign',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 PERFORM workspace_private.s03_assign(s,t,ids);UPDATE workspace.shared_tasks SET updated_at=clock_timestamp() WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_assign',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_reassign(uuid,uuid,uuid[],bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_status(s uuid,t uuid,new_status text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,new_status,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_read(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_status',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 IF new_status IS NULL OR new_status NOT IN('TODO','IN_PROGRESS','DONE') THEN RAISE EXCEPTION 'access_denied';END IF;
 UPDATE workspace.shared_tasks SET status=new_status WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_status',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_status(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_close(s uuid,t uuid,mode_value text,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_tasks;p jsonb:=workspace_private.s03_hash(jsonb_build_array(t,mode_value,ev));v jsonb;BEGIN
 PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s03_close',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT * INTO x FROM workspace.shared_tasks WHERE school_id=s AND task_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version<>ev THEN RAISE EXCEPTION 'conflict';END IF;
 IF mode_value IS NULL OR mode_value NOT IN('DONE','CANCELLED','ARCHIVE') THEN RAISE EXCEPTION 'access_denied';END IF;
 UPDATE workspace.shared_tasks SET status=CASE WHEN mode_value='ARCHIVE' THEN status ELSE mode_value END,archived_at=CASE WHEN mode_value='ARCHIVE' THEN clock_timestamp() ELSE NULL END WHERE school_id=s AND task_id=t;
 RETURN workspace_private.s03_record(s,t,'s03_close',x.status,r,p);END $$;
ALTER FUNCTION workspace_private.s03_close(uuid,uuid,text,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s03_history(s uuid,t uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;BEGIN PERFORM workspace_private.enter(s);IF NOT workspace_private.s03_manage(s) OR workspace_private.s03_json(s,t) IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.version DESC),'[]') INTO v FROM(SELECT h.action,h.version,h.from_status,h.to_status,h.created_at,m.member_code FROM workspace.shared_task_history h JOIN workspace.school_memberships m ON m.school_id=h.school_id AND m.id=h.actor_membership_id WHERE h.school_id=s AND h.task_id=t ORDER BY h.version DESC LIMIT 100)q;RETURN v;END $$;
ALTER FUNCTION workspace_private.s03_history(uuid,uuid) OWNER TO ws_runtime;
DO $$ DECLARE x record;BEGIN FOR x IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' AND p.proname LIKE 's03_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ws_runtime',x.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION workspace_private.s03_list(uuid,text,text,text,boolean) TO authenticated;
CREATE FUNCTION public.ws_v1_list_tasks(p_school_id uuid,p_status text,p_sort text,p_scope text,p_include_archived boolean) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_list(p_school_id,p_status,p_sort,p_scope,p_include_archived) $$;
ALTER FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_tasks(uuid,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_get(uuid,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_get_task(p_school_id uuid,p_task_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_get(p_school_id,p_task_id) $$;
ALTER FUNCTION public.ws_v1_get_task(uuid,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_task(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_task(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_create(uuid,text,text,text,date,uuid[],uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_create_task(p_school_id uuid,p_title text,p_description text,p_priority text,p_due_date date,p_assignees uuid[],p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_create(p_school_id,p_title,p_description,p_priority,p_due_date,p_assignees,p_request_id) $$;
ALTER FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_edit(uuid,uuid,text,text,text,date,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_edit_task(p_school_id uuid,p_task_id uuid,p_title text,p_description text,p_priority text,p_due_date date,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_edit(p_school_id,p_task_id,p_title,p_description,p_priority,p_due_date,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_reassign(uuid,uuid,uuid[],bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_assign_task(p_school_id uuid,p_task_id uuid,p_assignees uuid[],p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_reassign(p_school_id,p_task_id,p_assignees,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_status(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_change_assigned_task_status(p_school_id uuid,p_task_id uuid,p_status text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_status(p_school_id,p_task_id,p_status,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_close(uuid,uuid,text,bigint,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_close_task(p_school_id uuid,p_task_id uuid,p_mode text,p_expected_version bigint,p_request_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_close(p_school_id,p_task_id,p_mode,p_expected_version,p_request_id) $$;
ALTER FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_close_task(uuid,uuid,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s03_history(uuid,uuid) TO authenticated;
CREATE FUNCTION public.ws_v1_list_task_history(p_school_id uuid,p_task_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT workspace_private.s03_history(p_school_id,p_task_id) $$;
ALTER FUNCTION public.ws_v1_list_task_history(uuid,uuid) OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_task_history(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_task_history(uuid,uuid) TO authenticated;

RESET ROLE;

-- Derived from school-workspace/school04/sql/extension.sql
-- LOCAL SYNTHETIC SCHOOL-04 compatible extension, never apply to hosted DB.

SET ROLE ws_owner;
-- Preserve prior permissions and add only an explicit, targeted completion capability.
ALTER TABLE workspace.membership_permission_overrides DROP CONSTRAINT membership_permission_overrides_permission_check;
ALTER TABLE workspace.membership_permission_overrides ADD CONSTRAINT membership_permission_overrides_permission_check CHECK(permission IN('task.read','handover.create','handover.complete'));
ALTER TABLE workspace.membership_permission_overrides ADD CONSTRAINT s04_complete_scope CHECK(permission<>'handover.complete' OR scope='targeted');
CREATE TABLE workspace.shared_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),description text NOT NULL CHECK(length(description)<=400),
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,all_day boolean NOT NULL,status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN('SCHEDULED','CANCELLED')),
 created_by uuid NOT NULL,created_by_epoch integer NOT NULL,updated_by uuid NOT NULL,updated_by_epoch integer NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(end_at>start_at),CHECK(NOT all_day OR((start_at AT TIME ZONE 'Asia/Seoul')::time='00:00'::time AND(end_at AT TIME ZONE 'Asia/Seoul')::time='00:00'::time)),
 UNIQUE(school_id,event_id),FOREIGN KEY(school_id,created_by,created_by_epoch) REFERENCES workspace.membership_terms,FOREIGN KEY(school_id,updated_by,updated_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.shared_event_history(
 school_id uuid NOT NULL,event_id uuid NOT NULL,version bigint NOT NULL,action text NOT NULL,actor_id uuid NOT NULL,actor_epoch integer NOT NULL,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,all_day boolean NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,event_id,version),FOREIGN KEY(school_id,event_id) REFERENCES workspace.shared_events(school_id,event_id),FOREIGN KEY(school_id,actor_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_notes(
 handover_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES workspace.schools,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),content_revision bigint NOT NULL DEFAULT 1 CHECK(content_revision>0),
 created_by uuid NOT NULL,created_by_epoch integer NOT NULL,updated_by uuid NOT NULL,updated_by_epoch integer NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','COMPLETED')),completed_at timestamptz,completed_by uuid,completed_by_epoch integer,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,handover_id),FOREIGN KEY(school_id,created_by,created_by_epoch) REFERENCES workspace.membership_terms,
 FOREIGN KEY(school_id,updated_by,updated_by_epoch) REFERENCES workspace.membership_terms,FOREIGN KEY(school_id,completed_by,completed_by_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_revisions(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,version bigint NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),body text NOT NULL CHECK(length(body)<=400),
 actor_id uuid NOT NULL,actor_epoch integer NOT NULL,target_roles text[] NOT NULL,explicit_targets uuid[] NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,handover_id,version),FOREIGN KEY(school_id,handover_id) REFERENCES workspace.handover_notes(school_id,handover_id),FOREIGN KEY(school_id,actor_id,actor_epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_targets(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,revision bigint NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,role_at_publish text NOT NULL,
 PRIMARY KEY(school_id,handover_id,revision,membership_id,epoch),FOREIGN KEY(school_id,handover_id,revision) REFERENCES workspace.handover_revisions,
 FOREIGN KEY(school_id,membership_id,epoch) REFERENCES workspace.membership_terms);
CREATE TABLE workspace.handover_acknowledgements(
 school_id uuid NOT NULL,handover_id uuid NOT NULL,revision bigint NOT NULL,membership_id uuid NOT NULL,epoch integer NOT NULL,acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(school_id,handover_id,revision,membership_id,epoch),FOREIGN KEY(school_id,handover_id,revision,membership_id,epoch) REFERENCES workspace.handover_targets);
CREATE INDEX s04_events_range ON workspace.shared_events(school_id,start_at,end_at);
CREATE INDEX s04_targets_actor ON workspace.handover_targets(school_id,membership_id,epoch,handover_id,revision);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['shared_events','shared_event_history','handover_notes','handover_revisions','handover_targets','handover_acknowledgements']LOOP EXECUTE format('ALTER TABLE workspace.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE workspace.%I FORCE ROW LEVEL SECURITY',t);END LOOP;END$$;
-- Reader receives metadata columns only, not note/revision content.
GRANT SELECT(school_id,handover_id,content_revision,created_by,created_by_epoch) ON workspace.handover_notes TO ws_authz_reader;
GRANT SELECT ON workspace.handover_targets TO ws_authz_reader;
CREATE POLICY s04_note_metadata ON workspace.handover_notes FOR SELECT TO ws_authz_reader USING(true);
CREATE POLICY s04_target_metadata ON workspace.handover_targets FOR SELECT TO ws_authz_reader USING(true);
RESET ROLE;
CREATE FUNCTION workspace_private.s04_safe(t text,b text) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS
$$ SELECT workspace_private.s03_safe(t,b) AND(t||' '||b)!~'(증상|질병|검사[ ]?결과|건강[ ]?상태|개인정보)' $$;
ALTER FUNCTION workspace_private.s04_safe(text,text) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_manage(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.member_role(s) IN('SCHOOL_ADMIN','HEALTH_TEACHER') $$;
ALTER FUNCTION workspace_private.s04_manage(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_permission(s uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.membership_permission_overrides o ON o.school_id=m.school_id AND o.membership_id=m.id AND o.epoch=m.epoch
 WHERE m.school_id=s AND m.actor_id=workspace_private.actor() AND o.permission=p AND o.effect='allow' AND((p='handover.create' AND o.scope='school')OR(p='handover.complete' AND o.scope='targeted'))) $$;
ALTER FUNCTION workspace_private.s04_permission(uuid,text) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_denied(s uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM workspace.school_memberships m JOIN workspace.membership_permission_overrides o ON o.school_id=m.school_id AND o.membership_id=m.id AND o.epoch=m.epoch WHERE m.school_id=s AND m.actor_id=workspace_private.actor() AND o.permission=p AND o.effect='deny') $$;
ALTER FUNCTION workspace_private.s04_denied(uuid,text) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_create_allowed(s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT NOT workspace_private.s04_denied(s,'handover.create') AND(workspace_private.s04_manage(s) OR(workspace_private.member_role(s)='HEALTH_ASSISTANT' AND workspace_private.s04_permission(s,'handover.create'))) $$;
ALTER FUNCTION workspace_private.s04_create_allowed(uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_target(s uuid,h uuid,v bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND EXISTS(SELECT 1 FROM workspace.handover_targets t JOIN workspace.school_memberships m ON m.school_id=t.school_id AND m.id=t.membership_id AND m.epoch=t.epoch WHERE t.school_id=s AND t.handover_id=h AND t.revision=v AND m.actor_id=workspace_private.actor()) $$;
ALTER FUNCTION workspace_private.s04_target(uuid,uuid,bigint) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_author(s uuid,h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.member_role(s)='HEALTH_TEACHER' AND EXISTS(SELECT 1 FROM workspace.handover_notes n JOIN workspace.school_memberships m ON m.school_id=n.school_id AND m.id=n.created_by AND m.epoch=n.created_by_epoch WHERE n.school_id=s AND n.handover_id=h AND m.actor_id=workspace_private.actor()) $$;
ALTER FUNCTION workspace_private.s04_author(uuid,uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_visible(s uuid,h uuid,v bigint DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT workspace_private.allowed(s) AND(workspace_private.admin(s) OR workspace_private.s04_author(s,h) OR workspace_private.s04_target(s,h,coalesce(v,(SELECT content_revision FROM workspace.handover_notes WHERE school_id=s AND handover_id=h)))) $$;
ALTER FUNCTION workspace_private.s04_visible(uuid,uuid,bigint) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_editable(s uuid,h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT workspace_private.admin(s) OR workspace_private.s04_author(s,h) $$;
ALTER FUNCTION workspace_private.s04_editable(uuid,uuid) OWNER TO ws_authz_reader;
CREATE FUNCTION workspace_private.s04_completable(s uuid,h uuid,v bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT NOT workspace_private.s04_denied(s,'handover.complete') AND(workspace_private.admin(s) OR(workspace_private.s04_target(s,h,v) AND(workspace_private.member_role(s)='HEALTH_TEACHER' OR workspace_private.s04_permission(s,'handover.complete')))) $$;
ALTER FUNCTION workspace_private.s04_completable(uuid,uuid,bigint) OWNER TO ws_authz_reader;
GRANT SELECT,INSERT,UPDATE ON workspace.shared_events,workspace.handover_notes TO ws_runtime;
GRANT SELECT,INSERT ON workspace.shared_event_history,workspace.handover_revisions,workspace.handover_targets,workspace.handover_acknowledgements TO ws_runtime;
CREATE POLICY s04_events_read ON workspace.shared_events FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY s04_events_insert ON workspace.shared_events FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_events_update ON workspace.shared_events FOR UPDATE TO ws_runtime USING(workspace_private.s04_manage(school_id))WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_event_history_read ON workspace.shared_event_history FOR SELECT TO ws_runtime USING(workspace_private.allowed(school_id));
CREATE POLICY s04_event_history_insert ON workspace.shared_event_history FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_manage(school_id));
CREATE POLICY s04_notes_read ON workspace.handover_notes FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id));
CREATE POLICY s04_notes_insert ON workspace.handover_notes FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=handover_notes.school_id AND m.id=created_by AND m.epoch=created_by_epoch AND m.actor_id=workspace_private.actor()));
CREATE POLICY s04_notes_update ON workspace.handover_notes FOR UPDATE TO ws_runtime USING(workspace_private.s04_editable(school_id,handover_id) OR workspace_private.s04_completable(school_id,handover_id,content_revision))WITH CHECK(workspace_private.s04_visible(school_id,handover_id));
CREATE POLICY s04_revision_read ON workspace.handover_revisions FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,version));
CREATE POLICY s04_revision_insert ON workspace.handover_revisions FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id));
CREATE POLICY s04_target_read ON workspace.handover_targets FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,revision));
CREATE POLICY s04_target_insert ON workspace.handover_targets FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_create_allowed(school_id));
CREATE POLICY s04_ack_read ON workspace.handover_acknowledgements FOR SELECT TO ws_runtime USING(workspace_private.s04_visible(school_id,handover_id,revision));
CREATE POLICY s04_ack_insert ON workspace.handover_acknowledgements FOR INSERT TO ws_runtime WITH CHECK(workspace_private.s04_target(school_id,handover_id,revision) AND EXISTS(SELECT 1 FROM workspace.school_memberships m WHERE m.school_id=handover_acknowledgements.school_id AND m.id=membership_id AND m.epoch=handover_acknowledgements.epoch AND m.actor_id=workspace_private.actor()));
CREATE FUNCTION workspace_private.s04_enter(s uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN PERFORM workspace_private.enter(s);END$$;
ALTER FUNCTION workspace_private.s04_enter(uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_list(s uuid,f timestamptz,t timestamptz) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF f IS NULL OR t IS NULL OR t<=f OR t-f>interval '93 days' THEN RAISE EXCEPTION 'input_rejected';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY q.start_at,q.event_id),'[]')INTO v FROM(SELECT * FROM workspace.shared_events WHERE school_id=s AND end_at>f AND start_at<t ORDER BY start_at,event_id LIMIT 100)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_list(uuid,timestamptz,timestamptz) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_get(s uuid,e uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT to_jsonb(x)INTO v FROM workspace.shared_events x WHERE school_id=s AND event_id=e;IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_get(uuid,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_save(s uuid,e uuid,t text,b text,f timestamptz,z timestamptz,d boolean,ev bigint,r uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE x workspace.shared_events;a uuid;ep integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) OR f IS NULL OR z IS NULL OR z<=f OR d IS NULL OR(d AND((f AT TIME ZONE 'Asia/Seoul')::time<>'00:00'::time OR(z AT TIME ZONE 'Asia/Seoul')::time<>'00:00'::time)) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(e,t,b,f,z,d,ev));v:=workspace_private.receipt(s,r,'s04_event_save',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT id,epoch INTO a,ep FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF e IS NULL THEN IF ev<>0 OR ev IS NULL THEN RAISE EXCEPTION 'conflict';END IF;
 INSERT INTO workspace.shared_events(school_id,title,description,start_at,end_at,all_day,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(s,t,b,f,z,d,a,ep,a,ep)RETURNING *INTO x;
 ELSE SELECT *INTO x FROM workspace.shared_events WHERE school_id=s AND event_id=e FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version IS DISTINCT FROM ev OR x.status<>'SCHEDULED' THEN RAISE EXCEPTION 'conflict';END IF;
 UPDATE workspace.shared_events SET title=t,description=b,start_at=f,end_at=z,all_day=d,version=version+1,updated_by=a,updated_by_epoch=ep,updated_at=clock_timestamp()WHERE school_id=s AND event_id=e RETURNING *INTO x;END IF;
 INSERT INTO workspace.shared_event_history(school_id,event_id,version,action,actor_id,actor_epoch,start_at,end_at,all_day,status)VALUES(s,x.event_id,x.version,'SAVE',a,ep,f,z,d,x.status);
 RETURN workspace_private.finish(s,r,'s04_event_save',p,jsonb_build_object('event_id',x.event_id,'version',x.version),x.event_id);END$$;
ALTER FUNCTION workspace_private.s04_event_save(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid) OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_cancel(s uuid,e uuid,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE x workspace.shared_events;a uuid;ep integer;p jsonb:=workspace_private.s03_hash(jsonb_build_array(e,ev));v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_manage(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 v:=workspace_private.receipt(s,r,'s04_event_cancel',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT *INTO x FROM workspace.shared_events WHERE school_id=s AND event_id=e FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF x.version IS DISTINCT FROM ev OR x.status<>'SCHEDULED' THEN RAISE EXCEPTION 'conflict';END IF;
 SELECT id,epoch INTO a,ep FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 UPDATE workspace.shared_events SET status='CANCELLED',version=version+1,updated_at=clock_timestamp(),updated_by=a,updated_by_epoch=ep WHERE school_id=s AND event_id=e RETURNING *INTO x;
 INSERT INTO workspace.shared_event_history(school_id,event_id,version,action,actor_id,actor_epoch,start_at,end_at,all_day,status)VALUES(s,e,x.version,'CANCEL',a,ep,x.start_at,x.end_at,x.all_day,x.status);
 RETURN workspace_private.finish(s,r,'s04_event_cancel',p,jsonb_build_object('event_id',e,'version',x.version),e);END$$;
ALTER FUNCTION workspace_private.s04_event_cancel(uuid,uuid,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_event_history(s uuid,e uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);PERFORM workspace_private.s04_event_get(s,e);SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY version DESC),'[]')INTO v FROM(SELECT h.version,h.action,h.start_at,h.end_at,h.all_day,h.status,h.created_at,m.member_code FROM workspace.shared_event_history h JOIN workspace.school_memberships m ON m.school_id=h.school_id AND m.id=h.actor_id WHERE h.school_id=s AND h.event_id=e ORDER BY version DESC LIMIT 50)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_event_history(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_expand(s uuid,ids uuid[],roles text[])RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE out_ids uuid[];m uuid;BEGIN
 IF ids IS NULL OR roles IS NULL OR cardinality(ids)>50 OR cardinality(roles)>3 OR array_position(ids,NULL)IS NOT NULL OR array_position(roles,NULL)IS NOT NULL OR EXISTS(SELECT 1 FROM unnest(roles)q WHERE q NOT IN('SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT')) THEN RAISE EXCEPTION 'input_rejected';END IF;
 FOREACH m IN ARRAY ids LOOP IF workspace_private.s03_valid_epoch(s,m)IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;END LOOP;
 SELECT array_agg(x.id ORDER BY x.id)INTO out_ids FROM(SELECT DISTINCT m.id FROM workspace.school_memberships m WHERE m.school_id=s AND(m.id=ANY(ids)OR m.role=ANY(roles))AND workspace_private.s03_valid_epoch(s,m.id)=m.epoch)x;
 IF out_ids IS NULL OR cardinality(out_ids)>200 THEN RAISE EXCEPTION 'input_rejected';END IF;RETURN out_ids;END$$;
ALTER FUNCTION workspace_private.s04_expand(uuid,uuid[],text[])OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_publish(s uuid,h uuid,v bigint,t text,b text,ids uuid[],roles text[],targets uuid[])RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE a uuid;e integer;BEGIN
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 INSERT INTO workspace.handover_revisions(school_id,handover_id,version,title,body,actor_id,actor_epoch,target_roles,explicit_targets)VALUES(s,h,v,t,b,a,e,roles,ids);
 INSERT INTO workspace.handover_targets(school_id,handover_id,revision,membership_id,epoch,role_at_publish)SELECT s,h,v,m.id,m.epoch,m.role FROM workspace.school_memberships m WHERE m.school_id=s AND m.id=ANY(targets);
END$$;
ALTER FUNCTION workspace_private.s04_publish(uuid,uuid,bigint,text,text,uuid[],text[],uuid[])OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_json(s uuid,h uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_jsonb(n)||jsonb_build_object('title',r.title,'body',r.body,'target_roles',r.target_roles,'explicit_targets',r.explicit_targets,
 'can_edit',workspace_private.s04_editable(s,h),'can_complete',workspace_private.s04_completable(s,h,n.content_revision),
 'ack_required',workspace_private.s04_target(s,h,n.content_revision),
 'acknowledged',EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.handover_id=h AND a.revision=n.content_revision AND m.actor_id=workspace_private.actor()),
 'author_code',(SELECT member_code FROM workspace.school_memberships WHERE school_id=s AND id=n.created_by),
 'targets',(SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',q.membership_id,'epoch',q.epoch,'member_code',m.member_code,'role_at_publish',q.role_at_publish,'active',coalesce(workspace_private.s03_valid_epoch(s,q.membership_id)=q.epoch,false),'acknowledged',EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a WHERE a.school_id=q.school_id AND a.handover_id=q.handover_id AND a.revision=q.revision AND a.membership_id=q.membership_id AND a.epoch=q.epoch))ORDER BY m.member_code),'[]')FROM workspace.handover_targets q JOIN workspace.school_memberships m ON m.school_id=q.school_id AND m.id=q.membership_id WHERE q.school_id=s AND q.handover_id=h AND q.revision=n.content_revision))
 FROM workspace.handover_notes n JOIN workspace.handover_revisions r ON r.school_id=n.school_id AND r.handover_id=n.handover_id AND r.version=n.content_revision WHERE n.school_id=s AND n.handover_id=h $$;
ALTER FUNCTION workspace_private.s04_note_json(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_list(s uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT coalesce(jsonb_agg(q.data ORDER BY q.needs_ack DESC,q.created_at DESC),'[]')INTO v FROM(SELECT workspace_private.s04_note_json(s,n.handover_id)data,n.created_at,
 workspace_private.s04_target(s,n.handover_id,n.content_revision)AND NOT EXISTS(SELECT 1 FROM workspace.handover_acknowledgements a JOIN workspace.school_memberships m ON m.school_id=a.school_id AND m.id=a.membership_id AND m.epoch=a.epoch WHERE a.school_id=s AND a.handover_id=n.handover_id AND a.revision=n.content_revision AND m.actor_id=workspace_private.actor())needs_ack
 FROM workspace.handover_notes n WHERE n.school_id=s ORDER BY needs_ack DESC,n.created_at DESC LIMIT 100)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_list(uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_get(s uuid,h uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);v:=workspace_private.s04_note_json(s,h);IF v IS NULL THEN RAISE EXCEPTION 'access_denied';END IF;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_get(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_create(s uuid,t text,b text,ids uuid[],roles text[],ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE h uuid:=gen_random_uuid();a uuid;e integer;p jsonb;v jsonb;targets uuid[];BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_create_allowed(s) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(t,b,ids,roles,ev));v:=workspace_private.receipt(s,r,'s04_note_create',p);IF v IS NOT NULL THEN RETURN v;END IF;IF ev<>0 OR ev IS NULL THEN RAISE EXCEPTION 'conflict';END IF;
 targets:=workspace_private.s04_expand(s,ids,roles);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 IF workspace_private.member_role(s)='HEALTH_ASSISTANT'AND NOT(a=ANY(targets))THEN RAISE EXCEPTION 'access_denied';END IF;
 INSERT INTO workspace.handover_notes(handover_id,school_id,created_by,created_by_epoch,updated_by,updated_by_epoch)VALUES(h,s,a,e,a,e);
 PERFORM workspace_private.s04_publish(s,h,1,t,b,ids,roles,targets);
 RETURN workspace_private.finish(s,r,'s04_note_create',p,jsonb_build_object('handover_id',h,'version',1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_create(uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_edit(s uuid,h uuid,t text,b text,ids uuid[],roles text[],ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;targets uuid[];BEGIN
 PERFORM workspace_private.s04_enter(s);IF NOT workspace_private.s04_editable(s,h) THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NOT workspace_private.s04_safe(t,b) THEN RETURN jsonb_build_object('error','INPUT_REJECTED');END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,t,b,ids,roles,ev));v:=workspace_private.receipt(s,r,'s04_note_edit',p);IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'access_denied';END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 targets:=workspace_private.s04_expand(s,ids,roles);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 PERFORM workspace_private.s04_publish(s,h,ev+1,t,b,ids,roles,targets);
 UPDATE workspace.handover_notes SET version=version+1,content_revision=version+1,status='OPEN',completed_at=NULL,completed_by=NULL,completed_by_epoch=NULL,updated_by=a,updated_by_epoch=e,updated_at=clock_timestamp()WHERE school_id=s AND handover_id=h;
 RETURN workspace_private.finish(s,r,'s04_note_edit',p,jsonb_build_object('handover_id',h,'version',ev+1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_edit(uuid,uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_ack(s uuid,h uuid,mid uuid,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();IF mid IS DISTINCT FROM a THEN RAISE EXCEPTION 'access_denied';END IF;
 SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h;IF NOT FOUND OR NOT workspace_private.s04_target(s,h,n.content_revision)THEN RAISE EXCEPTION 'access_denied';END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,a,e,ev,n.content_revision));v:=workspace_private.receipt(s,r,'s04_note_ack',p);IF v IS NOT NULL THEN RETURN v;END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 INSERT INTO workspace.handover_acknowledgements(school_id,handover_id,revision,membership_id,epoch)VALUES(s,h,n.content_revision,a,e)ON CONFLICT DO NOTHING;
 RETURN workspace_private.finish(s,r,'s04_note_ack',p,jsonb_build_object('acknowledged',true,'revision',n.content_revision),h);END$$;
ALTER FUNCTION workspace_private.s04_note_ack(uuid,uuid,uuid,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_complete(s uuid,h uuid,done boolean,ev bigint,r uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE n workspace.handover_notes;a uuid;e integer;p jsonb;v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT *INTO n FROM workspace.handover_notes WHERE school_id=s AND handover_id=h FOR UPDATE;
 IF NOT FOUND OR NOT workspace_private.s04_completable(s,h,n.content_revision) OR done IS NULL OR(NOT done AND NOT workspace_private.admin(s))THEN RAISE EXCEPTION 'access_denied';END IF;
 p:=workspace_private.s03_hash(jsonb_build_array(h,done,ev,n.content_revision));v:=workspace_private.receipt(s,r,'s04_note_complete',p);IF v IS NOT NULL THEN RETURN v;END IF;IF n.version IS DISTINCT FROM ev THEN RAISE EXCEPTION 'conflict';END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=s AND actor_id=workspace_private.actor();
 UPDATE workspace.handover_notes SET status=CASE WHEN done THEN 'COMPLETED' ELSE 'OPEN' END,completed_at=CASE WHEN done THEN clock_timestamp() ELSE NULL END,completed_by=CASE WHEN done THEN a ELSE NULL END,completed_by_epoch=CASE WHEN done THEN e ELSE NULL END,version=version+1,updated_by=a,updated_by_epoch=e,updated_at=clock_timestamp()WHERE school_id=s AND handover_id=h;
 RETURN workspace_private.finish(s,r,'s04_note_complete',p,jsonb_build_object('handover_id',h,'version',ev+1),h);END$$;
ALTER FUNCTION workspace_private.s04_note_complete(uuid,uuid,boolean,bigint,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_note_history(s uuid,h uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);PERFORM workspace_private.s04_note_get(s,h);
 SELECT coalesce(jsonb_agg(to_jsonb(q)ORDER BY version DESC),'[]')INTO v FROM(SELECT r.version,r.title,r.body,r.created_at,m.member_code FROM workspace.handover_revisions r JOIN workspace.school_memberships m ON m.school_id=r.school_id AND m.id=r.actor_id WHERE r.school_id=s AND r.handover_id=h ORDER BY version DESC LIMIT 50)q;RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_note_history(uuid,uuid)OWNER TO ws_runtime;
CREATE FUNCTION workspace_private.s04_context(s uuid)RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$DECLARE v jsonb;BEGIN
 PERFORM workspace_private.s04_enter(s);SELECT jsonb_build_object('membership_id',m.id,'epoch',m.epoch,'role',m.role,'can_create_handover',workspace_private.s04_create_allowed(s),'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'epoch',x.epoch,'member_code',x.member_code,'role',x.role)ORDER BY x.member_code),'[]')FROM workspace.school_memberships x WHERE x.school_id=s AND workspace_private.s03_valid_epoch(s,x.id)=x.epoch))INTO v FROM workspace.school_memberships m WHERE m.school_id=s AND m.actor_id=workspace_private.actor();RETURN v;END$$;
ALTER FUNCTION workspace_private.s04_context(uuid)OWNER TO ws_runtime;
-- Fixed identity/version stamps also protect internal runtime writes.
CREATE FUNCTION workspace_private.s04_guard()RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE a uuid;e integer;BEGIN
 IF TG_TABLE_NAME='shared_events' THEN
 IF NEW.school_id<>OLD.school_id OR NEW.event_id<>OLD.event_id OR NEW.created_by<>OLD.created_by OR NEW.created_by_epoch<>OLD.created_by_epoch OR NEW.created_at<>OLD.created_at OR NOT workspace_private.s04_manage(OLD.school_id)THEN RAISE EXCEPTION 'access_denied';END IF;
 ELSE
 IF NEW.school_id<>OLD.school_id OR NEW.handover_id<>OLD.handover_id OR NEW.created_by<>OLD.created_by OR NEW.created_by_epoch<>OLD.created_by_epoch OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'access_denied';END IF;
 IF NEW.content_revision<>OLD.content_revision THEN IF NOT workspace_private.s04_editable(OLD.school_id,OLD.handover_id)OR NEW.content_revision<>OLD.version+1 THEN RAISE EXCEPTION 'access_denied';END IF;
 ELSE IF NOT workspace_private.s04_completable(OLD.school_id,OLD.handover_id,OLD.content_revision)THEN RAISE EXCEPTION 'access_denied';END IF;END IF;
 END IF;
 SELECT id,epoch INTO a,e FROM workspace.school_memberships WHERE school_id=OLD.school_id AND actor_id=workspace_private.actor();NEW.updated_by:=a;NEW.updated_by_epoch:=e;NEW.updated_at:=clock_timestamp();NEW.version:=OLD.version+1;RETURN NEW;END$$;
ALTER FUNCTION workspace_private.s04_guard()OWNER TO ws_runtime;
CREATE TRIGGER s04_events_identity BEFORE UPDATE ON workspace.shared_events FOR EACH ROW EXECUTE FUNCTION workspace_private.s04_guard();
CREATE TRIGGER s04_notes_identity BEFORE UPDATE ON workspace.handover_notes FOR EACH ROW EXECUTE FUNCTION workspace_private.s04_guard();
DO $$DECLARE x record;BEGIN FOR x IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' AND p.proname LIKE 's04_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ws_runtime',x.sig);END LOOP;END$$;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_list(uuid,timestamptz,timestamptz)TO authenticated;
CREATE FUNCTION public.ws_v1_list_events(p_school_id uuid,p_from timestamptz,p_to timestamptz)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_list(p_school_id,p_from,p_to)$$;
ALTER FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_get(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_event(p_school_id uuid,p_event_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_get(p_school_id,p_event_id)$$;
ALTER FUNCTION public.ws_v1_get_event(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_event(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_event(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_save(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_save_event(p_school_id uuid,p_event_id uuid,p_title text,p_description text,p_start_at timestamptz,p_end_at timestamptz,p_all_day boolean,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_save(p_school_id,p_event_id,p_title,p_description,p_start_at,p_end_at,p_all_day,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_save_event(uuid,uuid,text,text,timestamptz,timestamptz,boolean,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_cancel(uuid,uuid,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_cancel_event(p_school_id uuid,p_event_id uuid,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_cancel(p_school_id,p_event_id,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_cancel_event(uuid,uuid,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_event_history(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_event_history(p_school_id uuid,p_event_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_event_history(p_school_id,p_event_id)$$;
ALTER FUNCTION public.ws_v1_list_event_history(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_event_history(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_event_history(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_list(uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_handovers(p_school_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_list(p_school_id)$$;
ALTER FUNCTION public.ws_v1_list_handovers(uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_handovers(uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_handovers(uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_get(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_handover(p_school_id uuid,p_handover_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_get(p_school_id,p_handover_id)$$;
ALTER FUNCTION public.ws_v1_get_handover(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_handover(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_handover(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_create(uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_create_handover(p_school_id uuid,p_title text,p_body text,p_member_ids uuid[],p_target_roles text[],p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_create(p_school_id,p_title,p_body,p_member_ids,p_target_roles,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_edit(uuid,uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_edit_handover(p_school_id uuid,p_handover_id uuid,p_title text,p_body text,p_member_ids uuid[],p_target_roles text[],p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_edit(p_school_id,p_handover_id,p_title,p_body,p_member_ids,p_target_roles,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_ack(uuid,uuid,uuid,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_ack_handover(p_school_id uuid,p_handover_id uuid,p_membership_id uuid,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_ack(p_school_id,p_handover_id,p_membership_id,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_complete(uuid,uuid,boolean,bigint,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_complete_handover(p_school_id uuid,p_handover_id uuid,p_completed boolean,p_expected_version bigint,p_request_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_complete(p_school_id,p_handover_id,p_completed,p_expected_version,p_request_id)$$;
ALTER FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_note_history(uuid,uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_list_handover_history(p_school_id uuid,p_handover_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_note_history(p_school_id,p_handover_id)$$;
ALTER FUNCTION public.ws_v1_list_handover_history(uuid,uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_list_handover_history(uuid,uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_list_handover_history(uuid,uuid)TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.s04_context(uuid)TO authenticated;
CREATE FUNCTION public.ws_v1_get_activity_context(p_school_id uuid)RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT workspace_private.s04_context(p_school_id)$$;
ALTER FUNCTION public.ws_v1_get_activity_context(uuid)OWNER TO ws_owner;
REVOKE ALL ON FUNCTION public.ws_v1_get_activity_context(uuid)FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ws_v1_get_activity_context(uuid)TO authenticated;

RESET ROLE;

$ws06_payload$;
FOR f IN SELECT p.oid,p.proowner,p.oid::regprocedure sig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[]))LOOP
 FOR acl_item IN SELECT DISTINCT e.grantee FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))e WHERE e.grantee<>f.proowner AND e.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.sig,CASE WHEN acl_item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl_item.grantee))END);END LOOP;
 END LOOP;
SET LOCAL ROLE ws_owner;
FOR f IN SELECT p.oid,p.prosrc,p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[])LOOP
 target:=(regexp_match(f.prosrc,'workspace_private[.]([a-zA-Z0-9_]+)'))[1];
 SELECT p.oid INTO private_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'AND p.proname=target;
 IF private_oid IS NULL THEN RAISE EXCEPTION 'rpc_chain_manifest_unresolved';END IF;
 INSERT INTO workspace_private.s06_rpc_manifest VALUES(f.sig,private_oid::regprocedure::text,'ws_owner',pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid=private_oid)));
END LOOP;
INSERT INTO workspace_private.s06_install_manifest(phase,digest,state)VALUES('core','92c6268eee5944e733132515b2fcd7895739c00c174a2dfc348ec891e283400a','closed');
RESET ROLE;
UPDATE workspace_private.s06_install_manifest SET fingerprint=(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[]))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q),closed_fingerprint=(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY(ARRAY['ws_c_membership_status','ws_s02_admin','ws_s02_directory','ws_s02_expiry','ws_s02_self','ws_s02_space','ws_s02_transfers','ws_s02_withdraw','ws_v1_accept_admin_change','ws_v1_ack_handover','ws_v1_assign_task','ws_v1_bootstrap','ws_v1_cancel_event','ws_v1_change_assigned_task_status','ws_v1_close_task','ws_v1_complete_handover','ws_v1_create_handover','ws_v1_create_task','ws_v1_decide_join','ws_v1_edit_handover','ws_v1_edit_task','ws_v1_get_activity_context','ws_v1_get_context','ws_v1_get_event','ws_v1_get_handover','ws_v1_get_task','ws_v1_leave_school','ws_v1_list_event_history','ws_v1_list_events','ws_v1_list_handover_history','ws_v1_list_handovers','ws_v1_list_task_history','ws_v1_list_tasks','ws_v1_propose_admin_change','ws_v1_request_join','ws_v1_revoke_current_session','ws_v1_save_event','ws_v1_set_member_role','ws_v1_set_membership_state']::text[]))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q)WHERE phase='core';
END $core$;
COMMIT;
