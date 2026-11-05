#!/usr/bin/env python3
"""Create a portable handoff from clean, committed source. No credentials or build output."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,sys,shutil
E=Path(__file__).resolve().parents[1];REPO=E.parents[1];out=Path(sys.argv[1]if len(sys.argv)>1 else'/tmp/bogunon-school-09c').resolve();out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO,text=True).strip()
assert not git('status','--porcelain'),'Worktree must be clean'
sha=git('rev-parse','HEAD');base='c41b60bf8da3537104dfdb7ba8a525fa0983de7d'
inputs=json.loads((E/'reference/input-sha256.json').read_text());required={f['path']for f in inputs['files']}
allfiles=git('ls-files').splitlines()
# Include all audit inputs plus full test/support source; skip unrelated binary product assets.
files=[p for p in allfiles if p in required or p.startswith(('school-workspace/','electron-p0/','src/','scripts/'))and Path(p).suffix not in('.png','.jpg','.jpeg','.woff2','.ico','.pdf','.exe')or'/'not in p and Path(p).suffix in('.json','.ts','.mjs','.js')]
# Existing stage evidence is historical/source evidence, never recounted as SCHOOL09 tests.
data={'source/'+p:(REPO/p).read_bytes()for p in files}
receipt={'source_sha':sha,'restore_baseline':base,'integration_baseline':'39c775cdd11509fdc6bc930ef62990acdd1e1315','branch':git('branch','--show-current'),'remote_head':git('rev-parse','@{upstream}'),'divergence':git('rev-list','--left-right','--count','HEAD...@{upstream}'),'working_tree':'clean','hosted':'NOT RUN','windows_new_sha':'NOT RUN','only_changed_paths':git('diff','--name-only',base,sha).splitlines()}
assert receipt['source_sha']==receipt['remote_head']and receipt['divergence'].split()==['0','0']
data['GIT_RECEIPT.json']=json.dumps(receipt,indent=2).encode()
data['REPORT.md']=(E/'REPORT.md').read_bytes();data['VERIFY_SHA256.py']=(E/'tools/verify-package.py').read_bytes()
data['changes.patch']=subprocess.check_output(['git','diff','--binary',base,sha],cwd=REPO)
data['RESTORE.txt']=b'''SCHOOL09C portable handoff. No production access and no automatic install.
1. Extract into a NEW empty directory; preserve prior originals.
2. python3 VERIFY_SHA256.py .
3. Standalone test source is under source/. SQL/test fixtures are synthetic only.
   In source/: python3 school-workspace/school09c/tools/verify-inputs.py
   Use lockfile-matched dependencies (npm ci only in approved network), Docker, Python3, Node and Bash.
   bash school-workspace/school09c/run-local.sh
   Old evidence remains historical; new results go only to school09c/evidence/.
4. For full product restoration, use a fresh checkout of the exact restore_baseline (SCHOOL09A/B) in GIT_RECEIPT.json,
   verify clean then git apply --check ../changes.patch and git apply ../changes.patch.
   Do not overlay the entire source/ on a newer integration. The patch changes only school09c/.
   Unrelated binary product assets/native dependencies are intentionally omitted from this test source package;
   full product builds require the baseline Git checkout. No dependency folders or secrets are included.
5. Read school09c DECISION.md and OAUTH_AND_09D_GATES.md before any proposed Hosted work.
   Current Auth bridge/bootstrap patch is LOCAL ONLY; do not change DB/GUC guards to bypass it.
   Hosted/Windows new-source verification NOT RUN. Overall CONDITIONAL; Hosted application BLOCKED.
Manifest covers all included files except itself; ZIP SHA-256 is provided alongside.
'''
manifest={'source_sha':sha,'files':[{'path':p,'sha256':hashlib.sha256(b).hexdigest()}for p,b in sorted(data.items())]};data['PACKAGE_MANIFEST_SHA256.json']=json.dumps(manifest,indent=2).encode()
zpath=out/'BOGUNON_DESK_SCHOOL_09C_AUTHZ_DECISION.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p,b in sorted(data.items()):z.writestr(p,b)
h=hashlib.sha256(zpath.read_bytes()).hexdigest();(out/(zpath.name+'.sha256')).write_text(h+'  '+zpath.name+'\n')
rest=out/'restore-check';assert not rest.exists(),'Refusing an existing restore destination'
with zipfile.ZipFile(zpath)as z:z.extractall(rest)
subprocess.run([sys.executable,str(rest/'VERIFY_SHA256.py'),str(rest)],check=True)
subprocess.run([sys.executable,'school-workspace/school09c/tools/verify-inputs.py'],cwd=rest/'source',check=True)
(out/'PACKAGE_VALIDATION.json').write_text(json.dumps({'sha256':h,'source_sha':sha,'manifest_files':len(manifest['files']),'bytes':zpath.stat().st_size,'extract_hashes':'PASS','restored_input_provenance':'PASS','db_tests':'see committed evidence; no duplicate scenario count'},indent=2))
print(zpath,h,zpath.stat().st_size)
