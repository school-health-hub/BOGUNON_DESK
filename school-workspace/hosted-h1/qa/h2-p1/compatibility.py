"""Owned network-none PostgreSQL only; no endpoint/credential arguments or Hosted path."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time, uuid
ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
if OUT is None or len(sys.argv) != 2:
    raise SystemExit('usage: python rehearse.py <sanitized-result.json>')
D = ['docker', '--host=unix:///var/run/docker.sock']
ENV = {k:v for k,v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
NAME = 'bogunon-h2-p1-' + uuid.uuid4().hex
report = {'sourceSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'classification':'LOCAL SQL adversarial ACL simulation; operating metadata USER SUPPLIED',
          'operatingAccess':'NOT RUN', 'image':IMAGE, 'harnessSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(), 'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'checks':[], 'cleanup':'NOT RUN'}
owned = None
stage = 'environment'
def run(args, data=None, ok=True):
    p = subprocess.run(args,input=data,text=True,capture_output=True,env=ENV,timeout=90)
    if ok and p.returncode:
        # Never emit captured SQL/output/credentials on failure.
        raise RuntimeError(stage + '_subprocess_failed')
    return p

def sql(q, role='fixture_root', ok=True):
    return run(D+['exec','-i',owned,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'],q,ok)

def scalar(q):
    return sql(q).stdout.strip().splitlines()[-1]

def check(name, condition=True):
    if not condition:
        raise RuntimeError(name)
    report['checks'].append({'name':name,'status':'PASS'})

def source(p):
    return (ROOT / p).read_text()

marker = "SET bogunon.workspace_target='xxownwxxajzrviuvvfiu';SET bogunon.workspace_plan='SCHOOL-09D-0:CLOSED';"
# Historical D0 marker is supplied only INSIDE this owned network-none fixture.
core = 'school-workspace/school09d0/sql/'
addon = 'school-workspace/hosted-h1/sql/'
recovery = source(addon+'02-emergency-close-addon.sql')
report['recoverySha256'] = hashlib.sha256(recovery.encode()).hexdigest()
report['sourceFilesSha256'] = {p:hashlib.sha256(source(p).encode()).hexdigest() for p in
    [core+'00-hosted-preflight-select.sql',core+'01-install-closed-candidate.sql',
     addon+'01-instructor-addon-closed.sql',addon+'02-emergency-close-addon.sql']}
A = '10000000-0000-0000-0000-000000000001'
claims = json.dumps({'sub':'00000000-0000-0000-0000-000000000003','session_id':'30000000-0000-0000-0000-000000000003','exp':2000000000,'is_anonymous':False})
def rpc(name, ok=True):
    q = "BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claims='"+claims+"';SELECT "+name+";ROLLBACK;"
    return sql(q,'school_client',ok)

def data_snapshot():
    return scalar("SELECT md5(jsonb_build_array((SELECT jsonb_agg(t ORDER BY t.school_id)FROM workspace_instructor.instructor_schedules t),(SELECT jsonb_agg(t ORDER BY t.id)FROM workspace.schools t),(SELECT jsonb_agg(t ORDER BY t.id)FROM public.tasks t),(SELECT jsonb_agg(t ORDER BY t.id)FROM auth.users t),(SELECT jsonb_agg(t ORDER BY t.id)FROM auth.sessions t))::text)")

def is_closed():
    return scalar("SELECT bool_and(NOT has_function_privilege(r.oid,p.oid,'EXECUTE'))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r WHERE n.nspname IN('public','workspace_instructor_private')AND p.proname IN('ws_v1_instructor_read','ws_v1_instructor_write','instructor_read','instructor_write')AND r.rolname IN('anon','authenticated','service_role')") == 't'
# Fixture helpers above mirror P0; this suite intentionally never activates a release.
def catalog_hash():
    return scalar("SELECT md5(jsonb_agg(x ORDER BY x::text)::text) FROM(SELECT jsonb_build_object('schema',n.nspname,'name',p.proname,'owner',p.proowner,'definition',pg_get_functiondef(p.oid),'acl',p.proacl)x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','auth') AND left(p.proname,3)<>'ws_' UNION ALL SELECT jsonb_build_object('schema',n.nspname,'rel',c.relname,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth') UNION ALL SELECT jsonb_build_object('policy',policyname,'roles',roles,'qual',qual,'check',with_check)FROM pg_policies WHERE schemaname='public')q")
def defaults_hash():
    return scalar('SELECT md5(jsonb_agg(d ORDER BY d.oid)::text)FROM pg_default_acl d')
def denied_install(name, expected):
    p=sql(marker+source(core+'01-install-closed-candidate.sql'),'postgres',False)
    check(name,p.returncode!=0 and expected in p.stderr and scalar("SELECT to_regnamespace('workspace')IS NULL AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE left(rolname,3)='ws_')")=='t')
try:
    run(D+['image','inspect',IMAGE])
    owned=run(D+['run','--pull=never','-d','--name',NAME,'--label','bogunon.qa=h2-p1','--network','none','--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=postgres',IMAGE,'-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=panic']).stdout.strip()
    for _ in range(120):
        if 'init process complete' in run(D+['logs',owned]).stdout and run(D+['exec',owned,'pg_isready','-U','postgres'],ok=False).returncode==0:break
        time.sleep(.25)
    else:raise RuntimeError('postgres_start_timeout')
    report['postgresVersion']=sql('SELECT version()','postgres').stdout.strip()
    info=json.loads(run(D+['inspect',owned]).stdout)[0]
    check('network none and zero published host ports',info['HostConfig']['NetworkMode']=='none' and not info['HostConfig']['PortBindings'])
    stage='synthetic_setup'
    for p in ['school-workspace/local/tests/auth_fixture.sql','school-workspace/school06/tests/bootstrap.sql']:
        sql(source(p).replace("'school01a'","'postgres'"),'postgres')
    sql('CREATE ROLE fixture_setup LOGIN SUPERUSER','postgres');sql('ALTER ROLE postgres RENAME TO fixture_root','fixture_setup')
    sql("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE NOINHERIT;GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES(id)ON auth.users TO postgres;GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO postgres;CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS;ALTER SCHEMA auth OWNER TO supabase_admin;GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;CREATE ROLE service_role NOLOGIN NOBYPASSRLS;")
    # Adversarial creator defaults on all applicable kinds, plus unknown legacy client.
    # Test both installer-created and creator roles installed later by the frozen SQL.
    sql('ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SCHEMAS TO PUBLIC,anon,authenticated,service_role,s06_simulated_default_client;ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO PUBLIC,anon,authenticated,service_role,s06_simulated_default_client;ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO PUBLIC,anon,authenticated,service_role,s06_simulated_default_client;ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role,s06_simulated_default_client')
    legacy=catalog_hash();defaults=defaults_hash()
    data=scalar("SELECT md5(jsonb_agg(t ORDER BY t::text)::text)FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.profiles UNION ALL SELECT *FROM public.medication_items)t")
    check('synthetic baseline has 20 definer sentinels and 19 authenticated callable',scalar("SELECT count(*)=20 AND count(*)FILTER(WHERE has_function_privilege('authenticated',oid,'EXECUTE'))=19 FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef")=='t')
    stage='negative_prerequisites'
    sql('REVOKE SELECT(not_after)ON auth.sessions FROM postgres')
    denied_install('missing one required Auth session column fails closed','existing_postgres_auth_read_required')
    sql('GRANT SELECT(not_after)ON auth.sessions TO postgres')
    sql('ALTER ROLE postgres NOCREATEROLE')
    denied_install('missing CREATEROLE fails with transaction rollback','permission denied to create role')
    sql('ALTER ROLE postgres CREATEROLE')
    sql('REVOKE CREATE ON DATABASE postgres FROM postgres')
    denied_install('missing database CREATE fails with transaction rollback','permission denied for database')
    sql('GRANT CREATE ON DATABASE postgres TO postgres')
    sql('REVOKE CREATE ON SCHEMA public FROM postgres')
    denied_install('missing public CREATE grant option fails with transaction rollback','permission denied for schema public')
    sql('GRANT CREATE ON SCHEMA public TO postgres WITH GRANT OPTION')
    stage='closed_install'
    sql('ALTER ROLE postgres NOBYPASSRLS')
    sql(marker+source(core+'01-install-closed-candidate.sql'),'postgres')
    check('positive installer is neither SUPERUSER nor BYPASSRLS',scalar("SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='postgres'")=='t')
    check('core54 manifest exact and release CLOSED',scalar("SELECT count(*)=54 FROM workspace_private.h3_rpc_manifest")=='t' and scalar('SELECT state FROM workspace_private.h3_release')=='closed')
    sql("SET bogunon.h1_plan='REVIEW-CLOSED';"+source(addon+'01-instructor-addon-closed.sql'),'postgres')
    check('Instructor separate addon CLOSED',scalar('SELECT state FROM workspace_instructor_private.release')=='closed' and is_closed())
    check('existing public and Auth definitions owners ACL RLS unchanged',legacy==catalog_hash())
    check('global creator defaults unchanged',defaults==defaults_hash())
    check('existing synthetic personal rows unchanged',data==scalar("SELECT md5(jsonb_agg(t ORDER BY t::text)::text)FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.profiles UNION ALL SELECT *FROM public.medication_items)t"))
    check('all core54 public private EXECUTE closed to clients',scalar("SELECT bool_and(NOT has_function_privilege(r.oid,m.public_signature,'EXECUTE')AND NOT has_function_privilege(r.oid,m.private_signature,'EXECUTE'))FROM workspace_private.h3_rpc_manifest m CROSS JOIN pg_roles r WHERE r.rolname IN('anon','authenticated','service_role','s06_simulated_default_client')")=='t')
    check('all addon public private functions closed to unknown legacy client too',scalar("SELECT bool_and(NOT has_function_privilege('s06_simulated_default_client',p.oid,'EXECUTE'))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_instructor_private' OR(n.nspname='public'AND p.proname IN('ws_v1_instructor_read','ws_v1_instructor_write'))")=='t')
    check('new tables and sequences have no client privileges',scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl)a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap','workspace_instructor','workspace_instructor_private')AND(a.grantee=0 OR r.rolname IN('anon','authenticated','service_role','s06_simulated_default_client')))")=='t')
    check('new schema client CREATE and private Auth bridge usage blocked',scalar("SELECT bool_and(NOT has_schema_privilege(r.oid,n.oid,'CREATE'))FROM pg_namespace n CROSS JOIN pg_roles r WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap','workspace_auth_bridge','workspace_instructor','workspace_instructor_private')AND r.rolname IN('anon','authenticated','service_role','s06_simulated_default_client')")=='t' and scalar("SELECT NOT has_schema_privilege('authenticated','workspace_auth_bridge','USAGE')")=='t')
    check('all new tables FORCE RLS nonbypass owner',scalar("SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND NOT r.rolbypassrls AND NOT r.rolsuper)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname IN('workspace','workspace_private','workspace_bootstrap','workspace_instructor','workspace_instructor_private')AND c.relkind='r'")=='t')
    check('no runtime Auth grants and no new privileged roles',scalar("SELECT bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreaterole AND NOT has_schema_privilege(oid,'auth','USAGE') AND NOT has_any_column_privilege(oid,'auth.sessions','SELECT') AND NOT pg_has_role(oid,'supabase_auth_admin','SET'))FROM pg_roles WHERE rolname IN('ws_owner','ws_runtime','ws_authz_reader','ws_bootstrap_executor','ws_bootstrap_operator')")=='t')
    check('temporary installer role and public CREATE grants removed',scalar("SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ws_h3_installer')AND NOT has_schema_privilege('ws_owner','public','CREATE')AND NOT has_schema_privilege('ws_runtime','workspace_private','CREATE')")=='t')
    stage='recovery'
    sql(recovery,'postgres');sql(marker+source(core+'03-emergency-close.sql'),'postgres')
    check('split recovery leaves 54+2 CLOSED and parent closed_unverified',is_closed() and scalar('SELECT state FROM workspace_private.h3_release')=='closed_unverified')
    check('legacy metadata defaults and rows preserved after recovery',legacy==catalog_hash() and defaults==defaults_hash() and data==scalar("SELECT md5(jsonb_agg(t ORDER BY t::text)::text)FROM(SELECT *FROM public.tasks UNION ALL SELECT *FROM public.events UNION ALL SELECT *FROM public.profiles UNION ALL SELECT *FROM public.medication_items)t"))
    report['result']='PASS'
except Exception as e:
    report['result']='FAIL';report['error']=str(e)if isinstance(e,RuntimeError)else stage+'_unexpected_failure'
finally:
    if owned:
        p=run(D+['rm','-f',owned],ok=False)
        report['cleanup']='PASS: owned container removed, tmpfs destroyed'if p.returncode==0 and run(D+['inspect',owned],ok=False).returncode!=0 else 'FAIL'
        if report['cleanup']=='FAIL':report['result']='FAIL'
    report['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat();OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'result':report.get('result'),'checks':len(report['checks']),'error':report.get('error'),'cleanup':report['cleanup']}))
    if report.get('result')!='PASS':sys.exit(1)
