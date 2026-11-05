from pathlib import Path
import hashlib,json
E=Path(__file__).resolve().parents[1];REPO=E.parents[1];m=json.loads((E/'reference/input-sha256.json').read_text())
for f in m['files']:assert hashlib.sha256((REPO/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
print('PASS unchanged prior inputs',len(m['files']))

for f in json.loads((E/'reference/sql-sha256.json').read_text()):assert hashlib.sha256((E/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
print('PASS local candidate SQL hashes')
