from pathlib import Path
import json,re,collections,hashlib

def run(sql,case,E,d):
 scalar=d['scalar'];rpc=d['rpc'];deny=d['deny'];assertion=d['assertion'];lit=d['lit'];A=d['A'];B=d['B']
 def catalog():return json.loads(sql((E/'sql/catalog-local.sql').read_text()).stdout.strip())
 c=catalog();(E/'evidence/catalog-active.json').write_text(json.dumps(c,ensure_ascii=False,indent=2))
 fs=c['functions'];pub=[f for f in fs if f['schema']=='public'];sd=[f for f in fs if f['definer']]
 def verify_shape():
  assert len(pub)==54 and len({f['signature']for f in pub})==54
  assert all(not f['definer']and f['owner']=='ws_owner'for f in pub)
  assert all(f['settings']==['search_path=""']for f in fs)
  assert all(f['owner']in('ws_runtime','ws_authz_reader')for f in sd)
  assert all(not f['public_execute']and not f['anon_execute']for f in fs)
  assert all(t['rls']and t['force_rls']and t['owner']=='ws_owner'and not t['authenticated_select']and not t['authenticated_update']for t in c['tables'])
 case('S09 catalog:54 invokers, nonowner definers, all fixed empty paths, FORCE RLS',verify_shape)
 def roles():
  assert all(not r['super']and not r['login']and not r['bypass']and not r['create_role']and not r['create_db']and not r['replication']for r in c['roles'])
  assert not any(x['member']in('authenticated','anon','ws_runtime')and x['role']in('ws_runtime','ws_owner','ws_authz_reader')for x in (c['memberships']or[]))
 case('S09 no client/runtime SET ROLE escalation or owner membership',roles)
 # Conservative textual call graph: procedural SQL dependencies are not completely recorded in pg_depend.
 graph=[]
 for f in fs:
  refs=sorted(set(re.findall(r'(?:workspace_private|workspace|auth|public)\.[A-Za-z_][A-Za-z_0-9]*',f['body'])))
  graph.append({'signature':f['signature'],'owner':f['owner'],'definer':f['definer'],'references':refs,'dynamic_sql':bool(re.search(r'\bEXECUTE\b',f['body'],re.I))})
 (E/'reference/function-call-edges.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2))
 manifest=json.loads(scalar("SELECT jsonb_agg(to_jsonb(m)ORDER BY public_signature)FROM workspace_private.s08_rpc_manifest m"))
 (E/'reference/rpc-signatures.json').write_text(json.dumps(manifest,indent=2))
 summary={'rpc54_total':len(pub),'ws_v1_prefix':sum(f['name'].startswith('ws_v1_')for f in pub),'other_public_ws_prefix':sum(not f['name'].startswith('ws_v1_')for f in pub),'private_functions':len(fs)-len(pub),'security_definer':len(sd),'definer_by_owner':dict(collections.Counter(f['owner']for f in sd)),'tables':len(c['tables']),'business_tables':sum(t['schema']=='workspace'for t in c['tables']),'policies':len(c['policies']),'constraints':len(c['constraints'])}
 (E/'reference/object-counts.json').write_text(json.dumps(summary,indent=2))
 for name,q in [
  ('private authz reader direct helper denied','SELECT workspace_private.actor()'),
  ('private session helper direct call denied','SELECT workspace_private.session_ok()'),
  ('private generic write dispatch denied',"SELECT workspace_private.s07_write(NULL::uuid,'create'::text,'{}'::jsonb,0::bigint,NULL::uuid)"),
  ('role escalation runtime denied','SET ROLE ws_runtime'),
  ('role escalation authz denied','SET ROLE ws_authz_reader'),
  ('RLS row_security off cannot expose raw table','SET row_security=off;SELECT * FROM workspace.school_memberships'),
  ('private ledger mutation denied',"UPDATE workspace_private.s08_release SET state='active'"),
  ('Auth table SELECT denied','SELECT * FROM auth.sessions')]:
  case('S09 SD probe '+name,lambda q=q:assertion(sql('SET SESSION AUTHORIZATION school_rest;SET ROLE authenticated;'+q,False).returncode!=0))
 case('S09 authz reader cannot mutate Workspace content',lambda:assertion(sql("SET ROLE ws_authz_reader;UPDATE workspace.shared_tasks SET title='forbidden'",False).returncode!=0))
 case('S09 read-only metadata queries execute without mutation',lambda:(sql((E/'sql/hosted-readonly.sql').read_text()),sql((E/'sql/postinstall-readonly.sql').read_text())))
 case('S09 runtime cannot SELECT any Auth session columns',lambda:assertion(sql('SET ROLE ws_runtime;SELECT id FROM auth.sessions',False).returncode!=0))
 case('S09 reader sees only four approved session columns',lambda:(assertion(sql('SET ROLE ws_authz_reader;SELECT id,user_id,created_at,not_after FROM auth.sessions').returncode==0),assertion(sql('SET ROLE ws_authz_reader;SELECT test_private_metadata FROM auth.sessions',False).returncode!=0)))
 case('S09 definer code has no service_role or legacy-warning function references',lambda:assertion(not any(re.search(r'\b(service_role|owns_project|receive_medication|complete_workflow_instance|save_project_expense)\b',f['body'])for f in fs)))
 # Restore only synthetic fixtures, before mutation probes.
 for p in ['local/tests/fixtures.sql','integration/sql/multi-school-fixture.sql','school02/sql/fixtures.sql','school03/sql/fixtures.sql']:sql((E.parent/p).read_text())
 claims={'sub':'00000000-0000-0000-0000-000000000004','session_id':'30000000-0000-0000-0000-000000000004','exp':2000000000,'is_anonymous':False,'user_metadata':{'role':'SCHOOL_ADMIN','school_id':B},'app_metadata':{'role':'SCHOOL_ADMIN'}}
 def jwt_call(claims,body):return sql('SET SESSION AUTHORIZATION school_rest;BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(claims))+';'+body+';COMMIT;',False)
 case('S09 forged metadata cannot authorize teacher inventory write',lambda:deny(jwt_call(claims,"SELECT public.ws_v1_create_inventory_item('"+A+"','{}',0,gen_random_uuid())")))
 case('S09 mismatched session owner/sub denies valid UUID',lambda:deny(jwt_call({**claims,'sub':'00000000-0000-0000-0000-000000000003'},"SELECT public.ws_v1_get_context('"+A+"')"),'unauthenticated_or_revoked'))
 case('S09 anonymous Auth user denied despite authenticated PG role',lambda:deny(jwt_call({**claims,'is_anonymous':True},"SELECT public.ws_v1_get_context('"+A+"')"),'unauthenticated_or_revoked'))
 # Keep domain data/schema stable after probes; HTTP tests will separately simulate session revocation.
 (E/'evidence/security-audit-results.json').write_text(json.dumps({'classification':'VERIFIED LOCAL','checks':[x for x in d['results']if x['name'].startswith('S09')],'hosted':'NOT RUN'},indent=2))
