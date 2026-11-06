\set ON_ERROR_STOP on
SET bogunon.ws_install_mode='isolated';
DO $$BEGIN IF current_database()<>'school01a'OR current_user<>session_user THEN RAISE EXCEPTION 's08_local_direct_only';END IF;END$$;
SELECT to_regclass('workspace_private.s08_release')IS NOT NULL AS s08_present \gset
\if :s08_present
\ir ../supabase/migrations/20261105130003_cumulative_workspace.sql
\else
\ir 01-foundation.sql
\ir ../supabase/migrations/20261105130003_cumulative_workspace.sql
\endif
