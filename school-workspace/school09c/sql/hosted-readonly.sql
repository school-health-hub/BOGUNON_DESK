-- Supplemental SCHOOL09C metadata only. Combine with SCHOOL09 sql/hosted-readonly.sql.
-- No Auth/user/session rows, keys, DDL or GRANT. Execute only by authorized ChatGPT READ-ONLY audit.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS pg_version,current_user AS observer;
SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text
 FROM pg_namespace WHERE nspname IN('auth','workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap');
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,
 pg_has_role(current_user,oid,'SET') AS observer_can_set_role,
 has_database_privilege(oid,current_database(),'CREATE') AS db_create
 FROM pg_roles WHERE rolname IN('supabase_auth_admin','postgres','ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator');
SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text,
 md5(pg_get_functiondef(p.oid)) AS definition_fingerprint
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('workspace_auth_bridge','workspace_bootstrap')OR(n.nspname='auth'AND p.proname IN('uid','jwt'));
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,
 a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attacl::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE n.nspname='auth'AND c.relname IN('users','sessions')AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT r.rolname,n.nspname,c.relname,a.attname,has_column_privilege(r.oid,c.oid,a.attnum,'SELECT')AS can_select,
 has_column_privilege(r.oid,c.oid,a.attnum,'REFERENCES')AS can_reference,
 has_column_privilege(r.oid,c.oid,a.attnum,'SELECT WITH GRANT OPTION')AS can_grant_select
 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE r.rolname IN('supabase_auth_admin','ws_owner','ws_runtime','ws_authz_reader',current_user)
 AND n.nspname='auth'AND c.relname IN('users','sessions')AND a.attnum>0 AND NOT a.attisdropped;
-- A reported SET=true is necessary, not proof that managed policy allows installing an Auth-owned function.
-- Provider/redirect/Data API actual settings and service support constraints require separate read-only evidence.
SELECT d.defaclrole::regrole::text AS creator,coalesce(n.nspname,'*')AS schema,d.defaclobjtype,d.defaclacl::text
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclobjtype='f'AND d.defaclrole IN(SELECT oid FROM pg_roles WHERE rolname IN('supabase_auth_admin','postgres','ws_owner'));
COMMIT;
