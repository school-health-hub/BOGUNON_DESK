from pathlib import Path
import runpy,subprocess,os,json,hashlib,re,uuid,sys
E=Path(__file__).resolve().parents[1];P=E.parent
D=['docker','--host=unix:///var/run/docker.sock'];NAME='bogunon-school09ch3-pg';ENV={k:v for k,v in os.environ.items()if k not in('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')};results=[];SQLS={f.name:f.read_text()for f in(E/'sql').glob('*.sql')}
def sql(q,ok=True,role='fixture_root'):
 p=subprocess.run(D+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse','-U',role,'-d','school01a'],input=q,text=True,capture_output=True,env=ENV,timeout=60)
 if ok:assert not p.returncode,p.stderr[-2200:]
 return p
def scalar(q):return sql(q).stdout.strip().splitlines()[-1]
def check(x):assert x
def case(n,fn):
 try:fn();results.append({'name':n,'status':'PASS','classification':'LOCAL POSTGREST'if n.startswith('HTTP')else'MOCK'if n.startswith('MOCK')else'LOCAL DB'});print('PASS',n,flush=True)
 except Exception as ex:results.append({'name':n,'status':'FAIL','detail':str(ex)});print('FAIL',n,ex,flush=True);raise
 finally:(E/('evidence/schema-results.json'if os.environ.get('H3_SCHEMA_ONLY')=='1'else'evidence/results.json')).write_text(json.dumps({'checks':results,'hosted':'NOT RUN','prior_results':'REFERENCED only; not added to these counts'},indent=2))
def run_file(role,name,ok=True,transform=None):
 s=SQLS[name];s=transform(s)if transform else s
 return sql("SET bogunon.ws_install_mode='isolated';"+s,ok,role='postgres')
def deny(p,marker):assert p.returncode and marker in p.stderr,(marker,p.stderr[-1000:])
def closed():return scalar("SELECT count(*)=54 AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('anon',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE')AND NOT has_function_privilege('anon',private_signature,'EXECUTE'))FROM workspace_private.h3_rpc_manifest")=='t'
def auth_hash():return scalar("SELECT md5(jsonb_agg(x ORDER BY x::text)::text)FROM(SELECT jsonb_build_object('kind','schema','name',nspname,'acl',nspacl,'owner',nspowner)x FROM pg_namespace WHERE nspname='auth' UNION ALL SELECT jsonb_build_object('kind','fn','sig',p.oid::regprocedure::text,'def',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl)FROM pg_proc p WHERE p.pronamespace='auth'::regnamespace UNION ALL SELECT jsonb_build_object('kind','table','name',relname,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity)FROM pg_class WHERE relnamespace='auth'::regnamespace UNION ALL SELECT jsonb_build_object('kind','col','name',attname,'table',attrelid,'acl',attacl)FROM pg_attribute WHERE attrelid IN('auth.sessions'::regclass,'auth.users'::regclass)AND attnum>0)q")
def legacy_hash():return scalar("SELECT md5(jsonb_agg(x ORDER BY x::text)::text)FROM(SELECT jsonb_build_object('kind','fn','name',p.oid::regprocedure::text,'body',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner)x FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND left(p.proname,3)<>'ws_' UNION ALL SELECT jsonb_build_object('kind','table','name',c.relname,'acl',c.relacl,'owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)FROM pg_class c WHERE c.relnamespace='public'::regnamespace UNION ALL SELECT jsonb_build_object('kind','policy','name',policyname,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname='public')q")
# Simulate existing Hosted permissions. This is fixture provisioning, never part of the installer.
sql('ALTER ROLE postgres RENAME TO fixture_root;') if False else None
# Rename requires a different current session than the target role.
sql('CREATE ROLE fixture_setup LOGIN SUPERUSER;',role='postgres');sql('ALTER ROLE postgres RENAME TO fixture_root;',role='fixture_setup')
sql("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE NOINHERIT;GRANT CREATE ON DATABASE school01a TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES(id)ON auth.users TO postgres;GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO postgres;")
# Match the managed schema owner boundary independently of Auth table ownership.
sql('CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS;ALTER SCHEMA auth OWNER TO supabase_admin;GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;')
# Existing role owns its own default ACL only. A simulated inherited default grant must be stripped.
sql('ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO s06_simulated_default_client;')
auth_before=auth_hash();legacy_before=legacy_hash();personal_before=scalar("SELECT jsonb_agg(t ORDER BY t::text)::text FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.medication_items)t")
case('installer NOSUPERUSER cannot SET Auth owner or CREATE in auth',lambda:check(scalar("SELECT NOT rolsuper AND rolbypassrls AND NOT pg_has_role('postgres','supabase_auth_admin','SET')AND NOT has_schema_privilege('postgres','auth','CREATE')FROM pg_roles WHERE rolname='postgres'")=='t'))
case('mid-install forced failure rolls back schemas roles and default privileges',lambda:(deny(run_file('postgres','01-fresh-local.sql',False,lambda s:s.replace('EXECUTE $business$','SELECT 1/0;EXECUTE $business$',1)),'division by zero'),check(scalar("SELECT to_regnamespace('workspace')IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ws_%')")=='t'),check(auth_hash()==auth_before)))
case('late installation failure rolls back business schemas roles and permissions',lambda:(deny(run_file('postgres','01-fresh-local.sql',False,lambda s:s.replace('END$install$;','SELECT 1/0;END$install$;',1)),'division by zero'),check(scalar("SELECT to_regnamespace('workspace')IS NULL AND to_regnamespace('workspace_auth_bridge')IS NULL")=='t'),check(auth_hash()==auth_before)))
case('fresh full S01-S07 business installation without Auth role grants',lambda:run_file('postgres','01-fresh-local.sql'))
case('all54 public RPC default CLOSED',lambda:check(closed()))
case('managed Auth objects and ACL byte fingerprints unchanged',lambda:check(auth_hash()==auth_before))
case('existing public objects and personal rows unchanged',lambda:check(legacy_hash()==legacy_before and personal_before==scalar("SELECT jsonb_agg(t ORDER BY t::text)::text FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.medication_items)t")))
case('no Workspace role has Auth USAGE or table or column SELECT',lambda:check(scalar("SELECT bool_and(NOT has_schema_privilege(oid,'auth','USAGE')AND NOT has_any_column_privilege(oid,'auth.sessions','SELECT')AND NOT has_any_column_privilege(oid,'auth.users','SELECT'))FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')")=='t'))
case('all Workspace tables FORCE RLS with nonbypass owner',lambda:check(scalar("SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='ws_owner')FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r'")=='t'))
case('no temporary seed policy or reader/runtime schema CREATE remains',lambda:check(scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_policies WHERE policyname='h3_seed_install')AND NOT has_schema_privilege('ws_runtime','workspace_private','CREATE')AND NOT has_schema_privilege('ws_authz_reader','workspace_private','CREATE')")=='t'))
def contracts():
 prior=json.loads((P/'school09c/evidence/catalog-active-workspace-scope.json').read_text())['functions']
 actual=json.loads(scalar("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'body',p.prosrc,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definition_sha_marker',md5(pg_get_functiondef(p.oid))))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'"))
 keys=['schema','name','body','owner','definer','settings','arguments','returns','definition_sha_marker']
 assert len(actual)==54
 assert sorted([{k:r[k]for k in keys}for r in prior if r['schema']=='public'],key=lambda r:r['name'])==sorted(actual,key=lambda r:r['name'])
case('all54 public signatures bodies owners and security flags unchanged',contracts)
case('only two parameterless postgres-owned session booleans, private EXECUTE reader only',lambda:check(scalar("SELECT count(*)=2 AND bool_and(pg_get_userbyid(p.proowner)='postgres'AND p.prosecdef AND p.pronargs=0 AND p.prorettype='boolean'::regtype AND p.proconfig=ARRAY['search_path=\"\"']AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')AND NOT has_function_privilege('anon',p.oid,'EXECUTE')AND NOT has_function_privilege('ws_runtime',p.oid,'EXECUTE'))FROM pg_proc p WHERE p.pronamespace='workspace_auth_bridge'::regnamespace")=='t'))
case('no permanent Workspace function owned by postgres outside boolean boundary',lambda:check(scalar("SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_bootstrap')AND pg_get_userbyid(p.proowner)='postgres'")=='0'))
case('temporary NOBYPASS installer is removed completely',lambda:check(scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ws_h3_installer')")=='t'))
for r in ['anon','authenticated','ws_owner','ws_runtime']:
 case('direct bridge SELECT and arbitrary UUID oracle denied '+r,lambda r=r:(check(sql('SET SESSION AUTHORIZATION '+r+';SELECT workspace_auth_bridge.session_valid()',False).returncode!=0),check(sql('SET SESSION AUTHORIZATION '+r+";SELECT workspace_auth_bridge.session_valid(gen_random_uuid())",False).returncode!=0)))
case('full installer replay is checked no-op',lambda:run_file('postgres','01-fresh-local.sql'))
(E/'evidence/installed-functions.json').write_text(scalar("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,'returns',pg_get_function_result(p.oid),'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'definition_md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text)ORDER BY n.nspname,p.proname)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_auth_bridge','workspace_bootstrap')OR(n.nspname='public'AND left(p.proname,3)='ws_')")+'\n')
(E/'evidence/installed-roles.json').write_text(scalar("SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'login',rolcanlogin,'createrole',rolcreaterole,'auth_usage',has_schema_privilege(oid,'auth','USAGE'),'auth_select',has_any_column_privilege(oid,'auth.sessions','SELECT'),'auth_owner_set',pg_has_role(oid,'supabase_auth_admin','SET'))ORDER BY rolname)FROM pg_roles WHERE rolname IN('postgres','ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')")+'\n')
if os.environ.get('H3_SCHEMA_ONLY')=='1':
 print('PASS stricter54 signature/result/full definition check; same SQL release; repeated checks not added',flush=True)
 sys.exit(0)
case('explicit isolated QA activation',lambda:run_file('postgres','02-activate-qa-only.sql'))
runpy.run_path(str(E/'tests/regression.py'))['run'](E,sql,case,check,run_file)
sql((P/'local/tests/fixtures.sql').read_text())
# Reuse actual HTTP harness on new SQL; classify these as impact regression, not new unique old suites.
scope=runpy.run_path(str(E/'tests/rest.py'));scope['run'](sql,case,E,D,NAME,ENV,run_file,check)
case('fresh installation and Auth ACL still unchanged after API lifecycle',lambda:check(auth_hash()==auth_before and legacy_hash()==legacy_before and closed()and personal_before==scalar("SELECT jsonb_agg(t ORDER BY t::text)::text FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.medication_items)t")))
row=scalar("SELECT public_signature FROM workspace_private.h3_rpc_manifest ORDER BY public_signature LIMIT 1")
old_private=scalar("SELECT private_signature FROM workspace_private.h3_rpc_manifest WHERE public_signature='"+row+"'")
sql("UPDATE workspace_private.h3_rpc_manifest SET private_signature='workspace_private.actor()'WHERE public_signature='"+row+"'")
case('manifest row substitution cannot be adopted or activated',lambda:(deny(run_file('postgres','01-fresh-local.sql',False),'h3_manifest_drift'),deny(run_file('postgres','02-activate-qa-only.sql',False),'h3_manifest_drift'),check(closed())))
sql("UPDATE workspace_private.h3_rpc_manifest SET private_signature='"+old_private+"'WHERE public_signature='"+row+"'")
sql('GRANT USAGE ON SCHEMA auth TO ws_authz_reader')
case('external Auth usage grant is rejected by install and activation guards',lambda:(deny(run_file('postgres','01-fresh-local.sql',False),'workspace_auth_capability_drift'),deny(run_file('postgres','02-activate-qa-only.sql',False),'workspace_auth_capability_drift'),check(closed())))
sql('REVOKE USAGE ON SCHEMA auth FROM ws_authz_reader')
sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path='public'")
case('bridge definition drift cannot be adopted or activated',lambda:(deny(run_file('postgres','01-fresh-local.sql',False),'h3_catalog_drift'),deny(run_file('postgres','02-activate-qa-only.sql',False),'h3_catalog_drift'),check(closed())))
sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path=''")
case('restored exact reviewed metadata permits checked replay without data deletion',lambda:(run_file('postgres','01-fresh-local.sql'),check(auth_hash()==auth_before and legacy_hash()==legacy_before and closed())))
(E/'evidence/catalog-summary.json').write_text(scalar("SELECT jsonb_build_object('public_rpcs',(SELECT count(*)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND left(p.proname,3)='ws_'),'private_functions',(SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_auth_bridge','workspace_bootstrap')),'tables',(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap')AND c.relkind='r'),'policies',(SELECT count(*)FROM pg_policies WHERE schemaname IN('workspace','workspace_private','workspace_bootstrap')),'closed',(SELECT state FROM workspace_private.h3_release),'auth_catalog_unchanged',true,'legacy_public_unchanged',true)")+'\n')
print('PASS H3 checks',len(results),'Hosted NOT RUN',flush=True)
