from pathlib import Path
import json,hashlib,re
E=Path(__file__).resolve().parents[1];R=E.parents[1];j=json.loads((E/'reference/prior-inputs.json').read_text())
for f in j['files']:assert hashlib.sha256((R/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
a=(E.parent/'school09c/sql/auth-bridge.sql').read_text();b=(E/'sql/auth-install-local.sql').read_text()
pattern=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\).*?AS \$\$(.*?)\$\$;'
assert dict(re.findall(pattern,a,re.S))==dict(re.findall(pattern,b,re.S))
print('PASS prior input hashes',len(j['files']),'and all four09C function bodies unchanged; previous177/23 referenced only')

for f in json.loads((E/'reference/sql-sha256.json').read_text()):assert hashlib.sha256((E/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
print('PASS reviewed SQL candidate and SELECT hashes')
