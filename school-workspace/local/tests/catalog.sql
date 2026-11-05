SELECT json_build_object(
 'version',version(),
 'roles',(SELECT json_agg(row_to_json(r)) FROM(SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))r),
 'tables',(SELECT json_agg(row_to_json(t)) FROM(SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace' AND c.relkind='r' ORDER BY c.relname)t),
 'functions',(SELECT json_agg(row_to_json(f)) FROM(SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public' AND p.proname LIKE 'ws_v1_%') ORDER BY n.nspname,p.proname)f),
 'policy_count',(SELECT count(*) FROM pg_policies WHERE schemaname='workspace'),
 'public_tables',(SELECT COALESCE(json_agg(c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'));
