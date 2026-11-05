from pathlib import Path
import runpy,json,subprocess,os,hashlib
E=Path(__file__).resolve().parents[1];P=E.parent;REPO=E.parents[1]
d=runpy.run_path(str(P/'school07/tests/run.py'));d['sql'].__globals__['NAME']='bogunon-school09ch2-pg';sql=d['sql'];scalar=d['scalar'];apply=d['apply'];D=d['D'];ENV=d['ENV'];NAME='bogunon-school09ch2-pg';results=[]
def case(name,fn):
 try:fn();results.append({'name':name,'status':'PASS','classification':'MOCK'if name.startswith('MOCK')else'LOCAL POSTGREST'if name.startswith('HTTP')else'LOCAL DB'});print('PASS',name,flush=True)
 except Exception as ex:results.append({'name':name,'status':'FAIL','error':str(ex)});print('FAIL',name,ex,flush=True);raise
 finally:(E/'evidence/results.json').write_text(json.dumps({'checks':results,'hosted':'NOT RUN','old177_23_26':'REFERENCED not rerun'},indent=2))
def check(x):assert x

def login(role,q,ok=True):
 p=subprocess.run(D+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U',role,'-d','school01a'],input=q,text=True,capture_output=True,env=ENV,timeout=60)
 if ok:assert p.returncode==0,p.stderr[-1800:]
 return p

def run(role,file,ok=True,replace=None):
 s=(E/'sql'/file).read_text();s=replace(s)if replace else s
 return login(role,"SET bogunon.ws_install_mode='isolated';"+s,ok)
def deny(p,marker):assert p.returncode and marker in p.stderr,(marker,p.stderr[-2000:])
def all_closed():return scalar("SELECT count(*)=54 AND bool_and(NOT has_function_privilege('authenticated',public_signature,'EXECUTE')AND NOT has_function_privilege('authenticated',private_signature,'EXECUTE'))FROM workspace_private.s08_rpc_manifest")=='t'
def public_hash():return scalar("SELECT md5(jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.prosrc,pg_get_userbyid(p.proowner))ORDER BY p.oid::regprocedure::text)::text)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'")
apply(P/'school08/sql/01-foundation.sql');apply(P/'school06/tests/local-auth-capabilities.sql');apply(next((P/'school08/supabase/migrations').glob('*.sql')))
before=public_hash()
sql('CREATE ROLE h2_provider LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;CREATE ROLE h2_workspace LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;CREATE ROLE h2_noauth LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;GRANT CREATE ON DATABASE school01a TO h2_provider,h2_noauth;GRANT supabase_auth_admin TO h2_provider WITH INHERIT FALSE,SET TRUE;GRANT ws_owner,ws_authz_reader,ws_runtime TO h2_workspace WITH INHERIT FALSE,SET TRUE;')
case('workspace installer cannot SET Auth owner; provider cannot SET Workspace owners',lambda:check(scalar("SELECT NOT pg_has_role('h2_workspace','supabase_auth_admin','SET')AND NOT pg_has_role('h2_provider','ws_owner','SET')AND NOT pg_has_role('h2_provider','ws_authz_reader','SET')")=='t'))
case('both actual installer LOGINs are NOSUPERUSER NOBYPASSRLS NOINHERIT',lambda:check(scalar("SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit)FROM pg_roles WHERE rolname IN('h2_provider','h2_workspace')")=='t'))
case('no Auth authority fails provider phase before DDL',lambda:deny(run('h2_noauth','01-provider-local.sql',False),'provider_authority_required'))
case('workspace phase without provider bridge fails CLOSED',lambda:deny(run('h2_workspace','02-bind-workspace-local.sql',False),'bridge_missing_or_drift'))
case('provider transaction error leaks no schema or new rights',lambda:(deny(run('h2_provider','01-provider-local.sql',False,lambda s:s.replace('END$install$;','SELECT 1/0;END$install$;')),'division by zero'),check(scalar("SELECT to_regnamespace('workspace_auth_bridge')IS NULL")=='t'),check(all_closed())))
sql("ALTER FUNCTION public.ws_v1_get_context(uuid)SET search_path='public'")
case('pre-existing public wrapper setting drift cannot be adopted',lambda:deny(run('h2_provider','01-provider-local.sql',False),'baseline_function_drift'))
sql("ALTER FUNCTION public.ws_v1_get_context(uuid)SET search_path=''")
sql('GRANT ws_runtime TO authenticated WITH INHERIT FALSE,SET TRUE')
case('client role membership escalation cannot be adopted',lambda:deny(run('h2_provider','01-provider-local.sql',False),'client_role_escalation_detected'))
sql('REVOKE ws_runtime FROM authenticated')
case('Auth-owned provider phase installs without Workspace role SET',lambda:run('h2_provider','01-provider-local.sql'))
case('provider phase preserves54 CLOSED and removes reader raw Auth SELECT',lambda:check(all_closed()and scalar("SELECT NOT has_any_column_privilege('ws_authz_reader','auth.sessions','SELECT')")=='t'))
case('provider retry verifies identical bridge without rewriting it',lambda:run('h2_provider','01-provider-local.sql'))
sql('GRANT EXECUTE ON FUNCTION workspace_private.session_ok()TO s06_simulated_default_client')
case('mid-binding CREATE grant failure is rolled back before commit',lambda:(deny(run('h2_workspace','02-bind-workspace-local.sql',False,lambda s:s.replace('GRANT CREATE ON SCHEMA workspace_private TO ws_authz_reader;','GRANT CREATE ON SCHEMA workspace_private TO ws_authz_reader;SELECT 1/0;')),'division by zero'),check(scalar("SELECT NOT has_schema_privilege('ws_authz_reader','workspace_private','CREATE')")=='t'),check(all_closed())))
case('binding failure keeps committed provider but rolls back all Workspace changes',lambda:(deny(run('h2_workspace','02-bind-workspace-local.sql',False,lambda s:s.replace('END$bind$;','SELECT 1/0;END$bind$;')),'division by zero'),check(scalar("SELECT to_regnamespace('workspace_auth_bridge')IS NOT NULL AND to_regclass('workspace_private.h2_release')IS NULL AND NOT has_schema_privilege('ws_authz_reader','workspace_private','CREATE')")=='t'),check(all_closed())))
case('Workspace binding succeeds without any Auth owner SET capability',lambda:run('h2_workspace','02-bind-workspace-local.sql'))
case('unexpected helper EXECUTE is removed at binding boundary',lambda:check(scalar("SELECT NOT has_function_privilege('s06_simulated_default_client','workspace_private.session_ok()','EXECUTE')")=='t'))
case('all54 signatures and public bodies owners unchanged',lambda:check(before==public_hash()and all_closed()))
case('closed binder replay is verified no-op',lambda:run('h2_workspace','02-bind-workspace-local.sql'))
case('QA activation grants via each actual function owner, no bypass',lambda:run('h2_workspace','03-activate-qa-only.sql'))
case('active binding replay preserves exact release fingerprint',lambda:run('h2_workspace','02-bind-workspace-local.sql'))
case('Auth bridge remains private, reader CREATE absent, raw tables inaccessible',lambda:check(scalar("SELECT NOT has_schema_privilege('authenticated','workspace_auth_bridge','USAGE')AND NOT has_schema_privilege('ws_authz_reader','workspace_private','CREATE')AND NOT has_function_privilege('authenticated','workspace_auth_bridge.session_valid()','EXECUTE')AND NOT has_table_privilege('authenticated','workspace.shared_tasks','SELECT')")=='t'))
sql((P/'local/tests/fixtures.sql').read_text())
runpy.run_path(str(E/'tests/rest.py'))['run'](sql,case,E,D,NAME,ENV,run,check)
case('closing/replaying/reopening preserves release coherence',lambda:(run('h2_workspace','02-bind-workspace-local.sql'),run('h2_workspace','03-activate-qa-only.sql'),run('h2_workspace','04-close-local.sql')))
case('existing public contract remains unchanged after lifecycle',lambda:check(before==public_hash()and all_closed()))
# Public bridge-body tampering is not accepted as a new normal fingerprint.
sql("ALTER FUNCTION workspace_auth_bridge.session_valid()SET search_path='public'")
case('bridge drift rejects provider replay, bind and activation',lambda:(check(run('h2_provider','01-provider-local.sql',False).returncode!=0),check(run('h2_workspace','02-bind-workspace-local.sql',False).returncode!=0),check(run('h2_workspace','03-activate-qa-only.sql',False).returncode!=0)))
case('emergency closure on drift retains data and marks unverified',lambda:(run('h2_workspace','04-close-local.sql'),check(scalar("SELECT state FROM workspace_private.h2_release")=='closed_unverified'),check(all_closed())))
(E/'evidence/catalog-summary.json').write_text(sql("SELECT jsonb_build_object('after_fault_injection',true,'public_rpc',(SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'),'functions',(SELECT count(*)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('workspace_private','workspace_auth_bridge')OR(n.nspname='public'AND left(p.proname,3)='ws_')),'tables',(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('workspace','workspace_private')AND c.relkind='r'),'policies',(SELECT count(*)FROM pg_policies WHERE schemaname IN('workspace','workspace_private')),'release_state',(SELECT state FROM workspace_private.h2_release),'closed',true)").stdout.strip())
(E/'evidence/identities.json').write_text(sql("SELECT jsonb_agg(jsonb_build_object('role',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit,'auth_set',pg_has_role(oid,'supabase_auth_admin','SET'),'ws_owner_set',pg_has_role(oid,'ws_owner','SET')))FROM pg_roles WHERE rolname IN('h2_provider','h2_workspace')").stdout.strip())
print('PASS H2 checks',len(results),'Hosted/real OAuth NOT RUN',flush=True)
