"""Build a deterministic delta handoff from committed Git files; no network/DB."""
from pathlib import Path
import subprocess,hashlib,json,zipfile,shutil,sys
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=REPO,text=True).strip()
assert not git('status','--porcelain'),'Require clean committed source'
sha=git('rev-parse','HEAD');branch=git('branch','--show-current');base='243ae95e69483dfbe8d2438c41f858577d748048'
files=git('ls-files','school-workspace/school06').splitlines();assert files and all(n.startswith('school-workspace/school06/')for n in files)
contents={n:(REPO/n).read_bytes()for n in files}
receipt={'source_sha':sha,'branch':branch,'base_integration':base,'school05':'6af60d6a071039a048833f27226f2a3c698fe80c','git_clean':True,'upstream':git('rev-parse','--abbrev-ref','@{upstream}'),'divergence':git('rev-list','--left-right','--count','HEAD...@{upstream}'),'remote_tracking_sha':git('rev-parse','@{upstream}'),'changed_files':git('diff','--name-only',base,'HEAD').splitlines(),'relationship':'Every school-workspace/school06 file is committed, byte-identical. Top-level receipts/manifest are package-only. Baseline sources are fetched by exact SHA, never overlay old SCHOOL packages.'}
assert receipt['upstream']=='origin/'+branch and receipt['remote_tracking_sha']==sha and receipt['divergence'].split()==['0','0']
contents['GIT_RECEIPT.json']=(json.dumps(receipt,indent=2)+'\n').encode()
contents['SCHOOL_06_REPORT.md']=(ROOT/'REPORT.md').read_bytes()+('\n\n최종 Source SHA: `'+sha+'`\n\n일반 push 확인: 원격 feature SHA 일치, divergence0/0, working tree clean.\n').encode()
contents['VERIFY_SHA256.py']=(ROOT/'tools/verify_package.py').read_bytes()
contents['RESTORE.txt']=('SCHOOL-06 reproducible delta package; never apply SQL to production without separate approval.\n\n1. Extract ZIP into a new empty folder.\n2. Run: python3 VERIFY_SHA256.py .\n3. In a separately cloned repository, checkout exact baseline '+base+' on an isolated feature branch; require clean tree. Do not overwrite another worktree.\n4. Copy the packaged school-workspace/school06 directory into the repository at the identical relative path. Refuse if it already exists.\n5. Install dependencies from baseline package-lock (approved registry/CDN access needed). Do not substitute xlsx versions.\n6. Run python3 school-workspace/school06/tools/check_static.py and bash school-workspace/school06/run-local.sh from repo root. Requires Docker Unix socket; no DB URL accepted.\n7. Alternative: checkout Source SHA '+sha+' from branch '+branch+'; all implementation/evidence files already present, no overlay needed.\n8. Read README.md, OPERATIONS.md and AUTH_HOSTED_MATRIX.md before any later approved hosted change. tests/bootstrap.sql and local-auth-capabilities.sql are fixtures ONLY.\n\nOperational standalone SQL: two generated migrations + sql/activation/closure/read-only checks. Full prior source dependencies are in exact Git baseline, hashed in reference/source-sql-manifest.json. Prior handoff ZIP verified; not redundantly applied. No real credentials/users included.\n').encode()
manifest={'source_sha':sha,'base_sha':base,'files':{n:hashlib.sha256(b).hexdigest()for n,b in sorted(contents.items())},'self_exclusion':'Manifest excludes itself; ZIP hash is supplied separately.'}
contents['PACKAGE_MANIFEST_SHA256.json']=(json.dumps(manifest,indent=2)+'\n').encode()
zpath=out/'BOGUNON_DESK_SCHOOL_06_READINESS_SQL_TESTS_EVIDENCE.zip'
with zipfile.ZipFile(zpath,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for n,b in sorted(contents.items()):
  info=zipfile.ZipInfo(n,(2026,11,5,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,b)
extract=out/'verified-extraction';assert not extract.exists(),'Use a fresh output directory for each verification'
with zipfile.ZipFile(zpath)as z:z.extractall(extract)
p=subprocess.run(['python3',str(extract/'VERIFY_SHA256.py'),str(extract)],text=True,capture_output=True,check=True)
(out/'RESTORE_VALIDATION.json').write_text(json.dumps({'sha256_files':len(manifest['files']),'extracted_verified':True,'output':p.stdout.strip(),'archive_bytes':zpath.stat().st_size,'source_sha':sha,'no_hosted_connection':True},indent=2))
for n in ['GIT_RECEIPT.json','SCHOOL_06_REPORT.md','RESTORE.txt']: (out/n).write_bytes(contents[n])
(out/'SHA256SUMS.txt').write_text(hashlib.sha256(zpath.read_bytes()).hexdigest()+'  '+zpath.name+'\n')
print(zpath,p.stdout.strip(),zpath.stat().st_size,sep='\n')
