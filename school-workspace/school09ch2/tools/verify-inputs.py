from pathlib import Path
import json,hashlib,re
E=Path(__file__).resolve().parents[1];R=E.parents[1]
for f in json.loads((E/'reference/inputs.json').read_text())['files']:
 assert hashlib.sha256((R/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
plan=json.loads((E/'INSTALL_PLAN.json').read_text())
assert not plan['production_eligible'] and not plan['automatic_activation']
for name,h in plan['files_sha256'].items():
 assert hashlib.sha256((E/'sql'/name).read_bytes()).hexdigest()==h,name
contract=json.loads((E/'reference/body-contract.json').read_text())
sql='\n'.join((E/'sql'/n).read_text() for n in plan['files_sha256'])
pattern=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\).*?AS \$\$(.*?)\$\$;'
bodies=dict(re.findall(pattern,sql,re.S))
for name,h in contract['unchanged_bodies'].items():
 assert hashlib.sha256(bodies[name].encode()).hexdigest()==h,name
assert contract['public_rpc_count']==54
print('PASS prerequisite hashes, candidate hashes, unchanged four A2 bodies, CLOSED install plan,54 RPC contract')
