"""Create an offline source handoff, import closure, patch and SHA verification after clean push."""
from pathlib import Path,PurePosixPath
import subprocess,json,hashlib,zipfile,sys,re
E=Path(__file__).resolve().parents[1];R=E.parents[1];out=Path(sys.argv[1]if len(sys.argv)>1 else'/tmp/bogunon-school-09ch3-final').resolve();out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args],cwd=R,text=True).strip()
assert not git('status','--porcelain'),'clean worktree required'
sha=git('rev-parse','HEAD');base='01647c13283b88e5a73b4c0542fe6d344129216f'
assert sha==git('rev-parse','@{upstream}')and git('rev-list','--left-right','--count','HEAD...@{upstream}').split()==['0','0']
paths={p for p in git('ls-files','school-workspace').splitlines()if '/evidence/'not in p and '__pycache__'not in p and not p.endswith(('.zip','.png','.webp','.jpg','.bin'))}
paths|=set(git('ls-files','school-workspace/school09ch3').splitlines())
paths|={f['path']for f in json.loads((E/'reference/inputs.json').read_text())['files']}
paths|={'package.json','package-lock.json'}|{str(p.relative_to(R))for p in R.glob('tsconfig*.json')}
# Resolve static relative imports, including .js specifiers to TS source, for a complete test closure.
queue=list(paths);seen=set()
while queue:
 name=queue.pop()
 if name in seen:continue
 seen.add(name);f=R/name
 if f.suffix not in('.ts','.tsx','.js','.jsx','.mjs','.cjs'):continue
 for rel in re.findall(r'(?:from\s*|import\s*\(?|require\s*\()\s*[\'\"](\.[^\'\"]+)',f.read_text()):
  target=(f.parent/rel).resolve();candidates=[target]
  if target.suffix=='.js':candidates +=[target.with_suffix('.ts'),target.with_suffix('.tsx')]
  if not target.suffix:candidates +=[Path(str(target)+s)for s in('.ts','.tsx','.js','.json')]+[target/'index.ts',target/'index.tsx']
  found=next((c for c in candidates if c.is_file()),None)
  if found:
   p=str(found.relative_to(R))
   if p not in paths:paths.add(p);queue.append(p)
data={'source/'+p:(R/p).read_bytes()for p in paths}
receipt={'source_sha':sha,'restore_base':base,'integration_base':'39c775cdd11509fdc6bc930ef62990acdd1e1315','branch':git('branch','--show-current'),'remote_head':git('rev-parse','@{upstream}'),'divergence':'0/0','working_tree':'clean','hosted':'NOT RUN','operating_installation':'BLOCKED','changed_paths':git('diff','--name-only',base,sha).splitlines()}
assert all(p.startswith('school-workspace/school09ch3/')for p in receipt['changed_paths'])
data['GIT_RECEIPT.json']=json.dumps(receipt,indent=2).encode();data['REPORT.md']=(E/'REPORT.md').read_bytes();data['VERIFY_SHA256.py']=(E/'tools/verify-package.py').read_bytes()
data['changes.patch']=subprocess.check_output(['git','diff','--binary',base,sha],cwd=R)
data['RESTORE.txt']=b'''SCHOOL09C-H3 local candidate. Operating installation BLOCKED. No Hosted credentials needed.
1. Extract into a NEW empty directory. Run: python3 VERIFY_SHA256.py .
2. cd source
   python3 school-workspace/school09ch3/tools/verify.py
   python3 school-workspace/school09ch3/tools/build.py
   Prepare exact package.json/package-lock dependencies using approved npm procedure (or verified existing cache).
   Do not bypass xlsx403/network policy; if dependencies unavailable, Node contracts NOT RUN, not PASS.
   bash school-workspace/school09ch3/run-local.sh > school-workspace/school09ch3/evidence/reproduced.log 2>&1
   Python3/Bash/rg/Docker local socket/pinned images and Node/Vitest5.0.1 are required.
3. Source includes cumulative SCHOOL prerequisites, frozen tests and their relative import closure.
   node_modules and old builds are excluded. Old Auth grant/A2 files are REFERENCES ONLY.
   Do not execute old foundation/Auth grant scripts before this fresh installer.
4. For full Git restoration: fresh checkout restore_base from GIT_RECEIPT.json, then
   git apply --check ../changes.patch && git apply ../changes.patch. Never overlay another worktree.
5. SQL01 is LOCAL ONLY (school01a/isolated guard). SQL02 is isolated QA activation only.
   SQL04 is metadata SELECT for a separately authorized READ-ONLY audit. No production apply is authorized.
   No passwords, hosted DSNs, JWT signing keys, tokens or actual user/student data are included.
6. results.json/final-run.log is the final full suite; old failed/intermediate evidence remains explicitly labeled.
   Repeated checks and earlier174 PASS are not added to the final unique total.
Manifest covers every package file except itself; ZIP sidecar covers the archive bytes.
'''
m={'source_sha':sha,'files':[{'path':p,'sha256':hashlib.sha256(b).hexdigest()}for p,b in sorted(data.items())]};data['PACKAGE_MANIFEST_SHA256.json']=json.dumps(m,indent=2).encode()
zpath=out/'BOGUNON_DESK_SCHOOL_09CH3_SUPPORTED_AUTH.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for p,b in sorted(data.items()):z.writestr(p,b)
h=hashlib.sha256(zpath.read_bytes()).hexdigest();(out/(zpath.name+'.sha256')).write_text(h+'  '+zpath.name+'\n')
restore=out/'restore-check';assert not restore.exists()
with zipfile.ZipFile(zpath)as z:z.extractall(restore)
subprocess.run([sys.executable,str(restore/'VERIFY_SHA256.py'),str(restore)],check=True)
subprocess.run([sys.executable,'school-workspace/school09ch3/tools/verify.py'],cwd=restore/'source',check=True)
# Generator determinism: extracted sources must reproduce the exact reviewed SQL hashes.
subprocess.run([sys.executable,'school-workspace/school09ch3/tools/build.py'],cwd=restore/'source',check=True)
subprocess.run([sys.executable,'school-workspace/school09ch3/tools/verify.py'],cwd=restore/'source',check=True)
for name,h2 in json.loads((E/'INSTALL_PLAN.json').read_text())['files_sha256'].items():
 assert hashlib.sha256((restore/'source/school-workspace/school09ch3'/name).read_bytes()).hexdigest()==h2,name
(out/'PACKAGE_VALIDATION.json').write_text(json.dumps({'source_sha':sha,'sha256':h,'files':len(m['files']),'bytes':zpath.stat().st_size,'unzip_hashes':'PASS','restored_pinned_inputs':'PASS','regenerated_SQL_identical':'PASS','new_full_suite_rerun':'NOT RUN during packaging; final logs included'},indent=2)+'\n')
assert zpath.stat().st_size<=10*1024*1024,'attachment limit'
print(zpath,h,zpath.stat().st_size,len(m['files']))
