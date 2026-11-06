"""Offline source/candidate/body/installation-boundary verification."""
from pathlib import Path
import json,re,hashlib
E=Path(__file__).resolve().parents[1];R=E.parents[1];P=E.parent
manifest=json.loads((E/'reference/inputs.json').read_text())
for f in manifest['files']:
 assert hashlib.sha256((R/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
plan=json.loads((E/'INSTALL_PLAN.json').read_text());assert not plan['production_eligible']and not plan['automatic_activation']
for name,h in plan['files_sha256'].items():assert hashlib.sha256((E/name).read_bytes()).hexdigest()==h,name
s=(E/'sql/01-fresh-local.sql').read_text();pat=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_]+\.[a-z_]+)\(\)[^;]*?\bAS\s+\$\$(.*?)\$\$;'
old=dict(re.findall(pat,(P/'school09c/sql/auth-bridge.sql').read_text(),re.S));new=dict(re.findall(pat,s,re.S))
for name,body in old.items():
 if name.startswith('workspace_private.'):
  body=body.replace('auth.uid()','workspace_private.request_uid()').replace('auth.jwt()','workspace_private.request_jwt()')
 assert new[name]==body,name
assert not re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TABLE)\s+auth\.',s,re.I)
assert not re.search(r'(?:GRANT|REVOKE)[^;]*\bON\s+(?:SCHEMA\s+)?auth\b',s,re.I)
assert not re.search(r'SET\s+(?:LOCAL\s+)?ROLE\s+supabase_',s,re.I)
assert not re.search(r'DISABLE\s+ROW\s+LEVEL|NO\s+FORCE\s+ROW\s+LEVEL',s,re.I)
assert 'user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL'in s
assert len(json.loads((P/'school09/reference/rpc-signatures.json').read_text()))==54
print('PASS pinned sources, SQL hashes, four Auth semantic bodies,54 contracts, no managed Auth DDL/GRANT/SET or RLS weakening')
