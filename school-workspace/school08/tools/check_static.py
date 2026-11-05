from pathlib import Path
import subprocess,hashlib,json,re
R=Path(__file__).resolve().parents[1];REPO=R.parents[1];BASE='282b6bcd905584bd0504f65d297133a3d563611d'
def git(*a):return subprocess.check_output(['git',*a],cwd=REPO,text=True).strip()
paths=list((R/'supabase/migrations').glob('*.sql'))+list((R/'sql').glob('*.sql'))+[R/'reference/sql-provenance.json'];old={str(p):p.read_bytes()for p in paths};subprocess.run(['python3',str(R/'tools/build_sql.py')],cwd=REPO,check=True);assert all(p.read_bytes()==old[str(p)]for p in paths)
assert not git('diff',BASE,'--','school-workspace/school06','school-workspace/school07/sql','school-workspace/school07/supabase','school-workspace/school05','electron-p0/main','electron-p0/preload','electron-p0/workspace-protocol.ts')
allowed='school-workspace/school07/ui/InventoryWorkspace.tsx'
changed=[n for n in git('diff','--name-only',BASE).splitlines()if not n.startswith('school-workspace/school08/')];assert changed==[allowed],changed
original=subprocess.check_output(['git','show',BASE+':'+allowed],cwd=REPO).decode();current=(REPO/allowed).read_text();assert original.replace('!s.item.active','!s.item?.active')==current
protected=[n for n in git('ls-files').splitlines()if n.startswith(('src/','electron-p0/main/inventory','electron-p0/inventory-','school-workspace/auth/','school-workspace/integration/'))]
for n in protected:assert(REPO/n).read_bytes()==subprocess.check_output(['git','show',BASE+':'+n],cwd=REPO),n
m=json.loads((R/'reference/sql-provenance.json').read_text());assert m['public_rpc_count']==54
for s in m['sources']:assert hashlib.sha256((REPO/s['path']).read_bytes()).hexdigest()==s['sha256']
s='\n'.join(p.read_text()for p in paths if p.suffix=='.sql');assert not re.search(r'GRANT[^;]*\bauth\.',s,re.I);assert not re.search(r'\b(?:owns_project|receive_medication)\s*\(',s)
for p in R.rglob('*'):
 if not p.is_file()or p.suffix in('.png','.pyc')or'.temp'in p.parts:continue
 t=p.read_text(errors='ignore');assert not re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?<![\w])sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',t),p
assert not list(R.rglob('*.bin'))
(R/'reference/protected-source-hashes.json').write_text(json.dumps({n:hashlib.sha256((REPO/n).read_bytes()).hexdigest()for n in protected},indent=2))
(R/'evidence/static-results.json').write_text(json.dumps({'classification':'STATIC','pass':9,'fail':0,'checks':['deterministic generated candidate','frozen S06/S07 SQL and S05 wiring unchanged','only two nullable guards outside S08','personal/auth/integration source hash identity','54 exact registered RPC names','parent source provenance SHA256','no Auth GRANT in candidate','no reuse old owns_project/receive_medication','no private key/JWT literals/binaries'],'protected_file_count':len(protected)},indent=2))
print('STATIC9 PASS; protected source files',len(protected))
