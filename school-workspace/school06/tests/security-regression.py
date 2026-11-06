from pathlib import Path
import importlib.util,json,subprocess

def run(ROOT,REPO,DOCKER,NAME,ENV,sql):
 spec=importlib.util.spec_from_file_location('original01',REPO/'school-workspace/local/tests/run.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a);a.NAME=NAME
 def reset():
  sql((REPO/'school-workspace/local/tests/fixtures.sql').read_text())
  sql("INSERT INTO workspace.s02_directory(school_id,office_code,school_code,school_name,office_name,kind)SELECT id,office_code,school_code,name,'합성 교육청','합성 학교'FROM workspace.schools")
 a.reset=reset
 for name,fn in sorted(vars(a).items()):
  if name.startswith('t')and name[1:].isdigit():a.test(name,fn)
 (ROOT/'evidence/school01-invariants.json').write_text(json.dumps({'classification':'LOCAL DB; original SCHOOL01 tests + synthetic directory adapter only','pass':sum(x['status']=='PASS'for x in a.RESULT),'fail':sum(x['status']=='FAIL'for x in a.RESULT),'tests':a.RESULT},ensure_ascii=False,indent=2))
 assert not any(x['status']=='FAIL'for x in a.RESULT),'SCHOOL01 invariant failure'
 # Keep original sources untouched. Only rename the container ID owned by this run.
 for stage in ['school02','school03','school04']:
  alias='bogunon-'+stage+'-pg';p=subprocess.run(DOCKER+['inspect',alias],capture_output=True,env=ENV);assert p.returncode,'Refusing an existing regression container'
  subprocess.run(DOCKER+['rename',NAME,alias],check=True,capture_output=True,env=ENV)
  try:
   with (ROOT/'evidence'/f'{stage}-regression.log').open('w')as log:
    p=subprocess.run(['node','node_modules/vitest/vitest.mjs','run','--config',f'school-workspace/{stage}/vitest.config.ts','--reporter=verbose','--reporter=json','--outputFile='+str(ROOT/'evidence'/f'{stage}-regression.json')],cwd=REPO,env=ENV,stdout=log,stderr=subprocess.STDOUT)
   assert p.returncode==0,stage+' regression failed'
  finally:subprocess.run(DOCKER+['rename',alias,NAME],check=True,capture_output=True,env=ENV)
