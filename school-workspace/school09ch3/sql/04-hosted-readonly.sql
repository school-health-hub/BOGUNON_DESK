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
