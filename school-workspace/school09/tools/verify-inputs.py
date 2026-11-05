#!/usr/bin/env python3
"""Offline integrity check; never regenerates old migrations."""
from pathlib import Path
import hashlib,json,subprocess
E=Path(__file__).resolve().parents[1];REPO=E.parents[1]
m=json.loads((E/'reference/input-sha256.json').read_text())
errors=[]
for f in m['files']:
 p=REPO/f['path']
 if not p.is_file()or hashlib.sha256(p.read_bytes()).hexdigest()!=f['sha256']:errors.append(f['path'])
assert not errors,errors
p=json.loads((E.parent/'school08/reference/sql-provenance.json').read_text())
assert len(p['public_rpc_names'])==len(set(p['public_rpc_names']))==54
for f in p['sources']:assert hashlib.sha256((REPO/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
assert (E.parent/'school08/sql/01-foundation.sql').read_bytes()==(E.parent/'school06/supabase/migrations/20261105104546_workspace_foundation.sql').read_bytes()
print(f'PASS {len(m["files"])} input files; frozen SQL provenance; 54 manifest names; no regeneration')
