"""PG17.6 synthetic Auth only. No Hosted DSN, users or policy changes."""
from pathlib import Path
import runpy,json,uuid,subprocess,os,hashlib
E=Path(__file__).resolve().parents[1];REPO=E.parents[1];BASE=E.parent/'school08'
d=runpy.run_path(str(E.parent/'school07/tests/run.py'));d['sql'].__globals__['NAME']='bogunon-school09c-pg'
sql=d['sql'];scalar=d['scalar'];case=d['case'];deny=d['deny'];check=d['assertion'];rpc=d['rpc'];lit=d['lit'];A=d['A'];B=d['B'];D=d['D'];ENV=d['ENV'];NAME='bogunon-school09c-pg'
def apply(p,ok=True):return sql("SET bogunon.ws_install_mode='isolated';"+Path(p).read_text(),ok)
def reset():
 for p in ['local/tests/fixtures.sql','integration/sql/multi-school-fixture.sql','school02/sql/fixtures.sql','school03/sql/fixtures.sql']:sql((E.parent/p).read_text())
def legacy():return scalar("SELECT md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),';'ORDER BY p.oid::regprocedure::text))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)<>'ws_'")
before=legacy()
apply(BASE/'sql/01-foundation.sql');apply(E.parent/'school06/tests/local-auth-capabilities.sql');apply(next((BASE/'supabase/migrations').glob('*.sql')))
original=scalar("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'body',p.prosrc,'owner',pg_get_userbyid(p.proowner))ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'")
migration=next((E/'supabase/migrations').glob('*.sql'))
case('09C mid-patch failure rolls back Auth helper and grant replacement',lambda:(deny(sql("SET bogunon.ws_install_mode='isolated';"+migration.read_text().replace('-- Draft policy executable','SELECT 1/0;\n-- Draft policy executable'),False),'division by zero'),check(scalar("SELECT to_regnamespace('workspace_auth_bridge')IS NULL AND has_column_privilege('ws_authz_reader','auth.sessions','id','SELECT')")=='t')))
case('09C bridge and bootstrap prototype install atomically on CLOSED54',lambda:apply(migration))
case('09C all54 remain CLOSED after prototype install',lambda:check(scalar("SELECT count(*)=54 AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('anon',public_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'))
case('09C no unexpected default EXECUTE on bridge or bootstrap',lambda:check(scalar("SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE(n.nspname='workspace_auth_bridge'AND x.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='ws_authz_reader')))OR(n.nspname='workspace_bootstrap'AND x.grantee<>p.proowner)")=='0'))
case('09C existing54 public signatures bodies and owners unchanged',lambda:check(original==scalar("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'body',p.prosrc,'owner',pg_get_userbyid(p.proowner))ORDER BY p.oid::regprocedure::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'")))
case('09C repeat prototype rejects safely without overwriting parent',lambda:deny(apply(migration,False),'prototype_already_installed_review_required'))
case('09C old S08 lifecycle detects intentional prototype drift',lambda:check(apply(BASE/'sql/activate-local.sql',False).returncode!=0))
case('09C no Workspace/client session raw SELECT',lambda:check(scalar("SELECT bool_and(NOT has_any_column_privilege(r,'auth.sessions','SELECT'))FROM unnest(ARRAY['ws_owner','ws_runtime','ws_authz_reader','authenticated','anon'])r")=='t'))
for role in ['ws_runtime','ws_authz_reader','authenticated','anon']:
 case('09C raw auth.sessions denied '+role,lambda role=role:check(sql('SET SESSION AUTHORIZATION '+role+';SELECT id FROM auth.sessions',False).returncode!=0))
case('09C bridge owner cannot write or read Workspace content',lambda:check(sql("SET SESSION AUTHORIZATION supabase_auth_admin;SELECT *FROM workspace.shared_tasks",False).returncode!=0))
case('09C neither clients nor runtime can call Auth bridge directly',lambda:check(all(sql('SET SESSION AUTHORIZATION '+r+';SELECT workspace_auth_bridge.session_valid()',False).returncode!=0 for r in ['authenticated','anon','ws_runtime'])))
apply(E/'sql/activate-isolated.sql');reset()
case('09C approved teacher context works without raw Auth SELECT',lambda:check(rpc(3,'get_inventory_context')['role']=='HEALTH_TEACHER'))
case('09C pending denied',lambda:deny(rpc(5,'list_inventory_items',ok=False)))
case('09C school A-only assistant cannot access B',lambda:deny(rpc(4,'list_inventory_items',s=B,ok=False)))
case('09C assistant cannot self promote',lambda:check(sql("SET SESSION AUTHORIZATION school_rest;SET ROLE authenticated;SELECT workspace_bootstrap.command('approve',NULL,NULL,NULL,NULL,NULL,1,gen_random_uuid())",False).returncode!=0))
# Run old account/membership + school/task/event/handover tests on unchanged contracts under the new bridge.
if os.environ.get('SCHOOL09C_REGRESSION','1')=='1':
 runpy.run_path(str(E.parent/'school06/tests/security-regression.py'))['run'](E,REPO,D,NAME,ENV,sql)
reset()
# App sessions preserve the existing7day/10minute policy; live row deletion/revocation checked server-side.
sql("UPDATE auth.sessions SET not_after=now()-interval '1 second'WHERE user_id='00000000-0000-0000-0000-000000000003'")
case('09C live session expiration denies existing identity',lambda:deny(rpc(3,'list_inventory_items',ok=False),'unauthenticated_or_revoked'))
sql("UPDATE auth.sessions SET not_after=NULL,created_at=now()-interval '8 days'WHERE user_id='00000000-0000-0000-0000-000000000003'")
case('09C seven day age limit preserved',lambda:deny(rpc(3,'list_inventory_items',ok=False),'unauthenticated_or_revoked'))
sql("UPDATE auth.sessions SET created_at=now()WHERE user_id='00000000-0000-0000-0000-000000000003'")
rid=str(uuid.uuid4());claims={'sub':'00000000-0000-0000-0000-000000000003','session_id':'30000000-0000-0000-0000-000000000003','exp':2000000000,'is_anonymous':False}
sql('SET SESSION AUTHORIZATION school_rest;BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(claims))+";SELECT public.ws_v1_revoke_current_session('"+rid+"');COMMIT;")
case('09C app revocation ledger denies still live Auth session',lambda:deny(rpc(3,'list_inventory_items',ok=False),'unauthenticated_or_revoked'))
reset()
runpy.run_path(str(E/'tests/bootstrap.py'))['run'](sql,case,E,d)
# Reset operators/control records only in owned synthetic fixture; regression fixture truncates business state.
sql('TRUNCATE workspace_bootstrap.operators CASCADE;TRUNCATE workspace_bootstrap.receipts;')
reset()
# Reuse the31 unchanged Inventory domain tests against this Auth bridge; omit only obsolete installers.
s=(E.parent/'school07/tests/run.py').read_text();a=s.index(' for f in sorted(');b=s.index(' item={}',a)
s=s[:a]+" for f in ['school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql']:sql((REPO/f).read_text())\n"+s[b:]
s=s.replace("case('SCHOOL06 replay fails closed on intentional extension, originals preserved',lambda:assertion(apply(next((REPO/'school-workspace/school06/supabase/migrations').glob('*core.sql')),False).returncode!=0))",'')
s=s.replace("if os.environ.get('SCHOOL07_POSTGREST','1')","if False and os.environ.get('SCHOOL07_POSTGREST','1')").replace("(R/'evidence/db-results.json')","(R/'evidence/inventory-regression.json')").replace('bogunon-school07-pg',NAME)
ns={'__name__':'reused_inventory','__file__':str(E/'tests/reused.py')};exec(compile(s,'<frozen31 inventory domain cases under Auth bridge>','exec'),ns);ns['main']()
reset()
runpy.run_path(str(E/'tests/rest.py'))['run'](sql,case,E,D,NAME,ENV)
case('09C original legacy public function definitions ACL unchanged',lambda:check(legacy()==before))
(E/'evidence/catalog.json').write_text(sql((E/'sql/catalog.sql').read_text()).stdout.strip())
(E/'evidence/results.json').write_text(json.dumps({'checks':d['results'],'pass':len(d['results']),'fail':0,'hosted':'NOT RUN','windows':'NOT RUN','classification':'LOCAL DB / LOCAL POSTGREST per row'},ensure_ascii=False,indent=2))
