-- TEST ONLY: not Supabase Auth; trusted JWT claims are supplied by the test harness.
-- No external endpoints or credentials. Never run on an existing database.
DO $$ BEGIN
 IF current_database() <> 'school01a' THEN RAISE EXCEPTION 'synthetic_database_required'; END IF;
END $$;
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE school_client LOGIN NOINHERIT NOBYPASSRLS;
GRANT authenticated TO school_client;
CREATE ROLE school_anon LOGIN NOINHERIT NOBYPASSRLS;
GRANT anon TO school_anon;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
 SET search_path='' AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
 SET search_path='' AS $$ SELECT NULLIF(auth.jwt()->>'sub','')::uuid $$;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(),auth.uid() TO anon,authenticated;
