"""Actual non-superuser LOGIN profiles in isolated PG17, NOT Hosted replicas.
Tests only the newly reviewed installer/ownership boundary, not old177/23 suites.
"""
from pathlib import Path
import os,runpy,json,subprocess,hashlib,re
E=Path(__file__).resolve().parents[1];REPO=E.parents[1]
d=runpy.run_path(str(E.parent/'school07/tests/run.py'));d['sql'].__globals__['NAME']='bogunon-school09ch-pg';sql=d['sql'];scalar=d['scalar'];apply=d['apply'];D=d['D'];ENV=d['ENV'];NAME='bogunon-school09ch-pg';checks=[];denials=[];current_case=''
def case(name,fn):
 global current_case
 current_case=name
 try:fn();checks.append({'name':name,'status':'PASS','classification':'LOCAL PG17 capability/DDL boundary'});print('PASS',name,flush=True)
 except Exception as ex:checks.append({'name':name,'status':'FAIL','error':str(ex)});print('FAIL',name,str(ex),flush=True);raise
 finally:(E/'evidence/focused-results.json').write_text(json.dumps({'checks':checks,'hosted':'NOT RUN','old177_and_rest23':'REFERENCED at a16245d, not rerun'},indent=2))
def require(value):assert value

def login(role,q,ok=True):
 p=subprocess.run(D+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U',role,'-d','school01a'],input=q,text=True,capture_output=True,env=ENV,timeout=30)
 if ok:assert p.returncode==0,p.stderr[-1600:]
 return p

def denied(p,marker):
 m=re.search(r'ERROR:\s+([0-9A-Z]{5}):',p.stderr)
 denials.append({'case':current_case,'returncode':p.returncode,'sqlstate':m.group(1)if m else None,'primary_error':next((x for x in p.stderr.splitlines()if 'ERROR:'in x),''),'expected_marker':marker})
 (E/'evidence/denial-receipts.json').write_text(json.dumps(denials,indent=2))
 assert p.returncode and marker in p.stderr,(marker,p.returncode,p.stderr[-2000:])
def snapshot():return scalar("SELECT md5(jsonb_build_object('public',(SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.prosrc,p.proacl::text,pg_get_userbyid(p.proowner))ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'),'helper',(SELECT prosrc FROM pg_proc WHERE oid='workspace_private.session_ok()'::regprocedure),'reader_select',has_column_privilege('ws_authz_reader','auth.sessions','id','SELECT'),'bridge',to_regnamespace('workspace_auth_bridge'))::text)")

apply(E.parent/'school08/sql/01-foundation.sql');apply(E.parent/'school06/tests/local-auth-capabilities.sql');apply(next((E.parent/'school08/supabase/migrations').glob('*.sql')))
# Profiles share only declared installer metadata access. No app or Auth table SELECT granted.
profiles=['ddl_bypass','ddl_member_no_set','ddl_set_only','ddl_no_db_create']
for r in profiles:
 sql('CREATE ROLE '+r+' LOGIN NOINHERIT NOSUPERUSER '+('BYPASSRLS'if r=='ddl_bypass'else'NOBYPASSRLS')+';GRANT USAGE ON SCHEMA workspace_private TO '+r+';GRANT SELECT ON workspace_private.s08_release,workspace_private.s08_rpc_manifest TO '+r+';CREATE POLICY '+r+'_release ON workspace_private.s08_release FOR SELECT TO '+r+' USING(true);CREATE POLICY '+r+'_manifest ON workspace_private.s08_rpc_manifest FOR SELECT TO '+r+' USING(true);')
 if r!='ddl_no_db_create':sql('GRANT CREATE ON DATABASE school01a TO '+r)
 sql('GRANT ws_owner,ws_authz_reader TO '+r+' WITH INHERIT FALSE,SET TRUE')
 if r!='ddl_bypass':sql('GRANT supabase_auth_admin TO '+r+' WITH INHERIT FALSE,SET '+('FALSE'if r=='ddl_member_no_set'else'TRUE'))
(E/'evidence/profile-metadata.json').write_text(sql("SELECT jsonb_agg(jsonb_build_object('role',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit,'db_create',has_database_privilege(oid,'school01a','CREATE'),'auth_member',pg_has_role(oid,'supabase_auth_admin','MEMBER'),'auth_set',pg_has_role(oid,'supabase_auth_admin','SET'),'auth_inherit',pg_has_role(oid,'supabase_auth_admin','USAGE')))FROM pg_roles WHERE rolname LIKE 'ddl_%'").stdout.strip())
case('BYPASSRLS alone does not grant SET ROLE Auth owner',lambda:denied(login('ddl_bypass','SET ROLE supabase_auth_admin',False),'42501'))
case('BYPASSRLS alone does not grant raw Auth SELECT',lambda:denied(login('ddl_bypass','SELECT id FROM auth.sessions',False),'42501'))
case('role MEMBER with SET FALSE cannot become Auth owner',lambda:denied(login('ddl_member_no_set','SET ROLE supabase_auth_admin',False),'42501'))
transfer="BEGIN;CREATE SCHEMA auth_owner_probe;CREATE FUNCTION auth_owner_probe.probe()RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''AS $$SELECT false$$;GRANT CREATE ON SCHEMA auth_owner_probe TO supabase_auth_admin;ALTER FUNCTION auth_owner_probe.probe()OWNER TO supabase_auth_admin;SELECT pg_get_userbyid(proowner)FROM pg_proc WHERE oid='auth_owner_probe.probe()'::regprocedure;ROLLBACK;"
case('ALTER FUNCTION OWNER also requires Auth SET, not BYPASSRLS',lambda:denied(login('ddl_bypass',transfer,False),'42501'))
case('explicitly delegated SET plus target schema CREATE permits owner assignment locally',lambda:require(login('ddl_set_only',transfer).stdout.strip()=='supabase_auth_admin'))
orig=(E.parent/'school09c/sql/auth-bridge.sql').read_text();before=snapshot()
case('09C original source cannot create Auth-owned schema without SET',lambda:denied(login('ddl_bypass','BEGIN;'+orig+'COMMIT;',False),'42501'))
case('09C original schema ACL stage fails under SET-only NOINHERIT installer',lambda:denied(login('ddl_set_only','BEGIN;'+orig+'COMMIT;',False),'42501'))
partial=orig.replace('CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;','CREATE SCHEMA workspace_auth_bridge AUTHORIZATION supabase_auth_admin;SET LOCAL ROLE supabase_auth_admin;',1)
case('schema-owner context correction alone leaves private helper replacement unauthorized',lambda:denied(login('ddl_set_only','BEGIN;'+partial+'COMMIT;',False),'42501'))
case('all failed original installation transactions leave baseline CLOSED and unchanged',lambda:require(snapshot()==before))
body=(E/'sql/auth-install-local.sql').read_text();prefix="SET bogunon.ws_install_mode='isolated';"
case('new candidate fails before DDL without Auth SET capability',lambda:denied(login('ddl_bypass',prefix+body,False),'role_set_capability_required'))
case('new candidate fails before DDL without database CREATE',lambda:denied(login('ddl_no_db_create',prefix+body,False),'database_create_required'))
case('pre-existing SET ROLE context cannot masquerade as a direct installer',lambda:denied(sql('SET ROLE ddl_set_only;'+prefix+body,False),'direct_install_identity_required'))
case('late installation failure rolls back Auth helper, schema and grants',lambda:(denied(login('ddl_set_only',prefix+body.replace('-- END AUTH INSTALL BOUNDARY','SELECT 1/0;\n-- END AUTH INSTALL BOUNDARY'),False),'division by zero'),require(snapshot()==before)))
case('corrected Auth-only candidate installs using genuine NOSUPERUSER NOINHERIT LOGIN',lambda:login('ddl_set_only',prefix+body))
case('temporary schema CREATE removed and all54 RPC remain CLOSED',lambda:require(scalar("SELECT NOT has_schema_privilege('ws_authz_reader','workspace_private','CREATE')AND(count(*)=54)AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'))
case('no Workspace/client Auth session SELECT survives',lambda:require(scalar("SELECT bool_and(NOT has_any_column_privilege(r,'auth.sessions','SELECT'))FROM unnest(ARRAY['ws_owner','ws_runtime','ws_authz_reader','authenticated','anon'])r")=='t'))
case('installer grants no broad Auth privileges or inherited owner access',lambda:denied(login('ddl_set_only','SELECT id FROM auth.sessions',False),'42501'))
case('only Auth owner and reader EXECUTE the new fixed-path boolean functions',lambda:require(scalar("SELECT count(*)=2 AND bool_and(p.prosecdef AND pg_get_userbyid(p.proowner)='supabase_auth_admin'AND p.proconfig=ARRAY['search_path=\"\"']AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')AND NOT has_function_privilege('anon',p.oid,'EXECUTE'))AND NOT EXISTS(SELECT 1 FROM pg_proc f JOIN pg_namespace z ON z.oid=f.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE z.nspname='workspace_auth_bridge'AND a.grantee NOT IN(f.proowner,(SELECT oid FROM pg_roles WHERE rolname='ws_authz_reader')))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_auth_bridge'")=='t'))
# Two sessions for ONE user, to distinguish session revocation from just user presence.
sql((E.parent/'local/tests/fixtures.sql').read_text())
sid1='30000000-0000-0000-0000-000000000003';sid2='39999999-0000-0000-0000-000000000003';uid='00000000-0000-0000-0000-000000000003';school='10000000-0000-0000-0000-000000000001'
sql("INSERT INTO auth.sessions(id,user_id)VALUES('"+sid2+"','"+uid+"');GRANT EXECUTE ON FUNCTION public.ws_v1_get_context(uuid),workspace_private.get_context(uuid)TO authenticated")
def context(sid,ok=True):
 claims=json.dumps({'sub':uid,'session_id':sid,'exp':2000000000,'is_anonymous':False})
 return login('school_client','BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+d['lit'](claims)+";SELECT public.ws_v1_get_context('"+school+"');COMMIT;",ok)
case('both distinct sessions for same subject initially authorized',lambda:(context(sid1),context(sid2)))
sql("DELETE FROM auth.sessions WHERE id='"+sid1+"'")
case('deleted current session denied while same user other session remains valid',lambda:(denied(context(sid1,False),'unauthenticated_or_revoked'),context(sid2)))
sql("UPDATE auth.sessions SET not_after=now()-interval '1 second'WHERE id='"+sid2+"'")
case('current session expiry denies still syntactically valid claims',lambda:denied(context(sid2,False),'unauthenticated_or_revoked'))
sql("UPDATE auth.sessions SET not_after=NULL WHERE id='"+sid2+"';INSERT INTO workspace.revoked_sessions(session_id,actor_id)VALUES('"+sid2+"','40000000-0000-0000-0000-000000000003')")
case('Workspace revocation rejects current session independently of Auth row existence',lambda:denied(context(sid2,False),'unauthenticated_or_revoked'))
sql("DELETE FROM auth.sessions WHERE user_id='"+uid+"';DELETE FROM auth.users WHERE id='"+uid+"'")
case('Auth user deletion with session cleanup prevents old claims access and leaves school records',lambda:(denied(context(sid2,False),'unauthenticated_or_revoked'),require(scalar("SELECT user_id IS NULL FROM workspace.accounts WHERE id='40000000-0000-0000-0000-000000000003'")=='t')))
sql('REVOKE EXECUTE ON FUNCTION public.ws_v1_get_context(uuid),workspace_private.get_context(uuid)FROM authenticated')
case('purpose test grants removed, final54 remain CLOSED',lambda:require(scalar("SELECT count(*)=54 AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'))
case('supplemental Hosted SELECT syntax validated locally with no Auth schema privilege',lambda:login('ddl_set_only',(E/'sql/hosted-capabilities-readonly.sql').read_text()))
case('supplemental Hosted SELECT syntax validated as catalog observer',lambda:sql((E/'sql/hosted-capabilities-readonly.sql').read_text()))
(E/'evidence/final-boundary.json').write_text(sql("SELECT jsonb_build_object('catalog_observer',(SELECT jsonb_build_object('current',current_user,'session',session_user)FROM(SELECT 1)x),'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'body',p.prosrc,'acl',p.proacl::text))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_auth_bridge'OR(n.nspname='workspace_private'AND p.proname IN('session_ok','recent_login'))),'role_memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'inherit',inherit_option,'set',set_option))FROM pg_auth_members WHERE member IN(SELECT oid FROM pg_roles WHERE rolname LIKE 'ddl_%')))").stdout.strip())
print('PASS focused checks',len(checks),'HOSTED NOT RUN; original177/23 NOT REPEATED',flush=True)
