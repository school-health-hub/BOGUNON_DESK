-- Future authorized postinstall metadata check only; does NOT activate functions or call business RPC.
BEGIN READ ONLY;
SELECT n.nspname,count(*) AS tables,bool_and(c.relrowsecurity AND c.relforcerowsecurity) AS all_force_rls,
 bool_and(pg_get_userbyid(c.relowner)='ws_owner') AS owner_contract
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r' GROUP BY n.nspname;
SELECT count(*) AS public_ws_count,
 count(*) FILTER(WHERE left(p.proname,6)='ws_v1_') AS v1_count,
 bool_and(NOT p.prosecdef) AS all_invokers,
 bool_and(NOT has_function_privilege('authenticated',p.oid,'EXECUTE')) AS authenticated_closed,
 bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE')) AS anon_closed,
 bool_and(NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) AS public_closed
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_';
SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'AND(p.prosecdef OR has_function_privilege('authenticated',p.oid,'EXECUTE'))ORDER BY 1;
COMMIT;
