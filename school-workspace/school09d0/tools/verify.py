from pathlib import Path
import json,hashlib,re,sys
E=Path(__file__).resolve().parents[1];R=E.parents[1]
for f in json.loads((E/'reference/inputs.json').read_text())['files']:
 assert hashlib.sha256((R/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
plan=json.loads((E/'INSTALL_PLAN.json').read_text());assert not plan['production_approved']and not plan['automatic_activation']
assert len(plan['sequence'])==len(set(plan['sequence']))==3
for name,h in plan['files_sha256'].items():assert hashlib.sha256((E/name).read_bytes()).hexdigest()==h,name
s=(E/'sql/01-install-closed-candidate.sql').read_text();h=(E.parent/'school09ch3/sql/01-fresh-local.sql').read_text()
pat=r'CREATE(?: OR REPLACE)? FUNCTION\s+([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)\([^;]*?\bAS\s+\$\$(.*?)\$\$;'
a=dict(re.findall(pat,s,re.S));b=dict(re.findall(pat,h,re.S));assert len(a)==len(b)==161 and a==b
assert not re.search(r'(?:GRANT|REVOKE)[^;]*\bON\s+(?:SCHEMA\s+)?auth\b',s,re.I)
assert not re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TABLE|TRIGGER)\s+auth\.',s,re.I)
assert not re.search(r'SET\s+(?:LOCAL\s+)?ROLE\s+supabase_|DISABLE\s+ROW\s+LEVEL|NO\s+FORCE\s+ROW\s+LEVEL',s,re.I)
assert 'ON DELETE SET NULL'in s
assert 'tests/activate-local-only.sql'not in plan['sequence']
rows=json.loads((E.parent/'school09/reference/rpc-signatures.json').read_text());assert len(rows)==54
print('PASS pinned H3 inputs, SQL hashes,161 identical bodies/54 signatures, no Auth DDL/GRANT/SET or RLS weakening, CLOSED sequence')
# A gate report is a planning artifact, never a deployment authorization or executable unlock.
gates=json.loads((E/'GATES.json').read_text())
assert gates['operating_apply']=='BLOCKED'and not gates['authorized_to_apply']
assert any(r['status']=='NOT VERIFIED'for r in gates['items'])and any(r['status']=='BLOCKED'for r in gates['items'])
print('PASS Hosted/policy unknowns remain blocked, not inferred from local tests')
