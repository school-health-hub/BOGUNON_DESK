-- READ ONLY catalog inspection. Does not select Auth/session/application rows.
SELECT jsonb_build_object(
 'classification','READ ONLY metadata; no Hosted compatibility assertion',
 'observed_at',clock_timestamp(),
 'postgres_version',version(),
 'database',current_database(),
 'migration_identity',jsonb_build_object('current',current_user,'session',session_user,'same',current_user=session_user),
 'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',nspname,'owner',pg_get_userbyid(nspowner))),'[]')FROM pg_namespace WHERE nspname IN('workspace','workspace_private','auth')),
 'workspace_roles',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',rolname,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole)),'[]')FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')),
 'auth_tables',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'caller_id_select',has_column_privilege(current_user,c.oid,'id','SELECT'),'caller_id_grant_option',has_column_privilege(current_user,c.oid,'id','SELECT WITH GRANT OPTION')))FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions')),
 'auth_columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod)))FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='auth'AND c.relname IN('users','sessions')AND a.attnum>0 AND NOT a.attisdropped),
 'public_rls_policy_count',(SELECT count(*)FROM pg_policies WHERE schemaname='public'),
 'public_definers',(SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'settings',p.proconfig,'definition_hash',md5(pg_get_functiondef(p.oid)),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'))),'[]')FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.prosecdef),
 'public_workspace_names',(SELECT coalesce(jsonb_agg(p.oid::regprocedure::text),'[]')FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname LIKE 'ws\_%'ESCAPE '\'),
 'authenticated_public_usage',has_schema_privilege('authenticated','public','USAGE'),
 'current_database_schema_public_create',has_schema_privilege(current_user,'public','CREATE'));
