-- Catalog-only installed-object inventory. No application rows or secrets.
SELECT jsonb_build_object(
 'classification','LOCAL DB when collected by run-local; not Hosted',
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)ORDER BY n.nspname,c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text)ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'OR(n.nspname='public'AND left(p.proname,3)='ws_')),
 'policies',(SELECT jsonb_agg(to_jsonb(p)ORDER BY schemaname,tablename,policyname)FROM pg_policies p WHERE schemaname IN('workspace','workspace_private')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls)ORDER BY rolname)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')),
 'foreign_keys',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))ORDER BY c.conrelid::regclass::text,c.conname)FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')AND c.contype='f')
);
