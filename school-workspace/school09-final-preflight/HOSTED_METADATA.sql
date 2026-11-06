SELECT jsonb_build_object(
'observed_at',clock_timestamp(),'identity',current_user,'version',current_setting('server_version'),
'public_tables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
'public_policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public'),
'public_definers',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef),
'ws_schemas',(SELECT coalesce(jsonb_agg(nspname),'[]'::jsonb) FROM pg_namespace WHERE nspname IN ('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap')),
'ws_roles',(SELECT coalesce(jsonb_agg(rolname),'[]'::jsonb) FROM pg_roles WHERE rolname LIKE 'ws_%'),
'public_ws_objects',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND left(proname,3)='ws_'),
'public_relation_ws_collisions',(SELECT coalesce(jsonb_agg(relname),'[]'::jsonb) FROM pg_class WHERE relnamespace='public'::regnamespace AND left(relname,3)='ws_'),
'installer',jsonb_build_object('super',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user),'createrole',(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user),'db_create',has_database_privilege(current_user,current_database(),'CREATE'),'public_create_grant',has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION'),'auth_create',has_schema_privilege(current_user,'auth','CREATE'),'auth_owner_set',pg_has_role(current_user,'supabase_auth_admin','SET'),'auth_usage',has_schema_privilege(current_user,'auth','USAGE'),'users_id_references',has_column_privilege(current_user,'auth.users','id','REFERENCES'),'sessions_select',has_table_privilege(current_user,'auth.sessions','SELECT'),'authenticated_sessions_select',has_table_privilege('authenticated','auth.sessions','SELECT')),
'baseline_catalog_hash',(SELECT md5(string_agg(p.oid::regprocedure::text||md5(pg_get_functiondef(p.oid)),'|' ORDER BY p.oid::regprocedure::text)) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'),
'data_api_role_settings',(SELECT coalesce(jsonb_agg(v.setting),'[]'::jsonb) FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig)v(setting) WHERE r.rolname='authenticator' AND (v.setting LIKE 'pgrst.db_schemas=%' OR v.setting LIKE 'pgrst.db_extra_search_path=%'))
) AS metadata;
