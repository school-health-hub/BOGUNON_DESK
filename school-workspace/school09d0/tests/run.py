from pathlib import Path
import runpy,json,hashlib,re,uuid,os,concurrent.futures
E=Path(__file__).resolve().parents[1];P=E.parent;NAME='bogunon-school09d0-pg'
# Frozen H3 harness utilities only; never execute its installer/tests at import time.
s=(P/'school09ch3/tests/run.py').read_text().split('# Simulate existing Hosted permissions.')[0]
s=s.replace('bogunon-school09ch3-pg',NAME).replace("'-d','school01a'","'-d','postgres'")
ns={'__file__':str(E/'tests/run.py')};exec(compile(s,'<frozen H3 DB utilities>','exec'),ns)
sql=ns['sql'];scalar=ns['scalar'];case=ns['case'];check=ns['check'];deny=ns['deny'];closed=ns['closed'];auth_hash=ns['auth_hash'];legacy_hash=ns['legacy_hash'];D=ns['D'];ENV=ns['ENV']
markers="SET bogunon.workspace_target='xxownwxxajzrviuvvfiu';SET bogunon.workspace_plan='SCHOOL-09D-0:CLOSED';"
SQLS={f.name:f.read_text()for f in(E/'sql').glob('*.sql')}
def run_file(role,name,ok=True,transform=None):
 s=SQLS[name];s=transform(s)if transform else s
 return sql(markers+s,ok,role='postgres')
# Synthetic managed environment setup is not operating installation SQL.
for f in ['local/tests/auth_fixture.sql','school06/tests/bootstrap.sql']:
 sql((P/f).read_text().replace("'school01a'","'postgres'"),role='postgres')
sql('CREATE ROLE fixture_setup LOGIN SUPERUSER',role='postgres');sql('ALTER ROLE postgres RENAME TO fixture_root',role='fixture_setup')
sql("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE NOINHERIT;GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES(id)ON auth.users TO postgres;GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO postgres;CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS;ALTER SCHEMA auth OWNER TO supabase_admin;GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;CREATE ROLE service_role NOLOGIN NOBYPASSRLS;")
# Deliberately adversarial legacy creator defaults: never included in the install candidate.
sql('ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SCHEMAS TO PUBLIC,anon,authenticated,service_role,s06_simulated_default_client;ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO PUBLIC,anon,authenticated,service_role,s06_simulated_default_client;ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role,s06_simulated_default_client')
auth_before=auth_hash();legacy_before=legacy_hash();personal=scalar("SELECT jsonb_agg(t ORDER BY t::text)::text FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.medication_items)t")
def defaults():return scalar('SELECT md5(jsonb_agg(d ORDER BY d.oid)::text)FROM pg_default_acl d')
default_before=defaults()
old=(P/'school09ch3/sql/01-fresh-local.sql').read_text().replace("current_database()<>'school01a'","current_database()<>'postgres'")
# Reproduce H3 exposure then rollback EVERYTHING in the same local transaction.
old=old.rsplit('COMMIT;',1)[0]+"SELECT has_table_privilege('authenticated','workspace.accounts','SELECT');ROLLBACK;"
case('H3 creator-default table exposure reproduced and rolled back',lambda:check(sql("SET bogunon.ws_install_mode='isolated';"+old,role='postgres').stdout.strip().splitlines()[-1]=='t'and scalar("SELECT to_regnamespace('workspace')IS NULL")=='t'))
case('wrong project/plan markers rejected before installation',lambda:deny(sql(SQLS['01-install-closed-candidate.sql'],False,role='postgres'),'closed_candidate_identity_required'))
case('SELECT preflight executes with non-super installer',lambda:run_file('postgres','00-hosted-preflight-select.sql'))
case('mid-install failure rolls back roles schema and creator defaults',lambda:(deny(run_file('postgres','01-install-closed-candidate.sql',False,lambda s:s.replace('EXECUTE $business$','SELECT 1/0;EXECUTE $business$',1)),'division by zero'),check(scalar("SELECT to_regnamespace('workspace')IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ws_%')")=='t'),check(defaults()==default_before and auth_hash()==auth_before)))
case('late-install failure rolls back all cumulative objects',lambda:(deny(run_file('postgres','01-install-closed-candidate.sql',False,lambda s:s.replace('END$install$;','SELECT 1/0;END$install$;',1)),'division by zero'),check(scalar("SELECT to_regnamespace('workspace')IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ws_%')")=='t')))
case('exact candidate fresh installation in empty PostgreSQL17.6 postgres database',lambda:run_file('postgres','01-install-closed-candidate.sql'))
case('SELECT postflight executes without new raw table grants',lambda:run_file('postgres','02-postflight-select.sql'))
case('all54 public/private pairs CLOSED and PUBLIC has no function EXECUTE',lambda:check(closed()and scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))x WHERE n.nspname IN('workspace_private','workspace_auth_bridge','workspace_bootstrap')AND x.grantee=0 AND x.privilege_type='EXECUTE')")=='t'))
case('new schema defaults cannot grant client CREATE or private bridge USAGE',lambda:check(scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN pg_roles r WHERE n.nspname IN('workspace','workspace_private','workspace_auth_bridge','workspace_bootstrap')AND r.rolname IN('anon','authenticated','service_role','s06_simulated_default_client')AND has_schema_privilege(r.oid,n.oid,'CREATE'))AND NOT has_schema_privilege('service_role','workspace_auth_bridge','USAGE')AND NOT has_schema_privilege('authenticated','workspace_auth_bridge','USAGE')")=='t'))
case('all creator-default client/table/column privileges stripped from new relations',lambda:check(scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap')AND c.relkind='r'AND r.rolname IN('anon','authenticated','service_role','s06_simulated_default_client')AND(has_any_column_privilege(r.oid,c.oid,'SELECT')OR has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap')AND c.relkind='r'AND a.grantee=0)")=='t'))
case('new table hardening never changes global default ACL or legacy public/Auth objects',lambda:check(defaults()==default_before and legacy_hash()==legacy_before and auth_hash()==auth_before))
case('no Workspace Auth raw SELECT USAGE or BYPASSRLS; owner FORCE RLS',lambda:check(scalar("SELECT bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT has_schema_privilege(oid,'auth','USAGE')AND NOT has_any_column_privilege(oid,'auth.sessions','SELECT'))FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')")=='t'and scalar("SELECT bool_and(relrowsecurity AND relforcerowsecurity AND pg_get_userbyid(relowner)='ws_owner')FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap')AND relkind='r'")=='t'))
def catalogue():return json.loads(scalar("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'returns',pg_get_function_result(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid)))ORDER BY n.nspname,p.proname)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_auth_bridge','workspace_bootstrap')OR(n.nspname='public'AND left(p.proname,3)='ws_')"))
def compare():
 old=json.loads((P/'school09ch3/evidence/installed-functions.json').read_text());new=catalogue();keys=list(new[0]);assert len(new)==161 and [{k:r[k]for k in keys}for r in old]==new
case('all161 function definitions owners and results identical to H3, public54 unchanged',compare)
case('new installer replay is checked no-op under same explicit CLOSED plan',lambda:run_file('postgres','01-install-closed-candidate.sql'))
for role in ['anon','authenticated','ws_runtime','ws_owner','service_role']:
 case('Auth boolean is not a direct session/UUID oracle for '+role,lambda role=role:(check(sql('SET SESSION AUTHORIZATION '+role+';SELECT workspace_auth_bridge.session_valid()',False).returncode!=0),check(sql('SET SESSION AUTHORIZATION '+role+';SELECT workspace_auth_bridge.session_valid(gen_random_uuid())',False).returncode!=0)))
(E/'evidence/functions.json').write_text(json.dumps(catalogue(),indent=2)+'\n')
post=run_file('postgres','02-postflight-select.sql').stdout
(E/'evidence/postflight.txt').write_text(post)
(E/'evidence/objects.json').write_text(json.dumps(json.loads(post.strip().splitlines()[-1]),indent=2)+'\n')
if os.environ.get('D0_SCHEMA_ONLY')=='1':
 print('PASS focused schema/object export; repeat checks not added to final full suite',flush=True)
 raise SystemExit(0)
# Closing a healthy already-CLOSED release must not enable QA activation via an unchanged fingerprint.
probe=SQLS['03-emergency-close.sql'].rsplit('COMMIT;',1)[0]
qa_probe=(E/'tests/activate-local-only.sql').read_text()
case('already-CLOSED emergency state prevents reactivation; probe transaction rolls back',lambda:(deny(sql(markers+"SET bogunon.local_test='1';"+probe+qa_probe,False,role='postgres'),'h3_catalog_drift'),check(scalar('SELECT state FROM workspace_private.h3_release')=='closed'and closed())))
# Only local QA: absent from INSTALL_PLAN sequence. These statements never run against Hosted.
qa=(E/'tests/activate-local-only.sql').read_text()
sql(markers+"SET bogunon.local_test='1';"+qa,role='postgres')
sql((P/'local/tests/fixtures.sql').read_text())
A='10000000-0000-0000-0000-000000000001';B=A[:-1]+'2'
def lit(v):return 'NULL'if v is None else"'"+str(v).replace("'","''")+"'"
def rpc(i,n,p={},v=None,rid=None,ok=True,s=A):
 c={'sub':f'00000000-0000-0000-0000-{i:012}','session_id':f'30000000-0000-0000-0000-{i:012}','exp':2000000000,'is_anonymous':False}
 args=[lit(s),lit(json.dumps(p))+'::jsonb']
 if v is not None:args.extend([str(v),lit(rid or str(uuid.uuid4()))])
 q='BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(c))+';SELECT public.ws_v1_'+n+'('+','.join(args)+');COMMIT;'
 out=sql(q,ok,role='school_client');return json.loads(out.stdout.strip().splitlines()[-1])if ok else out
item=rpc(3,'create_inventory_item',{'name':'합성 소모품','category':'','specification':'','unit':'개','minimum_quantity':5},0)
lot=rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':6},0)
def race():
 with concurrent.futures.ThreadPoolExecutor(2)as pool:out=list(pool.map(lambda _:rpc(3,'use_inventory',{'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':4},lot['version'],ok=False),range(2)))
 assert sum(x.returncode==0 for x in out)==1 and scalar('SELECT quantity FROM workspace.shared_inventory_lots')=='2'
case('retained nonbypass runtime table grants permit safe concurrent inventory use',race)
rid=str(uuid.uuid4());payload={'item_id':item['item_id'],'lot_id':lot['lot_id'],'quantity':1}
first=rpc(3,'use_inventory',payload,2,rid)
case('request_id replay and changed payload/version rejection preserved',lambda:(check(rpc(3,'use_inventory',payload,2,rid)==first),deny(rpc(3,'use_inventory',{**payload,'quantity':2},2,rid,False),'idempotency_mismatch'),deny(rpc(3,'use_inventory',payload,2,ok=False),'conflict')))
expired=rpc(3,'receive_inventory',{'item_id':item['item_id'],'quantity':2,'expiry_date':'2000-01-01'},0)
case('expired lot use and assistant metadata changes denied',lambda:(deny(rpc(3,'use_inventory',{'item_id':item['item_id'],'lot_id':expired['lot_id'],'quantity':1},1,ok=False),'expired_or_unusable'),deny(rpc(4,'edit_inventory_item',{'item_id':item['item_id']},1,ok=False),'access_denied')))
count_before=scalar('SELECT count(*)FROM workspace.shared_inventory_movements')
sql("CREATE FUNCTION workspace_private.d0_fail()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit_test_failure';END$$;CREATE TRIGGER d0_fail BEFORE INSERT ON workspace.audit_entries FOR EACH ROW EXECUTE FUNCTION workspace_private.d0_fail()")
try:case('audit failure rolls back inventory lot movement and receipt',lambda:(deny(rpc(3,'use_inventory',payload,3,ok=False),'audit_test_failure'),check(scalar('SELECT count(*)FROM workspace.shared_inventory_movements')==count_before)))
finally:sql('DROP TRIGGER d0_fail ON workspace.audit_entries;DROP FUNCTION workspace_private.d0_fail()')
def drift_recovery(role,name):
 sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path='public';REVOKE SELECT(id,user_id,created_at,not_after)ON auth.sessions FROM postgres")
 strict=(E/'tests/strict-close-local-only.sql').read_text()
 case('strict close rejects drift/Auth-read loss; emergency close still cuts public54',lambda:(check(sql(markers+strict,False,role='postgres').returncode!=0),run_file(role,name),check(closed())))
runpy.run_path(str(E/'tests/rest.py'))['run'](sql,case,E,D,NAME,ENV,drift_recovery,check)
sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path='';GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres")
case('private bootstrap command remains separately CLOSED without new operator grants',lambda:check(scalar("SELECT NOT has_function_privilege('ws_bootstrap_operator',p.oid,'EXECUTE')FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_bootstrap'AND p.proname='command'")=='t'))
case('emergency close retains data and never adopts fingerprint',lambda:check(closed()and scalar('SELECT state FROM workspace_private.h3_release')=='closed_unverified'))
case('install/activation cannot reopen unverified emergency closure',lambda:(deny(run_file('postgres','01-install-closed-candidate.sql',False),'h3_catalog_drift'),deny(sql(markers+"SET bogunon.local_test='1';"+(E/'tests/activate-local-only.sql').read_text(),False,role='postgres'),'h3_catalog_drift')))
case('emergency closure is idempotent even after bridge search_path drift',lambda:(sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path='public'"),run_file('postgres','03-emergency-close.sql'),check(closed())))
case('all original personal/public/Auth/default privileges survive candidate and recovery',lambda:check(auth_hash()==auth_before and legacy_hash()==legacy_before and defaults()==default_before and personal==scalar("SELECT jsonb_agg(t ORDER BY t::text)::text FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.medication_items)t")))
print('PASS D0',len(ns['results']),'Hosted NOT RUN; H3 domain137 referenced, not rerun',flush=True)
