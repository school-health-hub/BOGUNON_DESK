#!/usr/bin/env python3
"""Bounded static checks, complementary to actual PostgreSQL execution."""
import re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
files=list((root/'supabase/migrations').glob('*.sql'))
assert len(files)==1
s=files[0].read_text()
for legacy in ('owns_project','receive_medication','public.tasks','public.events','public.profiles','public.medication_'):
 assert legacy not in s,legacy
assert not re.search(r'\b(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|DROP TABLE)\s+public\.',s,re.I)
assert 'synthetic_database_required' in s and 'namespace_collision' in s
assert 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public' not in s
assert 'service_role' not in s
assert len(re.findall(r'CREATE FUNCTION public\.ws_v1_',s))==10
assert 'SET search_path=\'\'' in s
print('PASS static scope: no legacy tables/functions, no public-wide ACL mutation, 10 RPC wrappers, local database guard')
print('NOT VERIFIED: collision with hosted catalog, managed role ownership/grants, provider/RPC HTTP/JWT behavior')
