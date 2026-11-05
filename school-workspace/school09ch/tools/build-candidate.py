"""Reuse unchanged09C function bodies, correct only installer execution roles."""
from pathlib import Path
import re,hashlib,json
E=Path(__file__).resolve().parents[1];orig=(E.parent/'school09c/sql/auth-bridge.sql').read_text();s=orig
anchor='CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;'
assert s.count(anchor)==1;s=s.replace(anchor,anchor+'\nSET LOCAL ROLE supabase_auth_admin;',1)
anchor='RESET ROLE;\nCREATE OR REPLACE FUNCTION workspace_private.session_ok()'
assert s.count(anchor)==1;s=s.replace(anchor,'''RESET ROLE;
SET LOCAL ROLE ws_owner;
GRANT CREATE ON SCHEMA workspace_private TO ws_authz_reader;
RESET ROLE;
SET LOCAL ROLE ws_authz_reader;
CREATE OR REPLACE FUNCTION workspace_private.session_ok()''',1)
s+='''
RESET ROLE;
SET LOCAL ROLE ws_owner;
REVOKE CREATE ON SCHEMA workspace_private FROM ws_authz_reader;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['ws_owner','ws_runtime','ws_authz_reader','authenticated','anon'])r WHERE has_any_column_privilege(r,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname='sessions'),'SELECT'))THEN RAISE EXCEPTION 'raw_auth_select_forbidden';END IF;
 IF has_schema_privilege('ws_authz_reader','workspace_private','CREATE')THEN RAISE EXCEPTION 'temporary_schema_create_not_removed';END IF;
END$$;
-- END AUTH INSTALL BOUNDARY
COMMIT;
'''
pattern=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\).*?AS \$\$(.*?)\$\$;'
a=dict(re.findall(pattern,orig,re.S));b=dict(re.findall(pattern,s,re.S));assert len(a)==4 and a==b
(E/'sql/auth-install-local.sql').write_text((E/'sql/local-install-guard.sql').read_text()+s)
(E/'reference/body-contract.json').write_text(json.dumps({'prior_source':'a16245d878784aa2bdb06e2a339356956f9720e5','prior_auth_sql_sha256':hashlib.sha256(orig.encode()).hexdigest(),'unchanged_function_bodies':{n:hashlib.sha256(body.encode()).hexdigest()for n,body in a.items()},'changes':['schema ACL commands run as Auth schema owner','replace private helpers as existing reader owner','temporary reader CREATE inside transaction then revoke','preflight SET/session/database/CLOSED gates'],'hosted':'NOT RUN'},indent=2))
print('PASS four09C function bodies unchanged; LOCAL-only installation-role candidate generated')
