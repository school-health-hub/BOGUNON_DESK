"""Validate captured LOCAL DB metadata. This does not audit hosted Supabase."""
import json
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'evidence'
c = json.loads((p / 'catalog.json').read_text())
roles = {r['name']: r for r in c['roles']}
assert not roles['ws_runtime']['bypass_rls'] and not roles['ws_authz_reader']['bypass_rls']
assert not roles['ws_runtime']['login'] and not roles['ws_authz_reader']['login']
required = {'shared_events', 'shared_event_history', 'handover_notes', 'handover_revisions', 'handover_targets', 'handover_acknowledgements'}
tables = {t['table']: t for t in c['tables']}
for name in required:
    t = tables[name]
    assert t['owner'] == 'ws_owner' and t['rls'] and t['force_rls'] and not t['authenticated_select'], name
public = [f for f in c['functions'] if f['schema'] == 'public']
assert len(public) == 13
for f in c['functions']:
    assert not f['anon_execute'] and 'search_path=""' in f['config'], f
    if f['schema'] == 'public':
        assert not f['definer'] and f['authenticated_execute'], f
    elif f['authenticated_execute']:
        assert f['owner'] == 'ws_runtime' and f['definer'], f
assert len([f for f in c['functions'] if f['schema'] == 'workspace_private' and f['authenticated_execute']]) == 13
(p / 'catalog-verification.json').write_text(json.dumps({'classification': 'LOCAL DB', 'result': 'PASS', 'raw_tables': 6, 'public_invoker_wrappers': 13, 'executable_purpose_implementations': 13, 'nonowner_nobypassrls': True, 'hosted': 'NOT VERIFIED'}, indent=2))
print('LOCAL DB catalog/GRANT/RLS invariants PASS (hosted NOT VERIFIED)')
