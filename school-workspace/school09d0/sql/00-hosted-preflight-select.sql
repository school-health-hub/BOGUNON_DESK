-- SELECT metadata only. No session UUIDs, JWTs, rows, keys, DDL or GRANT.
SELECT current_user,session_user,current_setting('server_version') AS version;
SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolinherit FROM pg_roles WHERE rolname IN('postgres','supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader');
SELECT has_schema_privilege(current_user,'auth','USAGE')AS auth_usage,has_schema_privilege(current_user,'auth','CREATE')AS auth_create,
 pg_has_role(current_user,'supabase_auth_admin','SET')AS auth_owner_set,
 has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION')AS public_create_grant,
 has_database_privilege(current_user,current_database(),'CREATE')AS database_create,
 has_column_privilege(current_user,'auth.users','id','REFERENCES')AS users_id_reference;
SELECT a.attname,has_column_privilege(current_user,c.oid,a.attnum,'SELECT')AS installer_can_read FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname='sessions'AND a.attname IN('id','user_id','created_at','not_after');
SELECT pg_get_userbyid(n.nspowner)AS auth_schema_owner,n.nspacl FROM pg_namespace n WHERE n.nspname='auth';
SELECT c.relname,pg_get_userbyid(c.relowner)AS owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions');
SELECT p.proname,pg_get_userbyid(p.proowner)AS owner,p.prosecdef,p.proconfig,has_function_privilege(current_user,p.oid,'EXECUTE')AS installer_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth'AND p.proname IN('uid','jwt');
SELECT pg_get_constraintdef(oid)FROM pg_constraint WHERE conrelid='auth.sessions'::regclass AND contype='f';
SELECT nspname FROM pg_namespace WHERE nspname IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap');
SELECT p.proname,pg_get_function_identity_arguments(p.oid)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_';
-- Existing creator defaults can affect new tables/functions; metadata only.
SELECT pg_get_userbyid(d.defaclrole)AS creator,coalesce(n.nspname,'GLOBAL')AS schema_name,d.defaclobjtype,d.defaclacl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE pg_get_userbyid(d.defaclrole)='postgres';
-- Only allowlisted Data API settings, never role passwords/JWT secrets or unfiltered rolconfig.
SELECT r.rolname,v.setting FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig)v(setting)WHERE r.rolname='authenticator'AND(v.setting LIKE 'pgrst.db_schemas=%'OR v.setting LIKE 'pgrst.db_extra_search_path=%');
SELECT name,setting FROM pg_settings WHERE name IN('pgrst.db_schemas','pgrst.db_extra_search_path');
-- Current baseline counts, not an assertion that historical232/20 still holds.
SELECT 'public_rls_policies'AS kind,count(*)FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'public_security_definer',count(*)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef;
-- Literal reference flags are triage only: false does NOT rule out dynamic SQL/call-chain reachability.
SELECT p.proname,pg_get_function_identity_arguments(p.oid)AS arguments,pg_get_userbyid(p.proowner)AS owner,p.proconfig,
 md5(pg_get_functiondef(p.oid))AS definition_md5,has_function_privilege('authenticated',p.oid,'EXECUTE')AS authenticated_execute,
 position('workspace'IN lower(p.prosrc))>0 AS literal_workspace_reference,position('execute'IN lower(p.prosrc))>0 AS possible_dynamic_sql
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef ORDER BY p.proname;
