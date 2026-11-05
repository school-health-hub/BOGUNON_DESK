"""Split A2 into independently authorized transactions; preserve all4 function bodies."""
from pathlib import Path
import json,re,hashlib
E=Path(__file__).resolve().parents[1];P=E.parent
src=(P/'school09c/sql/auth-bridge.sql').read_text()
cut=src.index('RESET ROLE;\nCREATE OR REPLACE FUNCTION workspace_private.session_ok()')
provider=src[:cut].replace('CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;','CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;\nSET LOCAL ROLE supabase_auth_admin;',1)
helper=src[cut+len('RESET ROLE;\n'):]
helper+="""
DO $$DECLARE f record;a record;BEGIN
 FOR f IN SELECT p.oid,p.proowner FROM pg_proc p WHERE p.oid IN('workspace_private.session_ok()'::regprocedure,'workspace_private.recent_login()'::regprocedure)LOOP
 FOR a IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f.oid AND x.grantee<>f.proowner AND x.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.oid::regprocedure,CASE WHEN a.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(a.grantee))END);
 END LOOP;END LOOP;
END$$;
"""
pat=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\).*?AS \$\$(.*?)\$\$;'
bodies=dict(re.findall(pat,src,re.S));assert len(bodies)==4
rows=json.loads((P/'school09/reference/rpc-signatures.json').read_text())
for r in rows:
 if not r['public_signature'].startswith('public.'):r['public_signature']='public.'+r['public_signature']
assert len(rows)==54
q=lambda x:"'"+x.replace("'","''")+"'"
values=','.join('('+q(r['public_signature'])+','+q(r['private_signature'])+')'for r in rows)
expected=f'(VALUES {values})'
closed="""IF(SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_')<>54 OR EXISTS(SELECT 1 FROM __EXPECTED__ e(pub,priv)LEFT JOIN LATERAL(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE format('%s.%s(%s)',n.nspname,p.proname,replace(oidvectortypes(p.proargtypes),', ',','))=e.pub)pu ON true LEFT JOIN LATERAL(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE format('%s.%s(%s)',n.nspname,p.proname,replace(oidvectortypes(p.proargtypes),', ',','))=e.priv)pr ON true WHERE pu.oid IS NULL OR pr.oid IS NULL OR has_function_privilege('authenticated',pu.oid,'EXECUTE')OR has_function_privilege('authenticated',pr.oid,'EXECUTE')OR has_function_privilege('anon',pu.oid,'EXECUTE')OR has_function_privilege('anon',pr.oid,'EXECUTE'))THEN RAISE EXCEPTION 'all54_closed_required';END IF;""".replace('__EXPECTED__',expected)
bridge_check="IF(SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_auth_bridge')<>2 OR NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='workspace_auth_bridge'AND pg_get_userbyid(n.nspowner)='supabase_auth_admin')THEN RAISE EXCEPTION 'bridge_missing_or_drift';END IF;"
for name in ['workspace_auth_bridge.session_valid','workspace_auth_bridge.recent_login']:
 h=hashlib.sha256(bodies[name].encode()).hexdigest()
 bridge_check+=f"IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname||'()'='{name}()'AND pg_get_userbyid(p.proowner)='supabase_auth_admin'AND p.prosecdef AND p.provolatile='s'AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=\"\"']AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='{h}')THEN RAISE EXCEPTION 'bridge_missing_or_drift';END IF;"
bridge_check+="""IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a WHERE n.nspname='workspace_auth_bridge'AND a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='ws_authz_reader')))THEN RAISE EXCEPTION 'bridge_acl_drift';END IF;
IF NOT has_schema_privilege('ws_authz_reader','workspace_auth_bridge','USAGE')OR has_schema_privilege('authenticated','workspace_auth_bridge','USAGE')OR has_schema_privilege('ws_runtime','workspace_auth_bridge','USAGE')THEN RAISE EXCEPTION 'bridge_schema_acl_drift';END IF;
IF EXISTS(SELECT 1 FROM unnest(ARRAY['ws_owner','ws_runtime','ws_authz_reader','authenticated','anon'])r WHERE has_any_column_privilege(r,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname='sessions'),'SELECT'))THEN RAISE EXCEPTION 'raw_auth_select_forbidden';END IF;"""
baseguard="""IF current_database()<>'school01a'OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 'isolated_only';END IF;
IF current_user<>session_user THEN RAISE EXCEPTION 'direct_identity_required';END IF;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND(rolsuper OR rolbypassrls))THEN RAISE EXCEPTION 'nonprivileged_installer_required';END IF;"""
base_catalog=json.loads((P/'school09c/evidence/catalog-active-workspace-scope.json').read_text())
baseline_guard="IF(SELECT count(*)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)<>3 THEN RAISE EXCEPTION 'workspace_role_contract_mismatch';END IF;IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r'AND(NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_get_userbyid(c.relowner)<>'ws_owner'))THEN RAISE EXCEPTION 'baseline_rls_drift';END IF;"
baseline_guard+="IF EXISTS(SELECT 1 FROM pg_roles c CROSS JOIN pg_roles t WHERE(c.rolname IN('anon','authenticated','authenticator','school_rest','school_client','school_anon')AND t.rolname IN('ws_owner','ws_runtime','ws_authz_reader','supabase_auth_admin')OR c.rolname='ws_runtime'AND t.rolname IN('ws_owner','ws_authz_reader','supabase_auth_admin')OR c.rolname IN('ws_owner','ws_authz_reader')AND t.rolname='supabase_auth_admin')AND pg_has_role(c.oid,t.oid,'MEMBER'))THEN RAISE EXCEPTION 'client_role_escalation_detected';END IF;"
for f in base_catalog['functions']:
 if f['schema']not in('public','workspace_private')or f['name']in('session_ok','recent_login'):continue
 sig=f['signature'];sig=('public.'+sig)if f['schema']=='public'and not sig.startswith('public.')else sig
 digest=hashlib.sha256(f['body'].encode()).hexdigest()
 baseline_guard+=f"IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE format('%s.%s(%s)',n.nspname,p.proname,replace(oidvectortypes(p.proargtypes),', ',','))={q(sig)}AND pg_get_userbyid(p.proowner)={q(f['owner'])}AND p.prosecdef={'true'if f['definer']else'false'} AND p.proconfig=ARRAY['search_path=\"\"']AND pg_get_function_result(p.oid)={q(f['returns'])}AND md5(pg_get_functiondef(p.oid))={q(f['definition_sha_marker'])}AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='{digest}')THEN RAISE EXCEPTION 'baseline_function_drift';END IF;"
owner_guard="IF NOT pg_has_role(session_user,'ws_owner','SET')OR NOT pg_has_role(session_user,'ws_authz_reader','SET')THEN RAISE EXCEPTION 'workspace_owner_context_required';END IF;"
header="-- LOCAL VALIDATED CANDIDATE ONLY; operating execution requires separate approval.\nBEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h2:install',0));\n"
provider_sql=header+'DO $install$ BEGIN '+baseguard+closed+baseline_guard+"IF NOT pg_has_role(session_user,'supabase_auth_admin','SET')OR NOT has_database_privilege(current_user,current_database(),'CREATE')THEN RAISE EXCEPTION 'provider_authority_required';END IF;"
provider_sql+="IF to_regnamespace('workspace_auth_bridge')IS NOT NULL THEN "+bridge_check+"RETURN;END IF;"
provider_sql+='EXECUTE $provider$'+provider+'$provider$;'+bridge_check+'END$install$;RESET ROLE;COMMIT;\n'
fp=(P/'school08/sql/fingerprint.sql').read_text().strip().rstrip(';')
fp=fp.replace("IN('workspace','workspace_private')","IN('workspace','workspace_private','workspace_auth_bridge')").replace("n.nspname='workspace_private' OR", "n.nspname IN('workspace_private','workspace_auth_bridge') OR").replace("IN('ws_owner','ws_runtime','ws_authz_reader')","IN('ws_owner','ws_runtime','ws_authz_reader','supabase_auth_admin')")
version=hashlib.sha256((src+fp+values+Path(__file__).read_text()+'split-installer-v1').encode()).hexdigest()
manifest_guard=f"""IF(SELECT count(*)FROM workspace_private.h2_rpc_manifest)<>54 OR EXISTS((SELECT *FROM workspace_private.h2_rpc_manifest)EXCEPT SELECT *FROM {expected}e(pub,priv))THEN RAISE EXCEPTION 'manifest_drift';END IF;"""
ledger="""CREATE TABLE workspace_private.h2_release(version text PRIMARY KEY,state text NOT NULL CHECK(state IN('closed','active','closed_unverified')),fingerprint text NOT NULL,closed_fingerprint text NOT NULL);
CREATE TABLE workspace_private.h2_rpc_manifest(public_signature text PRIMARY KEY,private_signature text NOT NULL);
ALTER TABLE workspace_private.h2_release ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.h2_release FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_private.h2_rpc_manifest ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.h2_rpc_manifest FORCE ROW LEVEL SECURITY;
CREATE POLICY h2_owner ON workspace_private.h2_release TO ws_owner USING(true)WITH CHECK(true);CREATE POLICY h2_owner ON workspace_private.h2_rpc_manifest TO ws_owner USING(true)WITH CHECK(true);
REVOKE ALL ON workspace_private.h2_release,workspace_private.h2_rpc_manifest FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;
"""
bind=header+'DO $bind$ BEGIN '+baseguard+owner_guard+bridge_check+baseline_guard+"SET LOCAL ROLE ws_owner;IF to_regclass('workspace_private.h2_release')IS NOT NULL THEN "+manifest_guard+f"IF NOT EXISTS(SELECT 1 FROM workspace_private.h2_release WHERE version='{version}'AND state IN('closed','active')AND fingerprint={fp})THEN RAISE EXCEPTION 'release_or_catalog_drift';END IF;RETURN;END IF;"+closed
bind+="GRANT CREATE ON SCHEMA workspace_private TO ws_authz_reader;RESET ROLE;SET LOCAL ROLE ws_authz_reader;EXECUTE $helpers$"+helper+'$helpers$;RESET ROLE;SET LOCAL ROLE ws_owner;REVOKE CREATE ON SCHEMA workspace_private FROM ws_authz_reader;'
bind+=ledger+f'INSERT INTO workspace_private.h2_rpc_manifest VALUES {values};'+manifest_guard
bind+=f"INSERT INTO workspace_private.h2_release VALUES('{version}','closed',{fp},{fp});END$bind$;RESET ROLE;COMMIT;\n"
activate=header+'DO $activate$ DECLARE f record;BEGIN '+baseguard+owner_guard+"IF NOT pg_has_role(session_user,'ws_runtime','SET')THEN RAISE EXCEPTION 'runtime_owner_context_required';END IF;"+bridge_check+"SET LOCAL ROLE ws_owner;"+manifest_guard
activate+=f"IF NOT EXISTS(SELECT 1 FROM workspace_private.h2_release WHERE version='{version}'AND state IN('closed','active')AND fingerprint={fp})THEN RAISE EXCEPTION 'release_or_catalog_drift';END IF;"
# Grants/revokes run as each actual function owner, never a superuser or table-owner shortcut.
activate+="FOR f IN SELECT m.public_signature,m.private_signature,pg_get_userbyid(p.proowner)owner FROM workspace_private.h2_rpc_manifest m JOIN pg_proc p ON p.oid=m.private_signature::regprocedure LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.public_signature);EXECUTE format('SET LOCAL ROLE %I',f.owner);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.private_signature);SET LOCAL ROLE ws_owner;END LOOP;"
activate+=f"UPDATE workspace_private.h2_release SET state='active',fingerprint={fp};END$activate$;RESET ROLE;COMMIT;\n"
close=header+'DO $close$ DECLARE f record;before_ok boolean;BEGIN '+baseguard+owner_guard+"IF NOT pg_has_role(session_user,'ws_runtime','SET')THEN RAISE EXCEPTION 'runtime_owner_context_required';END IF;SET LOCAL ROLE ws_owner;"+manifest_guard
close+=f"SELECT fingerprint={fp}INTO before_ok FROM workspace_private.h2_release WHERE version='{version}';"
close+="FOR f IN SELECT m.public_signature,m.private_signature,pg_get_userbyid(p.proowner)owner FROM workspace_private.h2_rpc_manifest m JOIN pg_proc p ON p.oid=m.private_signature::regprocedure LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.public_signature);EXECUTE format('SET LOCAL ROLE %I',f.owner);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.private_signature);SET LOCAL ROLE ws_owner;END LOOP;"
close+=f"UPDATE workspace_private.h2_release SET state=CASE WHEN before_ok AND closed_fingerprint={fp}THEN 'closed'ELSE 'closed_unverified'END,fingerprint=CASE WHEN before_ok AND closed_fingerprint={fp}THEN closed_fingerprint ELSE fingerprint END;END$close$;RESET ROLE;COMMIT;\n"
files={'01-provider-local.sql':provider_sql,'02-bind-workspace-local.sql':bind,'03-activate-qa-only.sql':activate,'04-close-local.sql':close}
for name,s in files.items():(E/'sql'/name).write_text(s)
(E/'reference/body-contract.json').write_text(json.dumps({'unchanged_bodies':{n:hashlib.sha256(b.encode()).hexdigest()for n,b in bodies.items()},'release_version':version,'public_rpc_count':54,'provider_requires_workspace_roles_set':False,'workspace_installer_requires_auth_set':False},indent=2))
(E/'INSTALL_PLAN.json').write_text(json.dumps({'production_eligible':False,'base_required':'reviewed CLOSED SCHOOL08 app; no fresh Hosted migration claimed','provider_phase':'sql/01-provider-local.sql','workspace_phase':'sql/02-bind-workspace-local.sql','explicit_qa_activation_only':'sql/03-activate-qa-only.sql','data_preserving_close':'sql/04-close-local.sql','automatic_activation':False,'failed_or_alternative_candidates_in_install_sequence':[],'files_sha256':{n:hashlib.sha256(s.encode()).hexdigest()for n,s in files.items()}},indent=2))
print('Built split A2 provider/binder + owner-aware lifecycle;54 default CLOSED; Hosted NOT APPROVED')
