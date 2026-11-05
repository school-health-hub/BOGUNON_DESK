-- TEST ONLY: no Hosted activation; no parent manifest rewriting.
BEGIN;
DO $$DECLARE f record;BEGIN
 IF current_database()<>'school01a'OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 's09c_isolated_required';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['ws_runtime','ws_authz_reader','authenticated','anon'])r WHERE has_any_column_privilege(r,'auth.sessions','SELECT'))THEN RAISE EXCEPTION 'auth_raw_select_forbidden';END IF;
 FOR f IN SELECT *FROM workspace_private.s08_rpc_manifest LOOP
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s,%s TO authenticated',f.public_signature,f.private_signature);
 END LOOP;
 GRANT EXECUTE ON FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)TO ws_bootstrap_operator;
END$$;
COMMIT;
