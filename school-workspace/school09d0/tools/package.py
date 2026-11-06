"""Clean pushed Git + focused SQL/Python prerequisites; no product build or credentials."""
from pathlib import Path
import subprocess,hashlib,json,zipfile,sys
E=Path(__file__).resolve().parents[1];R=E.parents[1]
out=Path(sys.argv[1]if len(sys.argv)>1 else'/tmp/bogunon-school-09d0-final').resolve();out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args],cwd=R,text=True).strip()
assert not git('status','--porcelain'),'clean worktree required'
sha=git('rev-parse','HEAD');base='4cacc51d06298ee4118273388513be1599d67095'
assert sha==git('rev-parse','@{upstream}')and git('rev-list','--left-right','--count','HEAD...@{upstream}').split()==['0','0']
paths=set(git('ls-files','school-workspace/school09d0').splitlines())|{f['path']for f in json.loads((E/'reference/inputs.json').read_text())['files']}
paths|={'school-workspace/local/tests/auth_fixture.sql','school-workspace/local/tests/fixtures.sql','school-workspace/school06/tests/bootstrap.sql'}
data={'source/'+p:(R/p).read_bytes()for p in paths}
receipt={'source_sha':sha,'restore_base':base,'branch':git('branch','--show-current'),'remote_head':git('rev-parse','@{upstream}'),'divergence':'0/0','working_tree':'clean','integration_base':'39c775cdd11509fdc6bc930ef62990acdd1e1315','changed_paths':git('diff','--name-only',base,sha).splitlines(),'hosted':'NOT RUN','operating_apply':'BLOCKED'}
assert all(p.startswith('school-workspace/school09d0/')for p in receipt['changed_paths'])
data['GIT_RECEIPT.json']=json.dumps(receipt,indent=2).encode();data['REPORT.md']=(E/'REPORT.md').read_bytes();data['VERIFY_SHA256.py']=(E/'tools/verify-package.py').read_bytes();data['changes.patch']=subprocess.check_output(['git','diff','--binary',base,sha],cwd=R)
data['RESTORE.txt']=b'''SCHOOL09D-0 final CLOSED candidate. Operating application is BLOCKED, not authorized.
1. Extract into a NEW empty directory. Run: python3 VERIFY_SHA256.py .
2. cd source
   python3 school-workspace/school09d0/tools/verify.py
   python3 school-workspace/school09d0/tools/build.py
   bash school-workspace/school09d0/run-local.sh > school-workspace/school09d0/evidence/reproduced.log 2>&1
   Requires Python3, Bash, rg, Docker local socket and approved access to pinned PG17.6/PostgREST13.0.4 images.
   No Node, actual Supabase DSN/key or user account required. Tests create only owned synthetic containers.
3. This contains the complete cumulative SQL + exact Python/SQL test prerequisites and H3 evidence references.
   Old H3 artifacts are references/reproduction inputs, NOT additional installation steps.
   H3 domain137 results are reused on identical161 function definitions, not rerun or added to the new count.
4. For full repository restoration: fresh checkout restore_base in GIT_RECEIPT.json,
   then git apply --check ../changes.patch and git apply ../changes.patch. Never overlay another worktree.
5. Review sequence is00 SELECT ->01 CLOSED install candidate ->02 SELECT postflight.
   03 is emergency close only. tests/ activation is LOCAL QA ONLY, excluded from installation.
   Project/plan GUC markers are NOT proof of endpoint identity or user approval.
   Do NOT execute on Hosted before separate permissions/security/policy/backup/auth-test approval.
6. final-run.log/results.json is final evidence. Earlier attempt/intermediate logs remain explicitly separate.
Manifest covers every file except itself; ZIP sidecar covers archive bytes. No actual credentials or personal data included.
'''
m={'source_sha':sha,'files':[{'path':p,'sha256':hashlib.sha256(b).hexdigest()}for p,b in sorted(data.items())]};data['PACKAGE_MANIFEST_SHA256.json']=json.dumps(m,indent=2).encode()
zpath=out/'BOGUNON_DESK_SCHOOL_09D0_FINAL_PREFLIGHT.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p,b in sorted(data.items()):z.writestr(p,b)
h=hashlib.sha256(zpath.read_bytes()).hexdigest();(out/(zpath.name+'.sha256')).write_text(h+'  '+zpath.name+'\n')
restore=out/'restore-check';assert not restore.exists()
with zipfile.ZipFile(zpath)as z:z.extractall(restore)
subprocess.run([sys.executable,str(restore/'VERIFY_SHA256.py'),str(restore)],check=True)
subprocess.run([sys.executable,'school-workspace/school09d0/tools/verify.py'],cwd=restore/'source',check=True)
subprocess.run([sys.executable,'school-workspace/school09d0/tools/build.py'],cwd=restore/'source',check=True)
subprocess.run([sys.executable,'school-workspace/school09d0/tools/verify.py'],cwd=restore/'source',check=True)
for name,h2 in json.loads((E/'INSTALL_PLAN.json').read_text())['files_sha256'].items():assert hashlib.sha256((restore/'source/school-workspace/school09d0'/name).read_bytes()).hexdigest()==h2,name
(out/'PACKAGE_VALIDATION.json').write_text(json.dumps({'source_sha':sha,'sha256':h,'files':len(m['files']),'bytes':zpath.stat().st_size,'unzip_exact_files_and_hashes':'PASS','pinned_inputs':'PASS','regenerated_SQL_identical':'PASS','new_full_suite_repeat_during_packaging':'NOT RUN; validated logs included'},indent=2)+'\n')
assert zpath.stat().st_size<10*1024*1024
print(zpath,h,zpath.stat().st_size,len(m['files']))
