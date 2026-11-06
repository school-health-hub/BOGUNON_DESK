"""Derive a NEW atomic fresh installer; never rewrite the frozen S01-S09 sources."""
from pathlib import Path
import json,re,hashlib
E=Path(__file__).resolve().parents[1];P=E.parent
s=next((P/'school08/supabase/migrations').glob('*.sql')).read_text()
def extract(tag):return s.split('$'+tag+'$')[1]
body=extract('ws06_payload')+'\n'+extract('inventory_body')
bootstrap=(P/'school09c/sql/bootstrap-control.sql').read_text()
bootstrap=re.sub(r'CREATE ROLE ws_bootstrap_(?:executor|operator) NOLOGIN NOBYPASSRLS;','',bootstrap)
bootstrap=bootstrap.replace('CREATE SCHEMA workspace_bootstrap AUTHORIZATION ws_owner;','SET LOCAL ROLE ws_owner;GRANT CREATE ON SCHEMA workspace_bootstrap TO ws_bootstrap_executor,ws_h3_installer;')
body+='\n'+bootstrap+'\nRESET ROLE;SET LOCAL ROLE ws_owner;REVOKE CREATE ON SCHEMA workspace_bootstrap FROM ws_bootstrap_executor,ws_h3_installer;RESET ROLE;\n'
# Auth schema USAGE is not available to custom hosted roles. Keep all public bodies unchanged.
account_ddl=re.search(r'CREATE TABLE workspace.accounts\(.*?;',body,re.S)[0]
body=body.replace(account_ddl,'',1)
assert 'REFERENCES auth.'not in body
body=body.replace('auth.uid()','workspace_private.request_uid()').replace('auth.jwt()','workspace_private.request_jwt()')
# Replace only the two original authorization helpers with the reviewed C semantics.
c=(P/'school09c/sql/auth-bridge.sql').read_text();pat=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\).*?AS \$\$(.*?)\$\$;'
cb=dict(re.findall(pat,c,re.S))
for name in ['workspace_private.session_ok','workspace_private.recent_login']:
 pattern=r'(CREATE FUNCTION '+re.escape(name)+r'\(\).*?AS \$\$).*?(\$\$;)'
 body,n=re.subn(pattern,lambda m:m[1]+cb[name].replace('auth.uid()','workspace_private.request_uid()').replace('auth.jwt()','workspace_private.request_jwt()')+m[2],body,flags=re.S);assert n==1,(name,n)
# Static permissions install under FORCE RLS: temporary owner INSERT policy, not runtime access.
marker='-- Derived from school-workspace/integration/sql/local-status.sql'
body=body.replace(marker,"SET LOCAL ROLE ws_owner;CREATE POLICY h3_seed_install ON workspace.role_permission_defaults FOR INSERT TO ws_owner WITH CHECK(true);RESET ROLE;\n"+marker,1)
body=body.replace('RESET ROLE;\nINSERT INTO workspace.role_permission_defaults','RESET ROLE;SET LOCAL ROLE ws_owner;\nINSERT INTO workspace.role_permission_defaults')
body+="\nSET LOCAL ROLE ws_owner;DROP POLICY h3_seed_install ON workspace.role_permission_defaults;RESET ROLE;\n"
# All business DDL runs as a temporary NOBYPASSRLS installer, not postgres.
body=body.replace('RESET ROLE;', 'SET LOCAL ROLE ws_h3_installer;')
# Extract exact, parameterless Auth boolean bodies; ownership is postgres, never Auth owner.
bridge=''
for name in ['workspace_auth_bridge.session_valid','workspace_auth_bridge.recent_login']:
 bridge+=f"CREATE FUNCTION {name}()RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$"+cb[name]+"$$;\n"
bridge+='REVOKE ALL ON ALL FUNCTIONS IN SCHEMA workspace_auth_bridge FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA workspace_auth_bridge TO ws_authz_reader;\n'
claims="""
SET LOCAL ROLE ws_owner;
CREATE FUNCTION workspace_private.request_jwt()RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
CREATE FUNCTION workspace_private.request_uid()RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''AS $$SELECT nullif(workspace_private.request_jwt()->>'sub','')::uuid$$;
REVOKE ALL ON FUNCTION workspace_private.request_jwt(),workspace_private.request_uid()FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION workspace_private.request_jwt(),workspace_private.request_uid()TO ws_runtime,ws_authz_reader;
RESET ROLE;
"""
rows=json.loads((P/'school09/reference/rpc-signatures.json').read_text());assert len(rows)==54
q=lambda v:"'"+v.replace("'","''")+"'"
values=','.join('('+q('public.'+r['public_signature'].removeprefix('public.'))+','+q(r['private_signature'])+')'for r in rows)
fp=(P/'school08/sql/fingerprint.sql').read_text().strip().rstrip(';')
# fingerprint.sql is a SELECT, not parentheses? normalize below.
fp=fp.replace("IN('workspace','workspace_private')","IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap')")
fp=fp.replace("n.nspname='workspace_private' OR", "n.nspname IN('workspace_private','workspace_auth_bridge','workspace_bootstrap') OR")
fp=fp.replace("IN('ws_owner','ws_runtime','ws_authz_reader')","IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')")
version=hashlib.sha256((body+bridge+claims+fp+Path(__file__).read_text()).encode()).hexdigest()
header="""-- LOCAL VALIDATED CANDIDATE ONLY. Hosted installation and OAuth are NOT VERIFIED.
BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h3:fresh',0));
DO $install$DECLARE f record;acl_grant record;BEGIN
IF current_user<>session_user OR current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR current_database()<>'school01a' OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'THEN RAISE EXCEPTION 'isolated_nonsuper_postgres_required';END IF;
IF NOT has_column_privilege(current_user,'auth.users','id','REFERENCES')OR NOT has_schema_privilege(current_user,'auth','USAGE') OR NOT has_column_privilege(current_user,'auth.sessions','id','SELECT') OR NOT has_column_privilege(current_user,'auth.sessions','user_id','SELECT') OR NOT has_column_privilege(current_user,'auth.sessions','created_at','SELECT') OR NOT has_column_privilege(current_user,'auth.sessions','not_after','SELECT') OR NOT has_function_privilege(current_user,'auth.uid()','EXECUTE') OR NOT has_function_privilege(current_user,'auth.jwt()','EXECUTE')THEN RAISE EXCEPTION 'existing_postgres_auth_read_required';END IF;
IF pg_has_role(current_user,'supabase_auth_admin','SET')OR has_schema_privilege(current_user,'auth','CREATE')THEN RAISE EXCEPTION 'managed_auth_boundary_not_emulated';END IF;
"""
manifest_check=f"IF(SELECT count(*)FROM workspace_private.h3_rpc_manifest)<>54 OR EXISTS((VALUES {values})EXCEPT SELECT public_signature,private_signature FROM workspace_private.h3_rpc_manifest)THEN RAISE EXCEPTION 'h3_manifest_drift';END IF;"
# Managed Auth ACLs are outside the Workspace fingerprint: inspect these capabilities explicitly on every lifecycle.
capability_guard="""IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ws_owner')AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')AND(rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb OR rolreplication OR has_schema_privilege(oid,'auth','USAGE')OR has_any_column_privilege(oid,'auth.sessions','SELECT')OR has_any_column_privilege(oid,'auth.users','SELECT')OR pg_has_role(oid,'supabase_auth_admin','SET')))THEN RAISE EXCEPTION 'workspace_auth_capability_drift';END IF;"""
header+=capability_guard
replay=f"""IF to_regclass('workspace_private.h3_release')IS NOT NULL THEN
SET LOCAL ROLE ws_owner;{manifest_check}IF NOT EXISTS(SELECT 1 FROM workspace_private.h3_release WHERE digest='{version}'AND fingerprint=({fp})AND state IN('closed','active'))THEN RAISE EXCEPTION 'h3_catalog_drift';END IF;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND(rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb OR rolreplication)) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND(has_schema_privilege(oid,'auth','USAGE')OR has_any_column_privilege(oid,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND c.relname='sessions'),'SELECT')))THEN RAISE EXCEPTION 'h3_role_drift';END IF;RESET ROLE;RETURN;END IF;
"""
setup="""IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap'))OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator','ws_h3_installer'))OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_')THEN RAISE EXCEPTION 'fresh_install_name_collision';END IF;
CREATE ROLE ws_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE ws_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE ws_authz_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT ws_owner,ws_runtime,ws_authz_reader TO postgres WITH INHERIT FALSE,SET TRUE;
CREATE ROLE ws_bootstrap_executor NOLOGIN NOBYPASSRLS;CREATE ROLE ws_bootstrap_operator NOLOGIN NOBYPASSRLS;CREATE ROLE ws_h3_installer NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT ws_h3_installer TO postgres WITH INHERIT FALSE,SET TRUE;GRANT ws_owner,ws_runtime,ws_authz_reader,ws_bootstrap_executor,ws_bootstrap_operator TO ws_h3_installer WITH INHERIT TRUE,SET TRUE;
CREATE SCHEMA workspace_bootstrap AUTHORIZATION ws_owner;CREATE SCHEMA workspace AUTHORIZATION ws_owner;CREATE SCHEMA workspace_private AUTHORIZATION ws_owner;CREATE SCHEMA workspace_auth_bridge AUTHORIZATION postgres;
SET LOCAL ROLE ws_owner;REVOKE ALL ON SCHEMA workspace,workspace_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA workspace,workspace_private TO ws_runtime,ws_authz_reader;GRANT USAGE ON SCHEMA workspace_private TO authenticated,postgres;GRANT USAGE ON SCHEMA workspace TO postgres;
GRANT CREATE ON SCHEMA workspace_private TO ws_runtime,ws_authz_reader,postgres,ws_h3_installer;RESET ROLE;REVOKE ALL ON SCHEMA workspace_auth_bridge FROM PUBLIC,anon,authenticated;GRANT USAGE ON SCHEMA workspace_auth_bridge TO ws_authz_reader;
GRANT CREATE ON SCHEMA public TO ws_owner,ws_h3_installer;
"""
# CREATE FUNCTION defaults are revoked inside the same installation transaction.
harden="""
FOR f IN SELECT p.oid,p.proowner,p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_auth_bridge')OR(n.nspname='public'AND left(p.proname,3)='ws_')LOOP
 EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(f.proowner));
 FOR acl_grant IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f.oid AND x.grantee<>f.proowner AND x.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.sig,CASE WHEN acl_grant.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(acl_grant.grantee))END);END LOOP;
 RESET ROLE;
END LOOP;
SET LOCAL ROLE ws_owner;REVOKE CREATE ON SCHEMA workspace_private FROM ws_runtime,ws_authz_reader,postgres;RESET ROLE;REVOKE CREATE ON SCHEMA public FROM ws_owner,ws_h3_installer;SET LOCAL ROLE ws_owner;REVOKE CREATE ON SCHEMA workspace_private FROM ws_h3_installer;RESET ROLE;REVOKE ws_owner,ws_runtime,ws_authz_reader,ws_bootstrap_executor,ws_bootstrap_operator FROM ws_h3_installer;DROP ROLE ws_h3_installer;
"""
ledger="""
SET LOCAL ROLE ws_owner;
CREATE TABLE workspace_private.h3_release(digest text PRIMARY KEY,state text NOT NULL,fingerprint text NOT NULL);
CREATE TABLE workspace_private.h3_rpc_manifest(public_signature text PRIMARY KEY,private_signature text NOT NULL);
ALTER TABLE workspace_private.h3_release ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.h3_release FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_private.h3_rpc_manifest ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.h3_rpc_manifest FORCE ROW LEVEL SECURITY;
CREATE POLICY h3_owner ON workspace_private.h3_release TO ws_owner USING(true)WITH CHECK(true);CREATE POLICY h3_owner ON workspace_private.h3_rpc_manifest TO ws_owner USING(true)WITH CHECK(true);
REVOKE ALL ON workspace_private.h3_release,workspace_private.h3_rpc_manifest FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;
"""+f"INSERT INTO workspace_private.h3_rpc_manifest VALUES {values};\nRESET ROLE;"
# table owner FORCE RLS is used for the release ledger writes too.
end=f"SET LOCAL ROLE ws_owner;INSERT INTO workspace_private.h3_release VALUES('{version}','closed',({fp}));RESET ROLE;END$install$;COMMIT;\n"
install=header+replay+setup+'EXECUTE $bridge$'+bridge+'$bridge$;SET LOCAL ROLE ws_owner;GRANT CREATE ON SCHEMA workspace TO postgres;RESET ROLE;EXECUTE $account$'+account_ddl+'$account$;ALTER TABLE workspace.accounts OWNER TO ws_owner;SET LOCAL ROLE ws_owner;REVOKE CREATE ON SCHEMA workspace FROM postgres;RESET ROLE;EXECUTE $claims$'+claims+'$claims$;SET LOCAL ROLE ws_h3_installer;EXECUTE $business$'+body+'$business$;RESET ROLE;'+harden+'EXECUTE $ledger$'+ledger+'$ledger$;'+end
(E/'sql/01-fresh-local.sql').write_text(install)
for activate in [True,False]:
 state='active'if activate else'closed';right='GRANT EXECUTE ON'if activate else'REVOKE ALL ON';to='TO'if activate else'FROM'
 lifecycle=header.replace('DO $install$DECLARE','DO $life$DECLARE')+f"SET LOCAL ROLE ws_owner;{manifest_check}IF NOT EXISTS(SELECT 1 FROM workspace_private.h3_release WHERE digest='{version}'AND fingerprint=({fp}))THEN RAISE EXCEPTION 'h3_catalog_drift';END IF;"
 lifecycle+=f"FOR f IN SELECT p.oid::regprocedure sig,p.proowner FROM pg_proc p WHERE p.oid IN(SELECT public_signature::regprocedure FROM workspace_private.h3_rpc_manifest UNION ALL SELECT private_signature::regprocedure FROM workspace_private.h3_rpc_manifest)LOOP EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(f.proowner));EXECUTE format('{right} FUNCTION %s {to} authenticated',f.sig);RESET ROLE;END LOOP;"
 lifecycle+=f"SET LOCAL ROLE ws_owner;UPDATE workspace_private.h3_release SET state='{state}',fingerprint=({fp});RESET ROLE;END$life$;COMMIT;\n"
 (E/('sql/02-activate-qa-only.sql'if activate else'sql/03-close-local.sql')).write_text(lifecycle)
(E/'reference/build.json').write_text(json.dumps({'release_version':version,'public_rpc_count':54,'body_sha256':hashlib.sha256(body.encode()).hexdigest(),'changes':['Auth bridge owner postgres, outside managed auth','request claims helpers replace private auth.uid/jwt calls','accounts Auth FK created by existing authorized postgres then owned by nonbypass ws_owner; deletion tombstone preserved','temporary owner-only INSERT policy removed before commit','new atomic release/manifest replacing legacy install ledgers'],'production_eligible':False},indent=2))
print('Built fresh atomic candidate and QA-only lifecycle',version)

plan={"production_eligible":False,"automatic_activation":False,"fresh_install":"sql/01-fresh-local.sql","qa_activation_only":"sql/02-activate-qa-only.sql","data_preserving_close":"sql/03-close-local.sql","metadata_select_only":"sql/04-hosted-readonly.sql","release_version":version,"files_sha256":{str(f.relative_to(E)):hashlib.sha256(f.read_bytes()).hexdigest()for f in sorted((E/"sql").glob("*.sql"))}}
(E/"INSTALL_PLAN.json").write_text(json.dumps(plan,indent=2)+"\n")
