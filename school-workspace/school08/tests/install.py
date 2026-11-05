from pathlib import Path
import runpy,json,os,subprocess,concurrent.futures
R=Path(__file__).resolve().parents[1];REPO=R.parents[1]
d=runpy.run_path(str(R.parent/'school07/tests/run.py'));d['sql'].__globals__['NAME']='bogunon-school08-pg';sql=d['sql'];scalar=d['scalar'];apply=d['apply'];case=d['case'];deny=d['deny'];assertion=d['assertion'];D=d['D'];ENV=d['ENV'];NAME='bogunon-school08-pg';migration=next((R/'supabase/migrations').glob('*.sql'))
def legacy():return scalar("SELECT md5(jsonb_build_object('functions',(SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'def',pg_get_functiondef(p.oid),'acl',p.proacl::text)ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)<>'ws_'),'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity)ORDER BY c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'AND c.relkind='r'),'policies',(SELECT jsonb_agg(to_jsonb(p)ORDER BY tablename,policyname)FROM pg_policies p WHERE schemaname='public'),'data',(SELECT jsonb_agg(to_jsonb(t)ORDER BY id)FROM public.tasks t))::text)")
def entry(ok=True):
 subprocess.run(D+['exec',NAME,'mkdir','-p','/tmp/s08/sql','/tmp/s08/supabase/migrations'],check=True,capture_output=True,env=ENV)
 for path,target in [(R/'sql/install-candidate.sql','/tmp/s08/sql/install-candidate.sql'),(R/'sql/01-foundation.sql','/tmp/s08/sql/01-foundation.sql'),(migration,'/tmp/s08/supabase/migrations/'+migration.name)]:subprocess.run(D+['cp',str(path),NAME+':'+target],check=True,capture_output=True,env=ENV)
 p=subprocess.run(D+['exec',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','school01a','-f','/tmp/s08/sql/install-candidate.sql'],capture_output=True,text=True,env=ENV)
 if ok:assert p.returncode==0,p.stderr[-2000:]
 return p

before=legacy()
case('cumulative install without foundation fails closed',lambda:deny(apply(migration,False),'foundation_required'))
case('frozen foundation installs unchanged',lambda:apply(R/'sql/01-foundation.sql'))
case('full entry missing Auth prerequisite stops safely in fresh branch',lambda:deny(entry(False),'external_auth_capability_required'))
case('missing Managed Auth capability blocks all app DDL',lambda:deny(apply(migration,False),'external_auth_capability_required'))
assert scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind='r'")=='0'
apply(R.parent/'school06/tests/local-auth-capabilities.sql')
case('late inventory failure rolls back entire cumulative app install',lambda:deny(sql("SET bogunon.ws_install_mode='isolated';"+migration.read_text().replace('-- Frozen SCHOOL07 extension','SELECT 1/0;\n-- Frozen SCHOOL07 extension'),False),'division by zero'))
assert scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace'AND c.relkind='r'")=='0'
case('empty PG17 cumulative install succeeds',lambda:apply(migration))
case('all54 raw/public/private new purpose endpoints CLOSED',lambda:assertion(scalar("SELECT count(*)=54 AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'))
case('repeat CLOSED candidate no-op',lambda:apply(migration))
case('complete installer entry replay skips immutable parent foundation',entry)

def concurrent_replay():
 with concurrent.futures.ThreadPoolExecutor(2)as ex:list(ex.map(lambda _:apply(migration),range(2)))
case('concurrent repeated install serialized',concurrent_replay)
case('explicit cumulative activation opens only54 fixed wrappers',lambda:apply(R/'sql/activate-local.sql'))
def permission_proof():
 assert scalar("SELECT count(*)=54 AND bool_and(has_function_privilege('authenticated',public_signature,'EXECUTE')AND has_function_privilege('authenticated',private_signature,'EXECUTE')AND NOT has_function_privilege('anon',public_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'
 assert scalar("SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private'AND NOT EXISTS(SELECT 1 FROM workspace_private.s08_rpc_manifest m WHERE m.private_signature=p.oid::regprocedure::text)AND has_function_privilege('authenticated',p.oid,'EXECUTE')")=='0'
 assert scalar("SELECT count(*)FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader','ws_owner')AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin")=='3'
 assert scalar("SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r'AND(NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_get_userbyid(c.relowner)<>'ws_owner')")=='0'
case('54 exact EXECUTE chains, private helpers denied, all tables FORCE RLS/nonowner runtime',permission_proof)

case('repeat ACTIVE candidate no-op',lambda:apply(migration))
case('complete ACTIVE installer entry replay preserves permissions',entry)
case('legacy public metadata/policies/personal fixture rows unchanged',lambda:assertion(legacy()==before))
(R/'evidence/object-inventory.json').write_text(sql((R.parent/'school06/sql/inventory-readonly.sql').read_text()).stdout.strip())
if os.environ.get('SCHOOL08_REGRESSION','1')=='1':
 runpy.run_path(str(R.parent/'school06/tests/security-regression.py'))['run'](R,REPO,D,NAME,ENV,sql)
# Reuse actual S07 domain security scenarios against this cumulative install; skip only its old installer lifecycle.
s=(R.parent/'school07/tests/run.py').read_text();a=s.index(' for f in sorted(');b=s.index(' item={}',a)
s=s[:a]+" for f in ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']:sql((REPO/f).read_text())\n"+s[b:]
s=s.replace("case('SCHOOL06 replay fails closed on intentional extension, originals preserved',lambda:assertion(apply(next((REPO/'school-workspace/school06/supabase/migrations').glob('*core.sql')),False).returncode!=0))",'')
s=s.replace("if os.environ.get('SCHOOL07_POSTGREST','1')", "if False and os.environ.get('SCHOOL07_POSTGREST','1')").replace("(R/'evidence/db-results.json')", "(R/'evidence/inventory-regression.json')").replace('bogunon-school07-pg',NAME)
ns={'__name__':'reused_inventory','__file__':str(R/'tests/reused.py')};exec(compile(s,'<unchanged S07 domain scenarios>','exec'),ns);ns['main']()
# actual PostgREST7; local synthetic issuer explicitly distinct from Hosted.
runpy.run_path(str(R.parent/'school07/tests/postgrest.py'))['run'](sql,case,R,D,NAME,ENV)
# Additional Main/BFF/UI integration scripts run before closing the cumulative lifecycle.
if os.environ.get('SCHOOL08_FLOW','1')=='1':
 subprocess.run(D+['rename',NAME,'bogunon-school05-pg'],check=True,capture_output=True,env=ENV)
 d['sql'].__globals__['NAME']='bogunon-school05-pg'
 try:
  with (R/'evidence/flow-tests.log').open('w')as log:
   p=subprocess.run(['node','node_modules/vitest/vitest.mjs','run','--config','school-workspace/school08/vitest.config.ts','--reporter=json','--outputFile='+str(R/'evidence/flow-tests.json')],cwd=REPO,env=ENV,stdout=log,stderr=subprocess.STDOUT)
  assert p.returncode==0,'integration flow failed'
  if os.environ.get('SCHOOL08_BROWSER','1')=='1':
   sql("INSERT INTO workspace.membership_permission_overrides VALUES('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',1,'inventory.use','allow','own'),('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',1,'inventory.receive','allow','own')ON CONFLICT DO NOTHING")
   subprocess.run(['bash','school-workspace/school08/run-browser.sh'],cwd=REPO,env=ENV,check=True)
 finally:
  subprocess.run(D+['rename','bogunon-school05-pg',NAME],check=True,capture_output=True,env=ENV)
  d['sql'].__globals__['NAME']=NAME
case('cumulative schema still matches after all domain/UI tests',lambda:apply(migration))
rows=scalar('SELECT count(*)FROM workspace.shared_inventory_movements')
case('close all54 atomically without deleting business data',lambda:apply(R/'sql/close-local.sql'))
assert scalar('SELECT count(*)FROM workspace.shared_inventory_movements')==rows
case('closed candidate replays and reopens coherently',lambda:(apply(migration),apply(R/'sql/activate-local.sql')))
sql("ALTER FUNCTION public.ws_v1_list_inventory_items(uuid,jsonb)SET search_path='public'")
case('public wrapper drift blocks install and activation',lambda:(assertion(apply(migration,False).returncode!=0),assertion(apply(R/'sql/activate-local.sql',False).returncode!=0)))
case('drift emergency closure keeps data and marks unverified',lambda:apply(R/'sql/close-local.sql'))
assert scalar("SELECT state FROM workspace_private.s08_release")=='closed_unverified'
assert rows==scalar('SELECT count(*)FROM workspace.shared_inventory_movements')
(R/'evidence/install-results.json').write_text(json.dumps({'checks':d['results'],'pass':len(d['results']),'fail':0,'classification':'LOCAL DB / LOCAL POSTGREST per check','hosted':'NOT RUN','windows':'NOT RUN'},indent=2))
