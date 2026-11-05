-- LOCAL ONLY Auth-boundary feasibility probe. NOT a Hosted/fresh cumulative migration.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$DECLARE r text;BEGIN
 IF current_database()<>'school01a'OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 'isolated_probe_required';END IF;
 IF current_user<>session_user THEN RAISE EXCEPTION 'direct_install_identity_required';END IF;
 IF to_regnamespace('workspace_auth_bridge')IS NOT NULL THEN RAISE EXCEPTION 'auth_bridge_collision';END IF;
 FOREACH r IN ARRAY ARRAY['supabase_auth_admin','ws_owner','ws_authz_reader']LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r)THEN RAISE EXCEPTION 'role_prerequisite_missing';END IF;
 IF NOT pg_has_role(session_user,r,'SET')THEN RAISE EXCEPTION 'role_set_capability_required:%',r;END IF;
 END LOOP;
 IF NOT has_database_privilege(current_user,current_database(),'CREATE')THEN RAISE EXCEPTION 'database_create_required';END IF;
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s08_release WHERE state='closed')THEN RAISE EXCEPTION 'closed_baseline_required';END IF;
 IF(SELECT count(*)FROM workspace_private.s08_rpc_manifest)<>54 OR EXISTS(SELECT 1 FROM workspace_private.s08_rpc_manifest m WHERE has_function_privilege('authenticated',m.public_signature,'EXECUTE')OR has_function_privilege('authenticated',m.private_signature,'EXECUTE')OR has_function_privilege('anon',m.public_signature,'EXECUTE'))THEN RAISE EXCEPTION 'all54_closed_required';END IF;
 IF(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions'))<>2 THEN RAISE EXCEPTION 'auth_tables_missing';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname IN('users','sessions')AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname='supabase_auth_admin'))THEN RAISE EXCEPTION 'auth_owner_mismatch';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.oid=(SELECT x.oid FROM pg_class x JOIN pg_namespace z ON z.oid=x.relnamespace WHERE z.nspname='auth'AND x.relname='sessions') AND c.relforcerowsecurity AND NOT(r.rolsuper OR r.rolbypassrls))THEN RAISE EXCEPTION 'auth_force_rls_review_required';END IF;
END$$;
