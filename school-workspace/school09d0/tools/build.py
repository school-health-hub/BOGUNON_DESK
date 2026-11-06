"""Single CLOSED install candidate, frozen H3 business definitions, explicit recovery."""
from pathlib import Path
import hashlib,json,re
E=Path(__file__).resolve().parents[1];P=E.parent;H=P/'school09ch3'
s=(H/'sql/01-fresh-local.sql').read_text();old=json.loads((H/'INSTALL_PLAN.json').read_text())['release_version']
old_guard="current_database()<>'school01a' OR current_setting('bogunon.ws_install_mode',true)IS DISTINCT FROM 'isolated'"
guard="current_database()<>'postgres' OR current_setting('bogunon.workspace_target',true)IS DISTINCT FROM 'xxownwxxajzrviuvvfiu' OR current_setting('bogunon.workspace_plan',true)IS DISTINCT FROM 'SCHOOL-09D-0:CLOSED'"
assert s.count(old_guard)==1
# No function body changes: this is installer ACL hardening for newly created objects only.
table_harden="""
-- Revoke creator defaults on NEW Workspace relations, never global defaults or existing public objects.
FOR f IN SELECT c.oid,c.relowner,c.relkind,format('%I.%I',n.nspname,c.relname)AS rel FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap')AND c.relkind IN('r','S')LOOP
 EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(f.relowner));
 FOR acl_grant IN SELECT DISTINCT x.grantee FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S'THEN 'S'::\"char\"ELSE 'r'::\"char\"END,c.relowner)))x WHERE c.oid=f.oid AND x.grantee<>f.relowner AND x.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader','ws_bootstrap_executor'))LOOP
 EXECUTE format('REVOKE ALL ON %s %s FROM %s',CASE WHEN f.relkind='S'THEN 'SEQUENCE'ELSE 'TABLE'END,f.rel,CASE WHEN acl_grant.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(acl_grant.grantee))END);END LOOP;
 RESET ROLE;
END LOOP;
"""
schema_harden="""
-- Canonical ACLs for NEW schemas only. Keep the original intended USAGE, never client CREATE.
FOR f IN SELECT oid,nspname,nspowner FROM pg_namespace WHERE nspname IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap')LOOP
 EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(f.nspowner));
 FOR acl_grant IN SELECT DISTINCT x.grantee FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))x WHERE n.oid=f.oid AND x.grantee<>f.nspowner LOOP
 EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %s',f.nspname,CASE WHEN acl_grant.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(acl_grant.grantee))END);END LOOP;
 IF f.nspname='workspace'THEN GRANT USAGE ON SCHEMA workspace TO ws_runtime,ws_authz_reader,ws_bootstrap_executor,postgres;
 ELSIF f.nspname='workspace_private'THEN GRANT USAGE ON SCHEMA workspace_private TO ws_runtime,ws_authz_reader,authenticated,postgres;
 ELSIF f.nspname='workspace_auth_bridge'THEN GRANT USAGE ON SCHEMA workspace_auth_bridge TO ws_authz_reader;
 ELSE GRANT USAGE ON SCHEMA workspace_bootstrap TO ws_bootstrap_executor,ws_bootstrap_operator;END IF;
 RESET ROLE;END LOOP;
"""
s=s.replace(old_guard,guard).replace("'isolated_nonsuper_postgres_required'","'closed_candidate_identity_required'")
needle='EXECUTE $ledger$';assert s.count(needle)==1;s=s.replace(needle,schema_harden+table_harden+needle)
s=s.replace('-- LOCAL VALIDATED CANDIDATE ONLY. Hosted installation and OAuth are NOT VERIFIED.','-- CLOSED REVIEW CANDIDATE. No Hosted execution/activation authorized. Project marker is NOT proof of endpoint identity.')
version=hashlib.sha256((s+Path(__file__).read_text()).encode()).hexdigest();s=s.replace(old,version)
(E/'sql/01-install-closed-candidate.sql').write_text(s)
# Existing QA lifecycle remains a TEST prerequisite, not an installation step.
a=(H/'sql/02-activate-qa-only.sql').read_text().replace(old_guard,guard).replace(old,version)
a=a.replace(f"WHERE digest='{version}'AND fingerprint=",f"WHERE digest='{version}'AND state IN('closed','active')AND fingerprint=")
a=a.replace('DO $life$DECLARE',"DO $qa$BEGIN IF current_setting('bogunon.local_test',true)IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'local_qa_only';END IF;END$qa$;DO $life$DECLARE",1)
(E/'tests/activate-local-only.sql').write_text(a)
strict=(H/'sql/03-close-local.sql').read_text().replace(old_guard,guard).replace(old,version)
(E/'tests/strict-close-local-only.sql').write_text(strict)
rows=json.loads((P/'school09/reference/rpc-signatures.json').read_text());q=lambda x:"'"+x.replace("'","''")+"'"
values=','.join('('+q('public.'+r['public_signature'].removeprefix('public.'))+','+q(r['private_signature'])+')'for r in rows)
# Recovery refuses missing/wrong-owner targets; it does NOT adopt modified definitions or grant any rights.
close=f"""-- Data-preserving emergency close; review/approval required before any Hosted use.
BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h3:fresh',0));
DO $close$DECLARE f record;g record;BEGIN
IF current_user<>session_user OR current_user<>'postgres'OR(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)OR {guard}THEN RAISE EXCEPTION 'closed_candidate_identity_required';END IF;
IF EXISTS(SELECT 1 FROM(VALUES {values})e(pub,priv)WHERE to_regprocedure(e.pub)IS NULL OR to_regprocedure(e.priv)IS NULL)THEN RAISE EXCEPTION 'recovery_target_missing';END IF;
IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN(SELECT pub::regprocedure FROM(VALUES {values})e(pub,priv)UNION ALL SELECT priv::regprocedure FROM(VALUES {values})e(pub,priv))AND pg_get_userbyid(p.proowner)NOT IN('ws_owner','ws_runtime','ws_authz_reader'))THEN RAISE EXCEPTION 'recovery_owner_mismatch';END IF;
FOR f IN SELECT p.oid::regprocedure sig,p.proowner FROM pg_proc p WHERE p.oid IN(SELECT pub::regprocedure FROM(VALUES {values})e(pub,priv)UNION ALL SELECT priv::regprocedure FROM(VALUES {values})e(pub,priv))LOOP
 EXECUTE format('SET LOCAL ROLE %I',pg_get_userbyid(f.proowner));
 FOR g IN SELECT DISTINCT x.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE p.oid=f.sig AND x.grantee<>p.proowner AND x.grantee NOT IN(SELECT oid FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',f.sig,CASE WHEN g.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(g.grantee))END);END LOOP;RESET ROLE;END LOOP;
-- Private bootstrap operator command remains separately CLOSED; no operator authority is granted or changed here.
SET LOCAL ROLE ws_owner;UPDATE workspace_private.h3_release SET state='closed_unverified';RESET ROLE;
END$close$;COMMIT;
"""
(E/'sql/03-emergency-close.sql').write_text(close)
(E/'reference/build.json').write_text(json.dumps({'h3_release':old,'candidate_release':version,'public_rpc_count':54,'changes':['outer install guard for database postgres and explicit review plan markers','new table/sequence creator-default ACL hardening','separate canonical emergency close; no fingerprint adoption'],'h3_business_function_bodies_changed':False,'hosted_executed':False},indent=2)+'\n')
plan={'production_approved':False,'automatic_activation':False,'review_project_ref':'xxownwxxajzrviuvvfiu','database':'postgres','candidate_release':version,'sequence':['sql/00-hosted-preflight-select.sql','sql/01-install-closed-candidate.sql','sql/02-postflight-select.sql'],'recovery_only':'sql/03-emergency-close.sql','excluded_from_install_sequence':['tests/activate-local-only.sql','all prior foundation/raw Auth grant/A2 migrations'],'files_sha256':{str(f.relative_to(E)):hashlib.sha256(f.read_bytes()).hexdigest()for f in sorted((E/'sql').glob('*.sql'))}}
(E/'INSTALL_PLAN.json').write_text(json.dumps(plan,indent=2)+'\n')
print('Built D0 CLOSED candidate',version,'54 contracts unchanged; operating gates BLOCKED')
