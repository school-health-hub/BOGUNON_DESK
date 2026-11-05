"""Deterministic Git delta handoff; no network/DB. Run only after explicit feature push."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,sys
R=Path(__file__).resolve().parents[1];REPO=R.parents[1];base='eca3ef6bcb62bd2a78526e4c12a02e8db5f381c6';out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=REPO,text=True).strip()
assert not git('status','--porcelain'),'Clean committed source required'
sha=git('rev-parse','HEAD');branch=git('branch','--show-current');assert branch=='feature/school-07-shared-inventory';assert git('rev-parse','@{upstream}')==sha;assert git('rev-list','--left-right','--count','HEAD...@{upstream}').split()==['0','0']
files=git('diff','--name-only',base,'HEAD').splitlines();assert all((REPO/n).is_file()for n in files)
contents={n:(REPO/n).read_bytes()for n in files}
receipt={'source_sha':sha,'branch':branch,'parent_school06':base,'baseline_integration':'243ae95e69483dfbe8d2438c41f858577d748048','upstream':git('rev-parse','--abbrev-ref','@{upstream}'),'remote_tracking_sha':git('rev-parse','@{upstream}'),'divergence':'0/0','working_tree':'clean','changed_files':files,'source_relation':'All delta implementation/evidence files byte-identical to committed Git; top-level report/restore/receipt/manifest package-only. Preserved SCHOOL06 fetched from exact parent, no duplicate overlay.'}
contents['GIT_RECEIPT.json']=(json.dumps(receipt,indent=2)+'\n').encode()
contents['SCHOOL_07_REPORT.md']=(R/'REPORT.md').read_bytes()+('\n\n최종 Source SHA: `'+sha+'`\n\n원격 feature 일반 push 확인, divergence0/0, working tree clean.\n').encode()
contents['VERIFY_SHA256.py']=(R/'tools/verify_package.py').read_bytes()
contents['RESTORE.txt']=('SCHOOL07 Git delta, requires exact SCHOOL06 parent '+base+'.\n\n1. Unzip into a new empty folder. python3 VERIFY_SHA256.py .\n2. Clone repository into a separate directory and checkout exact parent SHA on a new isolated branch; require clean working tree.\n3. Overlay ONLY files listed in PACKAGE_MANIFEST_SHA256.json under school-workspace/ and electron-p0/. Existing files must be identical to that parent; refuse other worktree changes. Do not overlay top-level receipt/report/manifest into product source.\n4. Install exact package-lock dependencies; Docker Unix socket/Python3/Node/OpenSSL/Chromium required. No production DB URL.\n5. Run python3 school-workspace/school07/tools/check_static.py. Then SCHOOL07_REGRESSION=1 SCHOOL07_TS_TESTS=1 SCHOOL07_BROWSER=1 bash school-workspace/school07/run-local.sh.\n6. Alternative: checkout Git Source '+sha+' on '+branch+'; no overlay required.\n7. Read README.md and REPORT.md. LOCAL-ONLY migration, both parent/child RPC exposure CLOSED by default; hosted activation is not approved. No operation on existing Supabase project.\n\nImage downloads are pinned. Full Electron requires locked xlsx; baseline CDN403/missing dependency was not bypassed. Old parent source is not redundantly bundled: exact Git reference and preservation hashes are included. No secrets/tokens/real school users.\n').encode()
manifest={'source_sha':sha,'base_sha':base,'files':{n:hashlib.sha256(b).hexdigest()for n,b in sorted(contents.items())},'self_exclusion':'Manifest excludes itself; archive hash supplied separately.'};contents['PACKAGE_MANIFEST_SHA256.json']=(json.dumps(manifest,indent=2)+'\n').encode()
zpath=out/'BOGUNON_DESK_SCHOOL_07_SHARED_INVENTORY.zip'
with zipfile.ZipFile(zpath,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for n,b in sorted(contents.items()):
  i=zipfile.ZipInfo(n,(2026,11,5,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16;z.writestr(i,b)
extract=out/'verified-extraction';assert not extract.exists(),'Fresh output directory required'
with zipfile.ZipFile(zpath)as z:z.extractall(extract)
p=subprocess.run(['python3',str(extract/'VERIFY_SHA256.py'),str(extract)],capture_output=True,text=True,check=True)
(out/'RESTORE_VALIDATION.json').write_text(json.dumps({'source_sha':sha,'extracted_hashes_verified':True,'files':len(manifest['files']),'bytes':zpath.stat().st_size,'verification':p.stdout.strip(),'hosted':'NOT RUN','windows':'NOT RUN'},indent=2))
for n in ['GIT_RECEIPT.json','SCHOOL_07_REPORT.md','RESTORE.txt']:(out/n).write_bytes(contents[n])
(out/'SHA256SUMS.txt').write_text(hashlib.sha256(zpath.read_bytes()).hexdigest()+'  '+zpath.name+'\n');print(zpath,p.stdout.strip(),sep='\n')
