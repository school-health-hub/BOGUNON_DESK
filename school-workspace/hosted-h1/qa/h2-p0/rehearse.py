"""Owned network-none PostgreSQL only; no endpoint/credential arguments or Hosted path."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time, uuid
ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
if OUT is None or len(sys.argv) != 2:
    raise SystemExit('usage: python rehearse.py <sanitized-result.json>')
D = ['docker', '--host=unix:///var/run/docker.sock']
ENV = {k:v for k,v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
NAME = 'bogunon-h2-p0-' + uuid.uuid4().hex
report = {'sourceSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'classification':'LOCAL POSTGRESQL / SYNTHETIC AUTH CLAIMS (no HTTP/JWT verifier)',
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
try:
    run(D+['image','inspect',IMAGE])  # cached only; never pull or touch another container
    owned = run(D+['run','--pull=never','-d','--name',NAME,'--label','bogunon.qa=h2-p0','--network','none',
                  '--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=256m',
                  '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=postgres',IMAGE,
                  '-c',"listen_addresses=",'-c','log_statement=none','-c','log_min_error_statement=panic']).stdout.strip()
    for _ in range(120):
        if 'init process complete' in run(D+['logs',owned]).stdout and run(D+['exec',owned,'pg_isready','-U','postgres'],ok=False).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('postgres_start_timeout')
    report['postgresVersion'] = sql('SELECT version()','postgres').stdout.strip()
    check('owned container network none / no host ports', json.loads(run(D+['inspect',owned]).stdout)[0]['HostConfig']['NetworkMode']=='none' and not json.loads(run(D+['inspect',owned]).stdout)[0]['HostConfig']['PortBindings'])
    stage = 'synthetic_setup'
    for p in ['school-workspace/local/tests/auth_fixture.sql','school-workspace/school06/tests/bootstrap.sql']:
        sql(source(p).replace("'school01a'","'postgres'"),'postgres')
    sql('CREATE ROLE fixture_setup LOGIN SUPERUSER','postgres')
    sql('ALTER ROLE postgres RENAME TO fixture_root','fixture_setup')
    sql("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE NOINHERIT;GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES(id)ON auth.users TO postgres;GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO postgres;CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS;ALTER SCHEMA auth OWNER TO supabase_admin;GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;CREATE ROLE service_role NOLOGIN NOBYPASSRLS;")
    stage = 'readonly_preflight'
    sql('BEGIN READ ONLY;'+source(core+'00-hosted-preflight-select.sql')+'ROLLBACK;','postgres')
    check('original preflight executes in READ ONLY transaction on synthetic catalogs')
    sql(source('school-workspace/hosted-h1/qa/h2-p0/preflight-catalog.sql'),'postgres')
    check('supplemental catalog preflight executes before installation in READ ONLY transaction')
    stage = 'closed_install'
    sql(marker+source(core+'01-install-closed-candidate.sql'),'postgres')
    sql("SET bogunon.h1_plan='REVIEW-CLOSED';"+source(addon+'01-instructor-addon-closed.sql'),'postgres')
    check('core54 + separate addon2 install CLOSED', is_closed() and scalar('SELECT count(*) FROM workspace_private.h3_rpc_manifest')=='54')
    sql(source('school-workspace/hosted-h1/qa/h2-p0/preflight-catalog.sql'),'postgres')
    check('supplemental catalog preflight also handles installed core54 plus addon2')
    probe = source('school-workspace/hosted-h1/qa/h2-p0/preflight-catalog.sql').split('WITH expected',1)[1].split('-- Effective',1)[0]
    signatures = sql('WITH expected'+probe,'postgres').stdout.strip().splitlines()
    check('catalog expected list matches all 54 plus separate 2 exact installed signatures',len(signatures)==56 and all(r.split('|')[4:6]==['t','t'] for r in signatures))
    stage = 'local_activation'
    sql(marker+"SET bogunon.local_test='1';"+source('school-workspace/school09d0/tests/activate-local-only.sql'),'postgres')
    sql(source('school-workspace/local/tests/fixtures.sql'))
    sql("BEGIN;SET LOCAL ROLE ws_owner;UPDATE workspace_instructor_private.release SET state='active';GRANT EXECUTE ON FUNCTION public.ws_v1_instructor_read(uuid,text),public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid)TO authenticated;GRANT USAGE ON SCHEMA workspace_instructor_private TO authenticated;SET LOCAL ROLE ws_runtime;GRANT EXECUTE ON FUNCTION workspace_instructor_private.instructor_read(uuid,text),workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid)TO authenticated;COMMIT;")
    # Synthetic sentinel, not an output/calculation test.
    sql("INSERT INTO workspace_instructor.instructor_schedules VALUES('"+A+"','{}','[]',1,clock_timestamp())")
    rpc("public.ws_v1_instructor_read('"+A+"','2026-11')")
    check('authenticated teacher actually reaches addon before closure')
    baseline = data_snapshot()
    catalog = scalar("SELECT md5(jsonb_agg(jsonb_build_array(public_signature,private_signature)::text ORDER BY public_signature)::text)FROM workspace_private.h3_rpc_manifest")
    # Catalog ACL/body digest for all core54 public/private signatures, excluding addon.
    core_sql = "SELECT md5(jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.proacl::text,pg_get_functiondef(p.oid))ORDER BY p.oid)::text)FROM pg_proc p WHERE p.oid IN(SELECT public_signature::regprocedure::oid FROM workspace_private.h3_rpc_manifest UNION ALL SELECT private_signature::regprocedure::oid FROM workspace_private.h3_rpc_manifest)"
    before_core = scalar(core_sql)
    stage = 'independent_recovery'
    # Prove the exact recovery SQL executes as nonsuper postgres, not fixture superuser.
    sql(recovery,'postgres')
    check('independent addon recovery executes as nonsuper installer', scalar("SELECT NOT rolsuper FROM pg_roles WHERE rolname='postgres'")=='t')
    check('public2 and private2 denied for anon authenticated service_role', is_closed())
    check('addon CLOSED while parent remains active', scalar("SELECT state FROM workspace_instructor_private.release")=='closed' and scalar("SELECT state FROM workspace_private.h3_release")=='active')
    check('all core54 definitions ACL and manifest unchanged', before_core==scalar(core_sql) and catalog==scalar("SELECT md5(jsonb_agg(jsonb_build_array(public_signature,private_signature)::text ORDER BY public_signature)::text)FROM workspace_private.h3_rpc_manifest"))
    check('instructor schools personal and Auth sentinel data unchanged', baseline==data_snapshot())
    for name in ["public.ws_v1_instructor_read('"+A+"','2026-11')", "public.ws_v1_instructor_write('"+A+"','settings','{}',1,gen_random_uuid())", "workspace_instructor_private.instructor_read('"+A+"','2026-11')", "workspace_instructor_private.instructor_write('"+A+"','settings','{}',1,gen_random_uuid())"]:
        p = rpc(name,False)
        check('closed invocation denied: '+name.split('(')[0], p.returncode!=0 and 'permission denied' in p.stderr)
    rpc("public.ws_v1_get_context('"+A+"')")
    check('core authenticated context still works after addon-only closure')
    sql(recovery,'postgres')
    check('independent recovery idempotent and nondestructive',is_closed() and baseline==data_snapshot() and scalar(core_sql)==before_core)
    stage = 'rollback_probe'
    sql("BEGIN;SET LOCAL ROLE ws_owner;UPDATE workspace_instructor_private.release SET state='active';GRANT EXECUTE ON FUNCTION public.ws_v1_instructor_read(uuid,text),public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid)TO authenticated;SET LOCAL ROLE ws_runtime;GRANT EXECUTE ON FUNCTION workspace_instructor_private.instructor_read(uuid,text),workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid)TO authenticated;COMMIT;")
    p = sql(recovery.replace('RESET ROLE;COMMIT;','RESET ROLE;SELECT 1/0;COMMIT;'),'postgres',False)
    check('forced late failure rolls back closure and ACL atomically',p.returncode!=0 and 'division by zero' in p.stderr and scalar("SELECT state FROM workspace_instructor_private.release")=='active' and scalar("SELECT has_function_privilege('authenticated','public.ws_v1_instructor_read(uuid,text)','EXECUTE')")=='t')
    sql(recovery,'postgres')
    stage = 'parent_close'
    sql(marker+source(core+'03-emergency-close.sql'),'postgres')
    sql(recovery,'postgres')
    check('addon recovery after parent emergency never reopens parent', scalar("SELECT state FROM workspace_private.h3_release")=='closed_unverified' and is_closed())
    check('final data preserved', baseline==data_snapshot())
    report['result'] = 'PASS'
except Exception as e:
    report['result'] = 'FAIL'
    report['error'] = str(e) if isinstance(e,RuntimeError) else stage+'_unexpected_failure'
finally:
    if owned:
        p=run(D+['rm','-f',owned],ok=False)
        gone=run(D+['inspect',owned],ok=False).returncode!=0
        report['cleanup']='PASS: owned container removed, tmpfs destroyed' if p.returncode==0 and gone else 'FAIL'
        if report['cleanup']=='FAIL':report['result']='FAIL'
    report['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'result':report.get('result'),'checks':len(report['checks']),'error':report.get('error'),'cleanup':report['cleanup']}))
    if report.get('result')!='PASS':sys.exit(1)
