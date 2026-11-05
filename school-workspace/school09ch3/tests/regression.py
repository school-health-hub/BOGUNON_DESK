"""Reuse frozen business tests against the new fresh SQL; only fixture/endpoint adapters change."""
from pathlib import Path
import importlib.util,runpy,json,subprocess,tempfile,os,shutil

def run(E,sql,case,check,run_file):
 P=E.parent;REPO=P.parent
 spec=importlib.util.spec_from_file_location('original01',P/'local/tests/run.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 m.NAME='bogunon-school09ch3-pg';original=m.command
 m.command=lambda user:original('fixture_root'if user=='postgres'else user)
 def reset():
  sql((P/'local/tests/fixtures.sql').read_text());sql("INSERT INTO workspace.s02_directory(school_id,office_code,school_code,school_name,office_name,kind)SELECT id,office_code,school_code,name,'합성 교육청','합성 학교'FROM workspace.schools")
 m.reset=reset
 for name,fn in sorted(vars(m).items()):
  if name.startswith('t')and name[1:].isdigit():
   def one(fn=fn):reset();fn()
   case('REGRESSION S01 '+name,one)
 # Same31 domain cases as09C, not their obsolete installer or separate REST harness.
 s=(P/'school07/tests/run.py').read_text();a=s.index(' for f in sorted(');b=s.index(' item={}',a)
 s=s[:a]+" for f in ['local/tests/fixtures.sql','integration/sql/multi-school-fixture.sql','school02/sql/fixtures.sql','school03/sql/fixtures.sql']:sql((R.parent/f).read_text())\n"+s[b:]
 a=s.index(" case('SCHOOL06 replay fails closed");s=s[:a]+"\n"+"def assertion(x):assert x\n"
 ns={'__name__':'reused','__file__':str(E/'tests/reused.py')};exec(compile(s,'<frozen S07 domain regression>','exec'),ns)
 ns.update({'sql':sql,'NAME':'bogunon-school09ch3-pg','R':E,'REPO':REPO,'case':lambda name,fn:case('REGRESSION Inventory '+name,fn)})
 ns['main']()
 # Frozen DB contracts retain real user-scoped AuthAdapter→RPC calls. Only DBA fixture identity is mapped.
 env={k:v for k,v in os.environ.items()if k not in('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
 docker_binary=shutil.which('docker',path=env['PATH']);assert docker_binary,'Docker CLI required'
 env['H3_DOCKER_BIN']=docker_binary
 docker=[docker_binary,'--host=unix:///var/run/docker.sock']
 with tempfile.TemporaryDirectory(prefix='h3-fixture-adapter-')as tmp:
  Path(tmp,'docker').symlink_to(E/'tools/docker-shim.py');env['PATH']=tmp+os.pathsep+env['PATH']
  for stage in ['school02','school03','school04']:
   alias='bogunon-'+stage+'-pg'
   assert subprocess.run(docker+['inspect',alias],capture_output=True).returncode,'refuse existing regression container'
   subprocess.run(docker+['rename','bogunon-school09ch3-pg',alias],check=True,capture_output=True)
   try:
    log=E/'evidence'/f'{stage}-db-contracts.log';report=E/'evidence'/f'{stage}-db-contracts.json'
    with log.open('w')as out:
     proc=subprocess.run(['node','node_modules/vitest/vitest.mjs','run','--config',f'school-workspace/{stage}/vitest.config.ts',f'school-workspace/{stage}/tests/'+('tasks.test.ts'if stage=='school03'else'contracts.test.ts'),'--reporter=verbose','--reporter=json','--outputFile='+str(report)],cwd=REPO,env=env,stdout=out,stderr=subprocess.STDOUT)
    assert proc.returncode==0,stage+' DB contract regression failed; see separate log'
    j=json.loads(report.read_text());assert j['numFailedTests']==0
    for file in j['testResults']:
     for test in file['assertionResults']:
      assert test['status']=='passed',test['fullName']
      case('REGRESSION '+stage+' '+test['fullName'],lambda:None)
   finally:subprocess.run(docker+['rename',alias,'bogunon-school09ch3-pg'],check=True,capture_output=True)
 # Draft bootstrap control remains CLOSED by default; only explicit local activation for existing tests.
 sql((P/'local/tests/fixtures.sql').read_text())
 for f in ['integration/sql/multi-school-fixture.sql','school02/sql/fixtures.sql','school03/sql/fixtures.sql']:sql((P/f).read_text())
 sql('GRANT EXECUTE ON FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)TO ws_bootstrap_operator')
 d={'sql':sql,'scalar':lambda q:sql(q).stdout.strip().splitlines()[-1],'rpc':ns['rpc'],'lit':ns['lit'],'deny':ns['deny'],'assertion':check,'A':ns['A'],'B':ns['B']}
 # Only final old metadata SELECT location needs adaptation; no original test assertions are changed.
 s=(P/'school09c/tests/bootstrap.py').read_text().replace("(E/'sql/hosted-readonly.sql')","(E/'sql/04-hosted-readonly.sql')")
 boot={};exec(compile(s,'<frozen09C bootstrap policy tests>','exec'),boot);boot['run'](sql,lambda n,fn:case('REGRESSION '+n,fn),E,d)
 sql('REVOKE EXECUTE ON FUNCTION workspace_bootstrap.command(text,uuid,uuid,uuid,text,uuid,bigint,uuid)FROM ws_bootstrap_operator')
 # operators/objects added by the fixture are removed; production installation never includes these accounts.
 sql('TRUNCATE workspace_bootstrap.operators CASCADE;TRUNCATE workspace_bootstrap.receipts;DROP ROLE s09c_verifier_a;DROP ROLE s09c_verifier_b;')
 reset()
