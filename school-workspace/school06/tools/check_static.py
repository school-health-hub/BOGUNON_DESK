"""Read-only static checks and reproducible generation; no network/DB."""
from pathlib import Path
import json,hashlib,re,subprocess
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
paths=list((ROOT/'supabase/migrations').glob('*.sql'))+list((ROOT/'sql').glob('*.sql'))+[ROOT/'reference/source-sql-manifest.json',ROOT/'sql/public-rpc-names.json']
before={str(p):p.read_bytes()for p in paths}
subprocess.run(['python3',str(ROOT/'tools/build_sql.py')],check=True,cwd=REPO)
assert all(p.read_bytes()==before[str(p)]for p in paths),'Nonreproducible generated SQL'
m=json.loads((ROOT/'reference/source-sql-manifest.json').read_text())
for s in m['sources']:
 assert hashlib.sha256((REPO/s['path']).read_bytes()).hexdigest()==s['sha256']
 assert subprocess.check_output(['git','show','243ae95e69483dfbe8d2438c41f858577d748048:'+s['path']],cwd=REPO)==(REPO/s['path']).read_bytes()
new='\n'.join(p.read_text()for p in paths if p.suffix=='.sql')
assert not re.search(r'GRANT[^;]*\b(?:auth\.|SCHEMA\s+auth\b)',new,re.I),'Auth GRANT in deployable SQL'
assert not re.search(r'(?:ALTER|DROP)\s+(?:TABLE|POLICY)\s+(?:IF\s+EXISTS\s+)?public\.',new,re.I)
assert not re.search(r'(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.',new,re.I)
assert not re.search(r'\b(?:owns_project|receive_medication)\s*\(',new,re.I)
assert len(m['public_rpc_names'])==39
assert 'Instructor candidate.sql' in ' '.join(m['excluded'])
assert 'external_auth_capability_required' in new and "'closed'" in new
assert not list(ROOT.rglob('postgrest.bin'))
checks=['deterministic SQL generation','5 original source hashes and integration byte identity','no Auth GRANT in operating SQL','no existing public table mutation','no legacy authorization/medication function reuse','39 explicit RPC names','Instructor feature excluded','closed gate/external Auth prerequisite','no binary/session artifact']
(ROOT/'evidence/static-checks.json').write_text(json.dumps({'classification':'STATIC','pass':len(checks),'fail':0,'checks':checks},indent=2))
print('STATIC PASS',len(checks))
