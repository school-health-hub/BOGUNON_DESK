"""Fresh synthetic CLOSED catalog, no external DB parameters."""
from pathlib import Path
import runpy,subprocess,time,json
E=Path(__file__).resolve().parents[1];REPO=E.parents[1]
d=runpy.run_path(str(E.parent/'school07/tests/run.py'));D=d['D'];ENV=d['ENV'];NAME='bogunon-school09c-catalog';d['sql'].__globals__['NAME']=NAME;sql=d['sql'];apply=d['apply']
p=subprocess.run(D+['inspect',NAME],capture_output=True,env=ENV);assert p.returncode,'Refusing an existing container'
id=subprocess.check_output(D+['run','-d','--name',NAME,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=school01a','postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3','-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=panic'],env=ENV,text=True).strip()
try:
 for _ in range(120):
  logs=subprocess.run(D+['logs',id],env=ENV,capture_output=True,text=True)
  if'init process complete'in(logs.stdout+logs.stderr) and sql('SELECT 1',False).returncode==0:break
  time.sleep(.25)
 else:
  (E/'evidence/catalog-container-diagnostic.log').write_text((logs.stdout+logs.stderr)[-3000:]);raise AssertionError('PG readiness failed')
 for p in ['local/tests/auth_fixture.sql','school06/tests/bootstrap.sql','school08/sql/01-foundation.sql','school06/tests/local-auth-capabilities.sql']:apply(E.parent/p)
 apply(next((E.parent/'school08/supabase/migrations').glob('*.sql')))
 apply(next((E/'supabase/migrations').glob('*.sql')))
 c=json.loads(sql((E/'sql/catalog.sql').read_text()).stdout.strip())
 assert len(c['functions'])==159 and len(c['tables'])==36 and len(c['policies'])==92
 assert all(not f['authenticated_execute']and not f['public_execute']and not f['anon_execute']for f in c['functions']if f['schema']=='public')
 assert all(not f['authenticated_execute']and not f['public_execute']and not f['anon_execute']for f in c['functions']if f['schema']in('workspace_auth_bridge','workspace_bootstrap'))
 (E/'evidence/catalog-closed.json').write_text(json.dumps(c,ensure_ascii=False,indent=2))
 (E/'evidence/closed-catalog-check.json').write_text(json.dumps({'functions':159,'tables':36,'policies_all4schemas':92,'public_rpc':54,'closed':'PASS','hosted':'NOT RUN','classification':'LOCAL DB'},indent=2))
 print('PASS fresh CLOSED catalog:159 functions /36 tables /92 RLS policies; public54+new private functions client CLOSED')
finally:subprocess.run(D+['rm','-f',id],env=ENV,check=True,capture_output=True)
