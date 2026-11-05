"""Derive the new-object installer from reviewed local SQL; never access a DB."""
from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
sources=['school-workspace/local/supabase/migrations/20261105000027_school01a_workspace_local.sql','school-workspace/integration/sql/local-status.sql','school-workspace/school02/sql/extension.sql','school-workspace/school03/sql/extension.sql','school-workspace/school04/sql/extension.sql']
parts=[];provenance=[]
for i,name in enumerate(sources):
 raw=(REPO/name).read_text();s=raw
 s,n=re.subn(r'(?m)^BEGIN;\s*','',s,count=1);assert n==1
 s,n=re.subn(r'(?m)^COMMIT;\s*$','',s,count=1);assert n==1
 if i==0:
  start=s.index('DO $$ BEGIN');end=s.index('-- Ownership is separate');s=s[:start]+s[end:]
 else:
  s,n=re.subn(r'DO \$\$\s*BEGIN\s+IF current_database\(\)\s*<>\s*\'school01a\'.*?END\s*\$\$;','',s,count=1,flags=re.S);assert n==1,name
 s+='\nRESET ROLE;\n';parts.append('-- Derived from '+name+'\n'+s)
 provenance.append({'path':name,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'adaptation':'remove outer transaction/local-only guard; foundation and preverified Auth capabilities supplied separately'if i else'remove local-only guard and role/schema bootstrap, remove all Auth GRANTs; supplied by separate foundation and external capability prerequisite'})
payload='\n'.join(parts)
assert not re.search(r'GRANT[^;]*\b(?:auth\.|,auth\b|SCHEMA auth)',payload,re.I)
assert not re.search(r'CREATE (?:ROLE|SCHEMA)',payload,re.I)
assert 'current_database()'not in payload
names=sorted(set(re.findall(r'CREATE(?: OR REPLACE)? FUNCTION public\.([a-zA-Z0-9_]+)',payload)))
assert len(names)==39,(len(names),names)
array='ARRAY['+','.join("'"+n+"'"for n in names)+']::text[]'
payload_digest=hashlib.sha256(payload.encode()).hexdigest();digest='__S06_RELEASE_DIGEST__'
(ROOT/'reference/source-sql-manifest.json').write_text(json.dumps({'sources':provenance,'excluded':['synthetic Auth/user/school fixtures','Instructor candidate.sql (separate feature, not SCHOOL01-05 core contract)'],'public_rpc_names':names,'derived_payload_sha256':payload_digest,'legacy_sql_unchanged':True},indent=2))
# Fingerprint structural definitions/ACLs only, never business rows.
fp=f"""(SELECT md5(coalesce(jsonb_agg(x ORDER BY x::text)::text,'[]')) FROM(
 SELECT jsonb_build_object('kind','schema','name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)x FROM pg_namespace WHERE nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','function','signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' OR(n.nspname='public'AND p.proname=ANY({array}))
 UNION ALL SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'relkind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','column','schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'null',a.attnotnull,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid))FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('workspace','workspace_private')AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT jsonb_build_object('kind','constraint','table',c.conrelid::regclass::text,'name',c.conname,'def',pg_get_constraintdef(c.oid))FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','trigger','table',t.tgrelid::regclass::text,'name',t.tgname,'def',pg_get_triggerdef(t.oid))FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND NOT t.tgisinternal
 UNION ALL SELECT jsonb_build_object('kind','index','schema',schemaname,'name',indexname,'def',indexdef)FROM pg_indexes WHERE schemaname IN('workspace','workspace_private')
 UNION ALL SELECT jsonb_build_object('kind','role','name',rolname,'super',rolsuper,'login',rolcanlogin,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replicate',rolreplication)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')
 UNION ALL SELECT jsonb_build_object('kind','membership','role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option,'inherit',inherit_option,'set',set_option)FROM pg_auth_members WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))OR member IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))
 )q)"""
(ROOT/'sql/fingerprint-expression.sql').write_text(fp+';\n')
guard="""IF current_user<>session_user THEN RAISE EXCEPTION 'direct_migration_session_required';END IF;
IF current_setting('bogunon.ws_install_mode',true) IS DISTINCT FROM 'isolated' THEN
 IF current_setting('bogunon.ws_target_project',true) IS DISTINCT FROM 'xxownwxxajzrviuvvfiu' OR length(coalesce(current_setting('bogunon.ws_change_ticket',true),''))<8 THEN RAISE EXCEPTION 'explicit_change_approval_required';END IF;
 ELSIF current_database()<>'school01a' THEN RAISE EXCEPTION 'isolated_fixture_database_required';END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'postgres17_required';END IF;"""
roles="""IF(SELECT count(*)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)<>3 THEN RAISE EXCEPTION 'workspace_role_contract_mismatch';END IF;
 IF NOT pg_has_role(current_user,'ws_owner','SET')OR NOT pg_has_role(current_user,'ws_runtime','SET')OR NOT pg_has_role(current_user,'ws_authz_reader','SET')THEN RAISE EXCEPTION 'migration_owner_context_not_available';END IF;"""
auth="""IF to_regclass('auth.users')IS NULL OR to_regclass('auth.sessions')IS NULL OR to_regprocedure('auth.uid()')IS NULL OR to_regprocedure('auth.jwt()')IS NULL THEN RAISE EXCEPTION 'auth_contract_missing';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid='auth.sessions'::regclass AND relrowsecurity)THEN RAISE EXCEPTION 'auth_sessions_rls_requires_hosted_review';END IF;
 IF NOT has_schema_privilege('ws_owner','auth','USAGE')OR NOT has_schema_privilege('ws_runtime','auth','USAGE')OR NOT has_schema_privilege('ws_authz_reader','auth','USAGE')OR NOT has_column_privilege('ws_owner','auth.users','id','REFERENCES')THEN RAISE EXCEPTION 'external_auth_capability_required';END IF;
 IF NOT has_function_privilege('ws_runtime','auth.uid()','EXECUTE')OR NOT has_function_privilege('ws_runtime','auth.jwt()','EXECUTE')OR NOT has_function_privilege('ws_authz_reader','auth.uid()','EXECUTE')OR NOT has_function_privilege('ws_authz_reader','auth.jwt()','EXECUTE')THEN RAISE EXCEPTION 'external_auth_function_capability_required';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','user_id','created_at','not_after'])c WHERE NOT has_column_privilege('ws_authz_reader','auth.sessions',c,'SELECT'))THEN RAISE EXCEPTION 'external_auth_sessions_capability_required';END IF;
 IF has_table_privilege('ws_authz_reader','auth.sessions','SELECT')OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='auth.sessions'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname NOT IN('id','user_id','created_at','not_after')AND has_column_privilege('ws_authz_reader','auth.sessions',a.attname,'SELECT'))OR has_any_column_privilege('ws_runtime','auth.sessions','SELECT')OR has_any_column_privilege('ws_authz_reader','auth.users','SELECT')THEN RAISE EXCEPTION 'auth_capability_not_minimal';END IF;"""
(ROOT/'sql/auth-capability-check.sql').write_text('DO $check$ BEGIN\n'+roles+'\n'+auth+'\nEND $check$;\n')
foundation=f"""-- New Workspace objects only. Requires separate approval; no Auth grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));
DO $foundation$ DECLARE runner text:=current_user;BEGIN
{guard}
IF to_regnamespace('workspace')IS NOT NULL OR to_regnamespace('workspace_private')IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader'))THEN
 IF to_regclass('workspace_private.s06_install_manifest')IS NULL THEN RAISE EXCEPTION 'namespace_or_role_collision';END IF;
 {roles}
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='foundation'AND digest='__S06_FOUNDATION_DIGEST__')THEN RAISE EXCEPTION 'unknown_foundation';END IF;
 IF EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core')THEN
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core'AND state IN('closed','active')AND fingerprint={fp})THEN RAISE EXCEPTION 'installed_catalog_drift';END IF;
 ELSE IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='foundation'AND fingerprint={fp})THEN RAISE EXCEPTION 'foundation_catalog_drift';END IF;END IF;RETURN;
END IF;
CREATE ROLE ws_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_runtime NOLOGIN NOBYPASSRLS;
CREATE ROLE ws_authz_reader NOLOGIN NOBYPASSRLS;
{roles}
CREATE SCHEMA workspace AUTHORIZATION ws_owner;
CREATE SCHEMA workspace_private AUTHORIZATION ws_owner;
REVOKE ALL ON SCHEMA workspace,workspace_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA workspace,workspace_private TO ws_runtime,ws_authz_reader;
GRANT USAGE ON SCHEMA workspace_private TO authenticated;
SET LOCAL ROLE ws_owner;
CREATE TABLE workspace_private.s06_install_manifest(phase text PRIMARY KEY,digest text NOT NULL,fingerprint text,closed_fingerprint text,state text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE workspace_private.s06_rpc_manifest(public_signature text PRIMARY KEY,private_signature text NOT NULL,public_owner text NOT NULL,private_owner text NOT NULL);
ALTER TABLE workspace_private.s06_install_manifest ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.s06_install_manifest FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_private.s06_rpc_manifest ENABLE ROW LEVEL SECURITY;ALTER TABLE workspace_private.s06_rpc_manifest FORCE ROW LEVEL SECURITY;
CREATE POLICY s06_installer ON workspace_private.s06_install_manifest TO ws_owner USING(true)WITH CHECK(true);
CREATE POLICY s06_installer ON workspace_private.s06_rpc_manifest TO ws_owner USING(true)WITH CHECK(true);
REVOKE ALL ON workspace_private.s06_install_manifest,workspace_private.s06_rpc_manifest FROM PUBLIC,anon,authenticated,ws_runtime,ws_authz_reader;
EXECUTE format('GRANT SELECT,INSERT,UPDATE ON workspace_private.s06_install_manifest,workspace_private.s06_rpc_manifest TO %I',runner);
EXECUTE format('CREATE POLICY s06_runner ON workspace_private.s06_install_manifest TO %I USING(true)WITH CHECK(true)',runner);
EXECUTE format('CREATE POLICY s06_runner ON workspace_private.s06_rpc_manifest TO %I USING(true)WITH CHECK(true)',runner);
INSERT INTO workspace_private.s06_install_manifest(phase,digest,state)VALUES('foundation','__S06_FOUNDATION_DIGEST__','closed');
RESET ROLE;
UPDATE workspace_private.s06_install_manifest SET fingerprint={fp}WHERE phase='foundation';
END $foundation$;
COMMIT;
"""
# Narrow new-function ACLs even in projects with permissive default privileges.
harden=f"""FOR f IN SELECT p.oid,p.proowner,p.oid::regprocedure sig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'OR(n.nspname='public'AND p.proname=ANY({array}))LOOP
 FOR acl_item IN SELECT DISTINCT e.grantee FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))e WHERE e.grantee<>f.proowner AND e.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.sig,CASE WHEN acl_item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl_item.grantee))END);END LOOP;
 END LOOP;"""
core=f"""-- Atomic cumulative application migration. RPC exposure remains CLOSED.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));
DO $core$ DECLARE f record;acl_item record;old text;target text;private_oid oid;BEGIN
{guard}
IF to_regclass('workspace_private.s06_install_manifest')IS NULL THEN RAISE EXCEPTION 'foundation_required';END IF;
{roles}
{auth}
IF EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core')THEN
 IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core'AND digest='{digest}'AND state IN('closed','active')AND fingerprint={fp})THEN RAISE EXCEPTION 'installed_package_or_catalog_drift';END IF;RETURN;
END IF;
IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind IN('r','v','m','p'))OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace','workspace_private')OR(n.nspname='public'AND p.proname=ANY({array})))THEN RAISE EXCEPTION 'new_object_collision';END IF;
IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='foundation'AND digest='__S06_FOUNDATION_DIGEST__'AND fingerprint={fp})THEN RAISE EXCEPTION 'foundation_catalog_drift';END IF;
EXECUTE $ws06_payload$
{payload}
$ws06_payload$;
{harden}
SET LOCAL ROLE ws_owner;
FOR f IN SELECT p.oid,p.prosrc,p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname=ANY({array})LOOP
 target:=(regexp_match(f.prosrc,'workspace_private[.]([a-zA-Z0-9_]+)'))[1];
 SELECT p.oid INTO private_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'AND p.proname=target;
 IF private_oid IS NULL THEN RAISE EXCEPTION 'rpc_chain_manifest_unresolved';END IF;
 INSERT INTO workspace_private.s06_rpc_manifest VALUES(f.sig,private_oid::regprocedure::text,'ws_owner',pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid=private_oid)));
END LOOP;
INSERT INTO workspace_private.s06_install_manifest(phase,digest,state)VALUES('core','{digest}','closed');
RESET ROLE;
UPDATE workspace_private.s06_install_manifest SET fingerprint={fp},closed_fingerprint={fp}WHERE phase='core';
END $core$;
COMMIT;
"""
activate=f"""-- Separate NEW RPC exposure change, NOT part of installation. Manual approval only.
BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));
DO $activate$ DECLARE r record;BEGIN
{guard}
IF current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'AND length(coalesce(current_setting('bogunon.ws_rpc_activation_ticket',true),''))<8 THEN RAISE EXCEPTION 'separate_rpc_activation_approval_required';END IF;
{roles}
{auth}
IF NOT EXISTS(SELECT 1 FROM workspace_private.s06_install_manifest WHERE phase='core'AND digest='{digest}'AND state IN('active','closed')AND fingerprint={fp})THEN RAISE EXCEPTION 'catalog_drift_or_package_missing';END IF;
FOR r IN SELECT *FROM workspace_private.s06_rpc_manifest LOOP
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s,%s TO authenticated',r.public_signature,r.private_signature);
END LOOP;
UPDATE workspace_private.s06_install_manifest SET state='active',fingerprint={fp}WHERE phase='core';
END $activate$;COMMIT;
"""
deactivate=f"""-- Data-preserving emergency closure of this package's RPCs only.
BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('bogunon:school06:install',0));
DO $close$ DECLARE r record;before_ok boolean;BEGIN
{guard}
SELECT fingerprint={fp}INTO before_ok FROM workspace_private.s06_install_manifest WHERE phase='core';
FOR r IN SELECT *FROM workspace_private.s06_rpc_manifest LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s,%s FROM authenticated,anon,PUBLIC',r.public_signature,r.private_signature);
END LOOP;
UPDATE workspace_private.s06_install_manifest SET state=CASE WHEN before_ok AND closed_fingerprint={fp}THEN 'closed' ELSE 'closed_unverified'END,fingerprint=CASE WHEN before_ok AND closed_fingerprint={fp}THEN closed_fingerprint ELSE fingerprint END WHERE phase='core';
END $close$;COMMIT;
"""
# Stable checksums cover the full normalized installer specification, not data rows.
foundation_digest=hashlib.sha256(foundation.encode()).hexdigest()
release_digest=hashlib.sha256((foundation+core+activate+deactivate+auth+fp).encode()).hexdigest()
foundation=foundation.replace('__S06_FOUNDATION_DIGEST__',foundation_digest)
core=core.replace('__S06_FOUNDATION_DIGEST__',foundation_digest).replace(digest,release_digest);activate=activate.replace(digest,release_digest);deactivate=deactivate.replace(digest,release_digest)
manifest=json.loads((ROOT/'reference/source-sql-manifest.json').read_text());manifest.update(foundation_sha256=foundation_digest,release_spec_sha256=release_digest);(ROOT/'reference/source-sql-manifest.json').write_text(json.dumps(manifest,indent=2))
# Explicitly numbered installer steps are generated into CLI-created migration files.
(root:=ROOT/'supabase/migrations').mkdir(parents=True,exist_ok=True)
existing=list(root.glob('*_workspace_foundation.sql'));assert len(existing)==1,'CLI-generated foundation file required'
existing[0].write_text(foundation)
corefiles=list(root.glob('*_workspace_core.sql'));assert len(corefiles)==1,'CLI-generated core file required'
corefiles[0].write_text(core)
(ROOT/'sql/activate-new-rpcs.sql').write_text(activate);(ROOT/'sql/close-new-rpcs.sql').write_text(deactivate)
(ROOT/'sql/public-rpc-names.json').write_text(json.dumps(names,indent=2))
print('Generated foundation/core from',len(sources),'source SQL files;',len(names),'RPCs; Auth grants excluded; default RPC gate CLOSED')
