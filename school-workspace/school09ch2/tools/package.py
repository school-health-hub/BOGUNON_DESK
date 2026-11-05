"""Small focused handoff: new stage + exact prerequisite files, not old product builds."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,sys
E=Path(__file__).resolve().parents[1];R=E.parents[1];out=Path(sys.argv[1]if len(sys.argv)>1 else'/tmp/bogunon-school-09ch2').resolve();out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args],cwd=R,text=True).strip()
assert not git('status','--porcelain'),'Worktree must be clean'
sha=git('rev-parse','HEAD');base='78016384a304540a1097935f454501d84c1367a9'
inputs=json.loads((E/'reference/inputs.json').read_text());paths={x['path']for x in inputs['files']}|set(git('ls-files','school-workspace/school09ch2').splitlines())
data={'source/'+p:(R/p).read_bytes()for p in paths}
receipt={'source_sha':sha,'restore_base':base,'integration_base':'39c775cdd11509fdc6bc930ef62990acdd1e1315','branch':git('branch','--show-current'),'remote_head':git('rev-parse','@{upstream}'),'divergence':git('rev-list','--left-right','--count','HEAD...@{upstream}'),'worktree':'clean','hosted':'NOT RUN','changed_paths':git('diff','--name-only',base,sha).splitlines()}
assert sha==receipt['remote_head']and receipt['divergence'].split()==['0','0']
data['GIT_RECEIPT.json']=json.dumps(receipt,indent=2).encode();data['REPORT.md']=(E/'REPORT.md').read_bytes();data['VERIFY_SHA256.py']=(E/'tools/verify-package.py').read_bytes();data['changes.patch']=subprocess.check_output(['git','diff','--binary',base,sha],cwd=R)
data['RESTORE.txt']=b'''SCHOOL09C-H2 split-principal A2 local candidate. Overall Hosted deployment BLOCKED.
1. Extract into a NEW empty directory. python3 VERIFY_SHA256.py .
2. cd source
   python3 school-workspace/school09ch2/tools/verify-inputs.py
   python3 school-workspace/school09ch2/tools/build.py
   bash school-workspace/school09ch2/run-local.sh
   Needs Python3/Bash/rg/Docker local socket and approved pinned image access. No Node or Hosted credentials.
3. This contains focused test prerequisites and prior177/23/26 evidence references, not the full product/old suites.
   For full Git reconstruction, fresh checkout restore_base in GIT_RECEIPT.json, then
   git apply --check ../changes.patch and git apply ../changes.patch. Do not overlay newer integration.
4. Hosted SQL file is SELECT metadata only; forward it to authorized ChatGPT READ-ONLY audit.
   01-provider-local.sql is LOCAL ONLY, not an operating/fresh cumulative migration.
   Do not grant Auth owner membership or change DB/GUC guards to force installation.
   No runtime/header tokens, passwords or actual user data are included.
Manifest covers every package file except itself; sidecar SHA-256 covers the ZIP.
'''
m={'source_sha':sha,'files':[{'path':p,'sha256':hashlib.sha256(b).hexdigest()}for p,b in sorted(data.items())]};data['PACKAGE_MANIFEST_SHA256.json']=json.dumps(m,indent=2).encode()
zpath=out/'BOGUNON_DESK_SCHOOL_09CH2_AUTHZ_RESOLUTION.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p,b in sorted(data.items()):z.writestr(p,b)
h=hashlib.sha256(zpath.read_bytes()).hexdigest();(out/(zpath.name+'.sha256')).write_text(h+'  '+zpath.name+'\n')
restore=out/'restore-check';assert not restore.exists()
with zipfile.ZipFile(zpath)as z:z.extractall(restore)
subprocess.run([sys.executable,str(restore/'VERIFY_SHA256.py'),str(restore)],check=True)
subprocess.run([sys.executable,'school-workspace/school09ch2/tools/verify-inputs.py'],cwd=restore/'source',check=True)
(out/'PACKAGE_VALIDATION.json').write_text(json.dumps({'sha256':h,'source_sha':sha,'manifest_files':len(m['files']),'bytes':zpath.stat().st_size,'unzip_hashes':'PASS','restored_inputs_and_function_bodies':'PASS'},indent=2))
print(zpath,h,zpath.stat().st_size)
