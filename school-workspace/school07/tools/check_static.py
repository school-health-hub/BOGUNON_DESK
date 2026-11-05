from pathlib import Path
import subprocess,json,hashlib,re,zipfile
R=Path(__file__).resolve().parents[1];REPO=R.parents[1];BASE='eca3ef6bcb62bd2a78526e4c12a02e8db5f381c6'
def git(*a):return subprocess.check_output(['git',*a],cwd=REPO,text=True).strip()
paths=list((R/'supabase/migrations').glob('*.sql'))+[R/'core/signature.ts',R/'sql/activate-local.sql',R/'sql/close-inventory.sql',R/'sql/rpc-contracts.json'];before={str(p):p.read_bytes()for p in paths};subprocess.run(['python3',str(R/'tools/build_sql.py')],check=True,cwd=REPO);assert all(p.read_bytes()==before[str(p)]for p in paths)
assert not git('diff',BASE,'--','school-workspace/school06'),'Preserved SCHOOL06 changed'
protected=[p for p in git('ls-files').splitlines()if p.startswith('src/inventory-management/')or p.startswith('electron-p0/main/inventory')or p.startswith('electron-p0/inventory-')]
for p in protected:assert (REPO/p).read_bytes()==subprocess.check_output(['git','show',BASE+':'+p],cwd=REPO),p
m=json.loads((R/'sql/rpc-contracts.json').read_text());assert len(m)==15
s=next((R/'supabase/migrations').glob('*.sql')).read_text();assert 'local_only'in s and 's07_catalog_drift'in s and 'parent_catalog_drift'in s;assert not re.search(r'GRANT[^;]*\bauth\.',s,re.I);assert not re.search(r'\b(?:owns_project|receive_medication)\s*\(',s);assert not re.search(r'(?:ALTER|DROP|INSERT INTO|UPDATE|DELETE FROM)\s+(?:TABLE\s+)?public\.',s,re.I)
issues=[]
for p in R.rglob('*'):
 if not p.is_file()or p.suffix in('.png','.pyc')or'.temp'in p.parts:continue
 t=p.read_text(errors='ignore')
 if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?<![\w])sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',t):issues.append(str(p))
assert not issues,issues
(R/'reference/personal-inventory-hashes.json').write_text(json.dumps({p:hashlib.sha256((REPO/p).read_bytes()).hexdigest()for p in protected},indent=2))
(R/'evidence/static-results.json').write_text(json.dumps({'classification':'STATIC','checks':['deterministic generated SQL/DTO','SCHOOL06 entire folder unchanged','personal Inventory source byte identity','15 fixed RPC signatures','local-only and child drift guards','no Auth GRANT','no old medication/owner function reuse','no existing public table mutation','no private key/JWT literals'],'pass':9,'fail':0,'protected_personal_files':len(protected),'secret_scan':'pattern scan only, not universal proof'},indent=2))
codefiles=[p for p in R.rglob('*')if p.is_file()and p.suffix in('.ts','.tsx','.py','.sql','.css','.mjs','.sh')and'evidence'not in p.parts and'.temp'not in p.parts]
for n in git('diff','--name-only',BASE).splitlines():
 p=REPO/n
 if p.is_file()and not str(p).startswith(str(R)):codefiles.append(p)
(R/'reference/tested-source-hashes.json').write_text(json.dumps({p.relative_to(REPO).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(set(codefiles))},indent=2))
print('STATIC9 PASS; personal source files:',len(protected))
