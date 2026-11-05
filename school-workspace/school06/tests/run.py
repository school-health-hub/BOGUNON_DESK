"""Hard-coded local Docker only. Never accepts a DB URL or hosted credential."""
from pathlib import Path
import subprocess,os,json,concurrent.futures,hashlib,importlib.util,time,uuid,runpy
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
NAME='bogunon-school06-pg';DOCKER=['docker','--host=unix:///var/run/docker.sock'];ENV={k:v for k,v in os.environ.items()if k not in('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
RESULT=[]
def sql(q,user='postgres',ok=True):
 p=subprocess.run(DOCKER+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a'],input=q,text=True,capture_output=True,env=ENV,timeout=45)
 if ok and p.returncode:raise AssertionError(p.stderr[-3000:])
 return p
def scalar(q):return sql(q).stdout.strip().splitlines()[-1]
def apply(path,ok=True,replace=None,approved=True):
 s=Path(path).read_text();s=replace(s)if replace else s
 return sql(("SET bogunon.ws_install_mode='isolated';\n"if approved else'')+s,ok=ok)
def deny(p,marker):assert p.returncode and marker in p.stderr,(marker,p.returncode,p.stderr[-1600:])
def case(name,fn):
 try:fn();RESULT.append({'name':name,'result':'PASS','classification':'LOCAL POSTGREST'if name.startswith('LOCAL POSTGREST')else'LOCAL DB'});print('PASS',name,flush=True)
 except Exception as e:RESULT.append({'name':name,'result':'FAIL','error':str(e)[-2500:]});print('FAIL',name,str(e)[-1800:],flush=True);raise
foundation=next((ROOT/'supabase/migrations').glob('*_workspace_foundation.sql'));core=next((ROOT/'supabase/migrations').glob('*_workspace_core.sql'))
def protected():
 # Fixture metadata/data digest, never used against a remote database.
 return scalar("""SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity)ORDER BY c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'AND c.relname IN('tasks','events','profiles','medication_items')),
 'policies',(SELECT jsonb_agg(to_jsonb(p)ORDER BY policyname,tablename)FROM pg_policies p WHERE schemaname='public'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('sig',p.oid::regprocedure::text,'def',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)<>'ws_'),
 'public_acl',(SELECT nspacl::text FROM pg_namespace WHERE nspname='public'),
 'auth',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity)ORDER BY c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'),
 'auth_columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'col',a.attname,'acl',a.attacl::text)ORDER BY c.relname,a.attnum)FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'AND a.attnum>0),
 'legacy_rows',(SELECT jsonb_agg(to_jsonb(t)ORDER BY id)FROM public.tasks t)
 )::text""")
def fixtures():
 for p in ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']:sql((REPO/p).read_text())
def main():
 initial=protected()
 (ROOT/'evidence/preflight-before.json').write_text(sql((ROOT/'sql/preflight-readonly.sql').read_text()).stdout.strip())
 case('default approval guard fails before roles/DDL',lambda:deny(apply(foundation,False,approved=False),'explicit_change_approval_required'))
 case('missing foundation blocks application migration',lambda:deny(apply(core,False),'foundation_required'))
 sql('CREATE SCHEMA workspace')
 case('foreign namespace collision rejected',lambda:deny(apply(foundation,False),'namespace_or_role_collision'))
 sql('DROP SCHEMA workspace;CREATE ROLE ws_runtime NOLOGIN NOBYPASSRLS')
 case('preexisting role collision rejected',lambda:deny(apply(foundation,False),'namespace_or_role_collision'))
 sql('DROP ROLE ws_runtime')
 case('foundation installs new roles/schemas only',lambda:apply(foundation))
 case('foundation repeat safe',lambda:apply(foundation))
 assert protected()==initial
 case('Auth prerequisites fail closed, no automatic Auth grants',lambda:deny(apply(core,False),'external_auth_capability_required'))
 case('Auth capability refusal leaves zero app tables',lambda:assert_zero_app_tables())
 case('local Auth owner supplies column capabilities as FIXTURE ONLY',lambda:apply(ROOT/'tests/local-auth-capabilities.sql'))
 sql('GRANT SELECT(test_private_metadata)ON auth.sessions TO ws_authz_reader')
 case('excessive Auth column capability rejected',lambda:deny(apply(core,False),'auth_capability_not_minimal'))
 sql('REVOKE SELECT(test_private_metadata)ON auth.sessions FROM ws_authz_reader')
 approved_protected=protected()
 sql("CREATE FUNCTION public.ws_v1_get_event()RETURNS boolean LANGUAGE sql AS $$SELECT false$$")
 case('public RPC collision rejected without replacement',lambda:deny(apply(core,False),'new_object_collision'))
 assert scalar('SELECT public.ws_v1_get_event()')=='f'
 sql('DROP FUNCTION public.ws_v1_get_event()')
 case('failure after A/C/02/03 DDL rolls back entire app install',lambda:deny(apply(core,False,replace=lambda text:text.replace('-- Derived from school-workspace/school04/sql/extension.sql','SELECT 1/0;\n-- Derived from school-workspace/school04/sql/extension.sql')),'division by zero'))
 assert_zero_app_tables();check_protected(approved_protected)
 case('atomic core installs after failed transaction',lambda:apply(core))
 case('default CLOSED RPC gate denies authenticated EXECUTE',lambda:check_closed())
 case('unexpected default client ACL removed only on new functions',lambda:check_default_acl())
 case('repeat core closed is no-op',lambda:apply(core))
 check_protected(approved_protected)
 case('concurrent repeat serialized without duplicate objects',lambda:concurrent_replay())
 case('activate isolated RPC gate explicitly',lambda:apply(ROOT/'sql/activate-new-rpcs.sql'))
 case('repeat core active and foundation active safe',lambda:(apply(core),apply(foundation)))
 case('least-privilege function/role/GRANT chain',lambda:check_permissions())
 (ROOT/'evidence/object-inventory.json').write_text(sql((ROOT/'sql/inventory-readonly.sql').read_text()).stdout.strip())
 if os.environ.get('SCHOOL06_REGRESSION','1')=='1':
  runpy.run_path(str(ROOT/'tests/security-regression.py'))['run'](ROOT,REPO,DOCKER,NAME,ENV,sql)
 fixtures()
 if os.environ.get('SCHOOL06_POSTGREST','1')=='1':
  runpy.run_path(str(ROOT/'tests/postgrest.py'))['run'](sql,case,ROOT,DOCKER,NAME,ENV)
 check_protected(approved_protected)
 case('legacy public metadata/data/Auth capabilities unchanged by package',lambda:check_protected(approved_protected))
 case('data-preserving close revokes new RPCs only',lambda:apply(ROOT/'sql/close-new-rpcs.sql'))
 check_closed();assert scalar('SELECT count(*)FROM workspace.accounts')!='0'
 sql("ALTER FUNCTION public.ws_v1_list_events(uuid,timestamptz,timestamptz)SET search_path='public'")
 case('catalog drift rejected instead of overwriting installed functions',lambda:deny(apply(core,False),'installed_package_or_catalog_drift'))
 case('emergency close after drift retains data and marks unverified',lambda:apply(ROOT/'sql/close-new-rpcs.sql'))
 assert scalar("SELECT state FROM workspace_private.s06_install_manifest WHERE phase='core'")=='closed_unverified'
 check_protected(approved_protected)
 (ROOT/'evidence/install-tests.json').write_text(json.dumps({'tests':RESULT,'pass':sum(x['result']=='PASS'for x in RESULT),'fail':sum(x['result']=='FAIL'for x in RESULT),'hosted':'NOT RUN','windows_real':'NOT RUN'},ensure_ascii=False,indent=2))
 (ROOT/'evidence/preflight-after.json').write_text(sql((ROOT/'sql/preflight-readonly.sql').read_text()).stdout.strip())
def check_protected(expected):
 actual=protected()
 if actual!=expected:
  (ROOT/'evidence/protected-expected.json').write_text(expected);(ROOT/'evidence/protected-actual.json').write_text(actual)
  a=json.loads(actual);b=json.loads(expected)
  raise AssertionError('Protected differences: '+','.join(k for k in a if a[k]!=b[k]))

def assert_zero_app_tables():assert scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind='r'")=='0'
def check_closed():assert scalar("SELECT bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE'))FROM workspace_private.s06_rpc_manifest")=='t'
def check_default_acl():
 assert scalar("SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','public')AND left(p.proname,3)='ws_'AND has_function_privilege('s06_simulated_default_client',p.oid,'EXECUTE')")=='0'
 assert scalar("SELECT has_function_privilege('s06_simulated_default_client','public.owns_project()','EXECUTE')")=='t'
def concurrent_replay():
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:list(pool.map(lambda _:apply(core),range(2)))
 assert scalar('SELECT count(*)FROM workspace_private.s06_rpc_manifest')=='39'
def check_permissions():
 assert scalar("SELECT count(*)FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader')AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin")=='3'
 assert scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind='r'AND(NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_get_userbyid(c.relowner)<>'ws_owner')")=='0'
 assert scalar("SELECT bool_and(has_function_privilege('authenticated',public_signature,'EXECUTE')AND has_function_privilege('authenticated',private_signature,'EXECUTE')AND NOT has_function_privilege('anon',public_signature,'EXECUTE'))FROM workspace_private.s06_rpc_manifest")=='t'
 assert scalar("SELECT has_function_privilege('authenticated','workspace_private.request_join(uuid,text,uuid)','EXECUTE')")=='f'
 assert scalar("SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'AND NOT EXISTS(SELECT 1 FROM workspace_private.s06_rpc_manifest m WHERE m.private_signature=p.oid::regprocedure::text)AND has_function_privilege('authenticated',p.oid,'EXECUTE')")=='0'
 assert scalar("SELECT has_table_privilege('authenticated','workspace.shared_tasks','SELECT')OR has_table_privilege('ws_runtime','workspace_private.s06_install_manifest','UPDATE')")=='f'
if __name__=='__main__':main()
