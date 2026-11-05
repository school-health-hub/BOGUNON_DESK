-- SCHOOL09C-H: authorized ChatGPT Hosted metadata audit only. No application/Auth rows or secrets.
-- Run through the intended migration execution channel when available; record observer != intended installer.
BEGIN READ ONLY;
-- Q1: who would own CREATE, and whose membership governs SET ROLE? BYPASSRLS is not ownership.
SELECT current_setting('server_version')AS pg_version,current_database()AS db,
 current_user AS observer_current_user,session_user AS observer_session_user,current_role AS observer_current_role,
 current_setting('role',true)AS active_role_setting,
 has_database_privilege(current_user,current_database(),'CREATE')AS current_db_create,
 has_database_privilege(session_user,current_database(),'CREATE')AS session_db_create;
-- Q2: effective memberships. Missing Workspace roles are missing prerequisites, not successful grants.
SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcanlogin,r.rolinherit,r.rolcreatedb,r.rolcreaterole,
 pg_has_role(current_user,r.oid,'MEMBER')AS current_member,
 pg_has_role(current_user,r.oid,'USAGE')AS current_inherited_privileges,
 pg_has_role(current_user,r.oid,'SET')AS current_can_set,
 pg_has_role(session_user,r.oid,'MEMBER')AS session_member,
 pg_has_role(session_user,r.oid,'USAGE')AS session_inherited_privileges,
 pg_has_role(session_user,r.oid,'SET')AS session_can_set,
 has_database_privilege(r.oid,current_database(),'CREATE')AS role_db_create
 FROM pg_roles r WHERE r.rolname IN('postgres','supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader','authenticated','anon')
 ORDER BY r.rolname;
-- Q3: postgres facts do not automatically describe the actual installer/SQL Editor session.
SELECT r.rolname AS tested_identity,t.rolname AS target,
 pg_has_role(r.oid,t.oid,'MEMBER')AS member,pg_has_role(r.oid,t.oid,'USAGE')AS inherited,
 pg_has_role(r.oid,t.oid,'SET')AS can_set
 FROM pg_roles r CROSS JOIN pg_roles t
 WHERE r.rolname IN('postgres',current_user,session_user)
 AND t.rolname IN('supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader');
-- Q4: direct membership options. pg_has_role above includes effective transitive paths.
SELECT pg_get_userbyid(a.roleid)AS role,pg_get_userbyid(a.member)AS member,
 pg_get_userbyid(a.grantor)AS grantor,a.admin_option,a.inherit_option,a.set_option
 FROM pg_auth_members a
 WHERE a.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader'))
 OR a.member IN(SELECT oid FROM pg_roles WHERE rolname IN('postgres',current_user,session_user));
-- Q5: ownership, RLS, effective schema/table AND column access. SELECT true is not proof of rows visible under FORCE RLS.
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner)AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,
 r.rolname,has_schema_privilege(r.oid,n.oid,'USAGE')AS schema_usage,
 has_table_privilege(r.oid,c.oid,'SELECT')AS table_select,
 has_any_column_privilege(r.oid,c.oid,'SELECT')AS any_column_select
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
 WHERE n.nspname='auth'AND c.relname IN('users','sessions')
 AND r.rolname IN('supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader','authenticated','anon',current_user)
 ORDER BY c.relname,r.rolname;
SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod)AS column_type,a.attacl::text,
 r.rolname,has_column_privilege(r.oid,c.oid,a.attnum,'SELECT')AS can_select,
 has_column_privilege(r.oid,c.oid,a.attnum,'REFERENCES')AS can_reference
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid CROSS JOIN pg_roles r
 WHERE n.nspname='auth'AND((c.relname='sessions'AND a.attname IN('id','user_id','created_at','not_after'))OR(c.relname='users'AND a.attname='id'))
 AND a.attnum>0 AND NOT a.attisdropped AND r.rolname IN('supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader',current_user);
-- Q6: session/user FK cleanup semantics (CASCADE/NO ACTION/SET NULL); no row reads.
SELECT c.conrelid::regclass::text AS table_name,c.confrelid::regclass::text AS referenced_table,
 c.conname,c.contype,c.confdeltype,c.convalidated,pg_get_constraintdef(c.oid)AS definition
 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
 WHERE n.nspname='auth'AND c.contype='f'AND(c.conrelid=(SELECT x.oid FROM pg_class x JOIN pg_namespace z ON z.oid=x.relnamespace WHERE z.nspname='auth'AND x.relname='sessions')OR c.confrelid=(SELECT x.oid FROM pg_class x JOIN pg_namespace z ON z.oid=x.relnamespace WHERE z.nspname='auth'AND x.relname='users'));
-- Q7: name collisions and schema ownership/CREATE ACL. No function source export.
SELECT n.nspname,pg_get_userbyid(n.nspowner)AS owner,n.nspacl::text,
 has_schema_privilege(current_user,n.oid,'CREATE')AS observer_create
 FROM pg_namespace n WHERE n.nspname IN('auth','public','workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap');
SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner)AS owner,p.prosecdef,p.proconfig,p.proacl::text,
 md5(pg_get_functiondef(p.oid))AS definition_fingerprint
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE(n.nspname='auth'AND p.proname IN('uid','jwt'))
 OR n.nspname IN('workspace_auth_bridge','workspace_private','workspace_bootstrap')
 OR(n.nspname='public'AND left(p.proname,3)='ws_') ORDER BY 1;
-- Q8: existing Auth-owned objects outside auth are NOT approval to create new ones; inventory only.
SELECT n.nspname,p.oid::regprocedure::text AS signature,p.prosecdef,p.proconfig,p.proacl::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.proowner IN(SELECT oid FROM pg_roles WHERE rolname='supabase_auth_admin')AND n.nspname<>'auth';
-- Q9: default EXECUTE grants require same-transaction cleanup, including non-PUBLIC grantees.
SELECT pg_get_userbyid(d.defaclrole)AS creator,coalesce(n.nspname,'*')AS schema,d.defaclobjtype,d.defaclacl::text
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclobjtype='f'AND d.defaclrole IN(SELECT oid FROM pg_roles WHERE rolname IN('postgres','supabase_auth_admin','ws_owner','ws_authz_reader'));
-- Q10: safe Data API config projections only. External gateway/dashboard config still NOT VERIFIED.
SELECT coalesce(d.datname,'*')AS db,coalesce(r.rolname,'*')AS role,x.setting
 FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase LEFT JOIN pg_roles r ON r.oid=s.setrole
 CROSS JOIN LATERAL unnest(s.setconfig)x(setting)
 WHERE split_part(x.setting,'=',1)IN('pgrst.db_schemas','pgrst.db_extra_search_path','pgrst.db_pre_request');
COMMIT;
