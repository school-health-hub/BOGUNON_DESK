-- For ChatGPT READ-ONLY audit only; no user/session rows, settings secrets, or DDL.
-- Run with authorized metadata access; a permission error is NOT VERIFIED, never bypass it.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS version, current_database() AS database,
 current_user AS observer, (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_rls,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef) AS public_definers;
SELECT nspname, pg_get_userbyid(nspowner) AS owner, nspacl::text AS acl FROM pg_namespace
 WHERE nspname IN('auth','public','extensions','workspace','workspace_private') ORDER BY nspname;
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication
 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','authenticated','anon','authenticator','supabase_auth_admin');
SELECT pg_get_userbyid(roleid) AS granted_role,pg_get_userbyid(member) AS member,
 admin_option,inherit_option,set_option FROM pg_auth_members
 WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','authenticated','anon','authenticator'));
-- Name/signature collision. Includes all ws_ names (54 includes eight compatibility names).
SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,
 md5(pg_get_functiondef(p.oid)) AS definition_fingerprint,p.proacl::text AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('workspace','workspace_private') OR(n.nspname='public' AND(left(p.proname,3)='ws_' OR p.prosecdef)) ORDER BY 1;
-- Auth structure only. Exact four-column reader grant viability must be established by owner/support separately.
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,
 a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attacl::text AS column_acl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE n.nspname='auth' AND c.relname IN('users','sessions') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text,
 md5(pg_get_functiondef(p.oid)) AS definition_fingerprint FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='auth' AND p.proname IN('uid','jwt');
-- Missing roles are handled by OID joins, not failing has_*('missing_role',...) calls.
SELECT r.rolname, n.nspname,c.relname,a.attname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_column_privilege(r.oid,c.oid,a.attnum,'SELECT') AS select_allowed,
 has_column_privilege(r.oid,c.oid,a.attnum,'SELECT WITH GRANT OPTION') AS grantable_select,
 has_column_privilege(r.oid,c.oid,a.attnum,'REFERENCES') AS references_allowed
 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 WHERE r.rolname IN('ws_owner','ws_runtime','ws_authz_reader','authenticated','anon',current_user)
 AND n.nspname='auth' AND c.relname IN('users','sessions') ORDER BY r.rolname,c.relname,a.attnum;
-- Safe projection: only API schema/search-path settings; never jwt-secret/app secrets.
SELECT coalesce(d.datname,'*') AS database,coalesce(r.rolname,'*') AS role,s.setting
 FROM pg_db_role_setting x LEFT JOIN pg_database d ON d.oid=x.setdatabase LEFT JOIN pg_roles r ON r.oid=x.setrole
 CROSS JOIN LATERAL unnest(x.setconfig)s(setting)
 WHERE split_part(s.setting,'=',1) IN('pgrst.db_schemas','pgrst.db_extra_search_path','pgrst.db_pre_request');
-- DB settings do not establish actual hosted gateway config. Dashboard Data API read-only evidence is still required.
SELECT defaclrole::regrole::text,coalesce(n.nspname,'*') AS schema,defaclobjtype,defaclacl::text
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE defaclobjtype='f' AND(n.nspname IN('public','workspace','workspace_private')OR d.defaclnamespace=0);
-- Do not export old function source blindly: definitions may contain secrets. Catalog dependencies are incomplete for PL/pgSQL/dynamic SQL.
SELECT p.oid::regprocedure::text AS signature,
 p.prosrc ~* 'workspace|ws_runtime|ws_authz_reader|EXECUTE|set_config|SET[[:space:]]+ROLE' AS needs_manual_reachability_review
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef;
COMMIT;
