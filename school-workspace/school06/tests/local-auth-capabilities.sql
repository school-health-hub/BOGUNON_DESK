-- TEST FIXTURE ONLY. Not an operating migration or authorization to change Auth.
BEGIN;
DO $$BEGIN IF current_database()<>'school01a' OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated' THEN RAISE EXCEPTION 'isolated_fixture_required';END IF;END$$;
SET LOCAL ROLE supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO ws_owner,ws_runtime,ws_authz_reader;
GRANT REFERENCES(id)ON auth.users TO ws_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO ws_runtime,ws_authz_reader;
GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO ws_authz_reader;
RESET ROLE;
COMMIT;
