"""Synthetic, network-none PG17 dump/AEAD/restore rehearsal. No endpoint/credential input."""
import datetime,hashlib,json,os,pathlib,re,subprocess,sys,tempfile,time,uuid,shutil
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
ROOT=pathlib.Path(__file__).resolve().parents[4]
if len(sys.argv)!=2:raise SystemExit('usage: backup_restore.py <sanitized-evidence.json>')
OUT=pathlib.Path(sys.argv[1]).resolve()
D=['docker','--host=unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items()if k not in('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
IMAGE='postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
report={'sourceSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'harnessSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'classification':'SYNTHETIC LOCAL PostgreSQL backup/restore; not Supabase CLI or Hosted','operating':'NOT RUN','image':IMAGE,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':[],'files':{},'cleanup':'NOT RUN'}
containers=[];private=pathlib.Path(tempfile.mkdtemp(prefix='bogunon-p4-private-'));keys=pathlib.Path(tempfile.mkdtemp(prefix='bogunon-p4-keys-'));stage='setup'
def run(args,data=None,ok=True):
 p=subprocess.run(args,input=data,capture_output=True,env=ENV,timeout=120)
 if ok and p.returncode:
  error=next((x for x in p.stderr.decode(errors='replace').splitlines()if 'ERROR:'in x),'subprocess_failed')
  raise RuntimeError(stage+': '+error[:180])
 return p

def sql(c,q,user='h2_root',db='postgres',ok=True):return run(D+['exec','-i',c,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d',db],q.encode(),ok)
def value(c,q,**kw):return sql(c,q,**kw).stdout.decode().strip().splitlines()[-1]
def check(n,cond=True):
 if not cond:raise RuntimeError(n)
 report['checks'].append({'name':n,'status':'PASS'})
def src(p):return (ROOT/p).read_text()
def start(user):
 name='bogunon-h2-p4-'+uuid.uuid4().hex
 c=run(D+['run','--pull=never','-d','--name',name,'--label','bogunon.qa=h2-p4','--network','none','--memory','512m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER='+user,'-e','POSTGRES_DB=postgres',IMAGE,'-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=panic']).stdout.decode().strip();containers.append(c)
 for _ in range(120):
  if b'init process complete' in run(D+['logs',c]).stdout and run(D+['exec',c,'pg_isready','-U',user],ok=False).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('postgres_start_timeout')
 info=json.loads(run(D+['inspect',c]).stdout)[0]
 check('isolated container network none/no ports '+user,info['HostConfig']['NetworkMode']=='none' and not info['HostConfig']['PortBindings'])
 return c

def snapshot(c,db):
 # Names and semantic definitions, never cross-instance OIDs.
 catalog=json.loads(value(c,"SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]')FROM(SELECT jsonb_build_object('kind','fn','schema',n.nspname,'name',p.proname,'def',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)ORDER BY coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type)FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a))x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE 'pg_%' UNION ALL SELECT jsonb_build_object('kind','rel','schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)ORDER BY coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),pg_get_userbyid(a.grantor),a.privilege_type)FROM aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S'THEN 'S'::\"char\" ELSE 'r'::\"char\" END,c.relowner)))a),'rls',c.relrowsecurity,'force',c.relforcerowsecurity)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE 'pg_%' AND c.relkind IN('r','S') UNION ALL SELECT jsonb_build_object('kind','policy','schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'cmd',cmd,'using',qual,'check',with_check)FROM pg_policies UNION ALL SELECT jsonb_build_object('kind','fk','table',conrelid::regclass::text,'name',conname,'def',pg_get_constraintdef(oid),'validated',convalidated)FROM pg_constraint WHERE contype='f' AND connamespace<>'pg_catalog'::regnamespace)q",db=db))
 tables=json.loads(value(c,"SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname)ORDER BY n.nspname,c.relname)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'AND n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE 'pg_%'",db=db))
 data={t:json.loads(value(c,f"SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text)::text,'[]')))FROM {t} t",db=db))for t in tables}
 schema_security=json.loads(value(c,"SELECT jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(x.grantee),'PUBLIC'),pg_get_userbyid(x.grantor),x.privilege_type,x.is_grantable)ORDER BY coalesce(pg_get_userbyid(x.grantee),'PUBLIC'),x.privilege_type)FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))x))ORDER BY n.nspname)FROM pg_namespace n WHERE n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE 'pg_%'",db=db))
 defaults=json.loads(value(c,"SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'GLOBAL'),d.defaclobjtype,d.defaclacl::text)ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'GLOBAL'),d.defaclobjtype),'[]')FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace",db=db))
 return {'catalog':catalog,'tables':data,'schemaSecurity':schema_security,'defaultPrivileges':defaults}

def closed(c,db):
 return value(c,"SELECT count(*)=54 AND bool_and(NOT has_function_privilege(r.oid,m.public_signature,'EXECUTE')AND NOT has_function_privilege(r.oid,m.private_signature,'EXECUTE'))FROM workspace_private.h3_rpc_manifest m CROSS JOIN pg_roles r WHERE r.rolname='authenticated'",db=db)=='t' and value(c,"SELECT bool_and(NOT has_function_privilege(r.oid,p.oid,'EXECUTE'))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r WHERE(n.nspname='public'AND p.proname IN('ws_v1_instructor_read','ws_v1_instructor_write')OR n.nspname='workspace_instructor_private')AND r.rolname IN('anon','authenticated','service_role')",db=db)=='t' and value(c,'SELECT state FROM workspace_private.h3_release',db=db)=='closed' and value(c,'SELECT state FROM workspace_instructor_private.release',db=db)=='closed'
try:
 run(D+['image','inspect',IMAGE]);a=start('h2_root');stage='synthetic_fixture'
 sql(a,'CREATE ROLE postgres LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT')
 for p in ['school-workspace/local/tests/auth_fixture.sql','school-workspace/school06/tests/bootstrap.sql']:sql(a,src(p).replace("'school01a'","'postgres'"))
 sql(a,"GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES(id)ON auth.users TO postgres;GRANT SELECT(id,user_id,created_at,not_after)ON auth.sessions TO postgres;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt()TO postgres;CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS;ALTER SCHEMA auth OWNER TO supabase_admin;GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;CREATE ROLE service_role NOLOGIN NOBYPASSRLS;")
 marker="SET bogunon.workspace_target='xxownwxxajzrviuvvfiu';SET bogunon.workspace_plan='SCHOOL-09D-0:CLOSED';"
 paths=['school-workspace/school09d0/sql/01-install-closed-candidate.sql','school-workspace/hosted-h1/sql/01-instructor-addon-closed.sql']
 report['sqlSha256']={p:hashlib.sha256(src(p).encode()).hexdigest()for p in paths}
 sql(a,marker+src(paths[0]),'postgres');sql(a,"SET bogunon.h1_plan='REVIEW-CLOSED';"+src(paths[1]),'postgres')
 sql(a,src('school-workspace/local/tests/fixtures.sql'))
 sql(a,"CREATE TABLE public.h2_notes(id bigserial PRIMARY KEY,label text NOT NULL);INSERT INTO public.h2_notes(label)VALUES('SYNTHETIC ONE'),('SYNTHETIC TWO');SELECT setval('public.h2_notes_id_seq',42,true);CREATE TABLE public.h2_links(id bigint PRIMARY KEY, note_id bigint REFERENCES public.h2_notes(id));INSERT INTO public.h2_links VALUES(1,1);CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[]);INSERT INTO supabase_migrations.schema_migrations VALUES('synthetic-p4',ARRAY['synthetic only']);CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text REFERENCES storage.buckets(id),name text);INSERT INTO storage.buckets VALUES('synthetic');INSERT INTO storage.objects VALUES(gen_random_uuid(),'synthetic','example.txt');INSERT INTO workspace_instructor.instructor_schedules VALUES('10000000-0000-0000-0000-000000000001','{}','[]',1,clock_timestamp())")
 check('source synthetic core54 and separate addon2 CLOSED',closed(a,'postgres'))
 # Extract the frozen installer's own catalog projection, not a weakened replacement.
 frozen=src(paths[0]);frozen=frozen.split('fingerprint=((SELECT md5',1)[1].split(')q))AND state',1)[0]
 projection=frozen.split(' FROM(',1)[1]
 fingerprint_query='SELECT jsonb_agg(x ORDER BY x::text)FROM('+projection+')q'
 original_metadata=json.loads(value(a,fingerprint_query))
 before=snapshot(a,'postgres');report['sourceTableCount']=len(before['tables']);report['sourceRowCount']=sum(x['count']for x in before['tables'].values())
 report['versions']={tool:run(D+['exec',a,tool,'--version']).stdout.decode().strip()for tool in ['pg_dump','pg_dumpall','psql']};report['versions']['encryption']='Python cryptography AES-256-GCM'
 check('pg_dump pg_dumpall psql pinned 17.6',all('17.6' in v for v in list(report['versions'].values())[:3]))
 stage='backup';backup_start=time.monotonic()
 # Quiescent synthetic DB; no background writers. Separate dumps are not a multi-file atomic production snapshot guarantee.
 canonical_checks=[]
 for table,col in [('shared_inventory_items','minimum_quantity'),('shared_inventory_lots','quantity')]:
  expr=col+' BETWEEN 0 AND 1000000000 AND scale('+col+')<=3'
  if 'CHECK('+expr+')'not in src(paths[0]):raise RuntimeError('frozen_check_source_mismatch')
  canonical_checks.append({'table':table,'constraint':table+'_'+col+'_check','expression':expr})
 files={'canonical-checks.json':json.dumps(canonical_checks).encode(),'roles.sql':run(D+['exec',a,'pg_dumpall','-U','h2_root','--roles-only','--no-role-passwords']).stdout,
 'schema.sql':run(D+['exec',a,'pg_dump','-U','h2_root','-d','postgres','--schema-only']).stdout,
 'data.sql':run(D+['exec',a,'pg_dump','-U','h2_root','-d','postgres','--data-only']).stdout,
 'storage-objects.json':json.dumps({'synthetic/example.txt':'SYNTHETIC STORAGE BYTES'}).encode(),
 'acl-representation.json':value(a,"SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text)ORDER BY n.nspname,c.relname),'[]')FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'AND n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE 'pg_%'AND c.relacl=acldefault('r',c.relowner)").encode()}
 check('dump commands produce nonempty files and no role passwords',all(files.values()) and b' PASSWORD 'not in files['roles.sql'])
 key=AESGCM.generate_key(bit_length=256);(keys/'recovery.key').write_bytes(key);os.chmod(keys/'recovery.key',0o600);cipher=AESGCM(key)
 for name,data in files.items():
  nonce=os.urandom(12);encrypted=nonce+cipher.encrypt(nonce,data,name.encode());f=private/(name+'.aesgcm');f.write_bytes(encrypted);os.chmod(f,0o600)
  report['files'][name]={'plainBytes':len(data),'plainSha256':hashlib.sha256(data).hexdigest(),'encryptedBytes':len(encrypted),'encryptedSha256':hashlib.sha256(encrypted).hexdigest()}
  check('AEAD decrypt and hash '+name,cipher.decrypt(encrypted[:12],encrypted[12:],name.encode())==data)
 encrypted=(private/'data.sql.aesgcm').read_bytes();tampered=bytearray(encrypted);tampered[-1]^=1
 for label,k,blob in [('tamper',key,bytes(tampered)),('wrong key',os.urandom(32),encrypted)]:
  denied=False
  try:AESGCM(k).decrypt(blob[:12],blob[12:],b'data.sql')
  except Exception:denied=True
  check('AEAD rejects '+label,denied)
 check('private encrypted files and key mode restrictions',private.stat().st_mode&0o777==0o700 and keys.stat().st_mode&0o777==0o700 and all(p.stat().st_mode&0o777==0o600 for p in [*private.iterdir(),*keys.iterdir()]))
 report['backupSeconds']=round(time.monotonic()-backup_start,3)
 stage='restore';b=start('h2_root');restore_start=time.monotonic()
 def decrypt(name):
  v=(private/(name+'.aesgcm')).read_bytes();data=cipher.decrypt(v[:12],v[12:],name.encode());assert hashlib.sha256(data).hexdigest()==report['files'][name]['plainSha256'];return data.decode()
 roles=decrypt('roles.sql')
 # Same lab bootstrap identity must create roles so PG17 GRANTED BY admin chains match.
 # Only its already-existing CREATE is omitted from execution, never from the backup.
 if roles.count('CREATE ROLE h2_root;')!=1:raise RuntimeError('lab_bootstrap_role_not_exact')
 sql(b,roles.replace('CREATE ROLE h2_root;','-- existing identical lab bootstrap role'),'h2_root')
 sql(b,'CREATE DATABASE restore_fail OWNER h2_root;','h2_root')
 # Both owned target DBs are blank. Fail one transaction deliberately, never retry a partially restored target blindly.
 p=sql(b,'BEGIN;'+decrypt('schema.sql')+'\nSELECT 1/0;COMMIT;','h2_root','restore_fail',False)
 check('failed schema restore stops and rolls back all new user schemas',p.returncode!=0 and b'division by zero'in p.stderr and value(b,"SELECT to_regnamespace('workspace')IS NULL AND to_regnamespace('auth')IS NULL",db='restore_fail')=='t')
 sql(b,'BEGIN;'+decrypt('schema.sql')+'\n'+decrypt('data.sql')+'\nCOMMIT;','h2_root','postgres')
 # pg_dump canonicalizes explicit default-owner ACL to NULL. Preserve the immutable
 # release fingerprint with a source-recorded, authenticated metadata sidecar.
 # Only exact default-owner ACLs qualify; final raw ACL equality is mandatory.
 quote=lambda x:'"'+x.replace('"','""')+'"'
 for acl in json.loads(decrypt('acl-representation.json')):
  ident=quote(acl['schema'])+'.'+quote(acl['name']);owner=quote(acl['owner'])
  sql(b,'BEGIN;REVOKE ALL ON TABLE '+ident+' FROM '+owner+';GRANT ALL ON TABLE '+ident+' TO '+owner+';COMMIT;',db='postgres')
  got=value(b,"SELECT relacl::text FROM pg_class WHERE oid='"+ident.replace("'","''")+"'::regclass",db='postgres')
  if got!=acl['acl']:raise RuntimeError('default_owner_acl_representation_not_restored')
 check('authenticated sidecar restores exact default-owner ACL without changing effective grants')
 # pg_dump deparsing flattens BETWEEN's nested AND tree. Rebuild only these exact
 # original-source CHECKs, validated in one isolated restore transaction; never reset fingerprints.
 for chk in json.loads(decrypt('canonical-checks.json')):
  ident='workspace.'+quote(chk['table']);con=quote(chk['constraint'])
  sql(b,'BEGIN;ALTER TABLE '+ident+' DROP CONSTRAINT '+con+';ALTER TABLE '+ident+' ADD CONSTRAINT '+con+' CHECK('+chk['expression']+');COMMIT;',db='postgres')
 check('original-source CHECK parse shape restored and constraints revalidated')
 report['restoreSeconds']=round(time.monotonic()-restore_start,3)
 after=snapshot(b,'postgres')
 check('all table counts row digests incl Auth migration and storage metadata identical',before['tables']==after['tables'])
 check('schema owners and effective schema ACL identical',before['schemaSecurity']==after['schemaSecurity'])
 check('creator default privileges identical',before['defaultPrivileges']==after['defaultPrivileges'])
 if before['catalog']!=after['catalog']:
  key=lambda x:(x['kind'],x.get('schema',''),x.get('name',x.get('table','')))
  old={key(x):x for x in before['catalog']};new={key(x):x for x in after['catalog']}
  report['catalogDifferences']=[{'object':list(k),'fields':[f for f in set(old.get(k,{}))|set(new.get(k,{}))if old.get(k,{}).get(f)!=new.get(k,{}).get(f)]}for k in old.keys()|new.keys()if old.get(k)!=new.get(k)]
 check('functions owners ACL RLS policies and FK metadata identical',before['catalog']==after['catalog'])
 check('all FK constraints validated',value(b,"SELECT bool_and(convalidated)FROM pg_constraint WHERE contype='f'AND connamespace<>'pg_catalog'::regnamespace",db='postgres')=='t')
 check('restored sequence state and next value correct',value(b,"SELECT last_value=42 AND is_called FROM public.h2_notes_id_seq",db='postgres')=='t'and value(b,"SELECT nextval('public.h2_notes_id_seq')",db='postgres')=='43')
 check('restored FK actually rejects missing parent',sql(b,'INSERT INTO public.h2_links VALUES(2,99999)','h2_root','postgres',False).returncode!=0)
 check('SCHOOL54 and separate Instructor2 remain CLOSED',closed(b,'postgres'))
 replay=sql(b,marker+src(paths[0]),'postgres','postgres',False)
 report['d0Replay']={'result':'PASS'if replay.returncode==0 else'FAIL','catalogDrift':'h3_catalog_drift'in replay.stderr.decode()}
 if replay.returncode:
  current=json.loads(value(b,fingerprint_query,db='postgres'))
  identify=lambda x:json.dumps({k:v for k,v in x.items()if k in('kind','schema','name','signature','table','column','role','member')},sort_keys=True)
  old={identify(x):x for x in original_metadata};new={identify(x):x for x in current}
  report['fingerprintDifferences']=[{'identity':json.loads(k),'fields':[f for f in set(old.get(k,{}))|set(new.get(k,{}))if old.get(k,{}).get(f)!=new.get(k,{}).get(f)],'sourceConstraint':old.get(k,{}).get('def')if old.get(k,{}).get('kind')=='constraint'else None,'restoredConstraint':new.get(k,{}).get('def')if new.get(k,{}).get('kind')=='constraint'else None}for k in old.keys()|new.keys()if old.get(k)!=new.get(k)]
 check('restored D0 immutable fingerprint supports checked no-op replay',replay.returncode==0)
 role_query="SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig)ORDER BY rolname)FROM pg_roles WHERE rolname NOT LIKE 'pg_%'"
 membership_query="SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),admin_option,inherit_option,set_option,pg_get_userbyid(grantor))ORDER BY pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor))FROM pg_auth_members"
 for label,q in [('roleAttributes',role_query),('memberships',membership_query)]:
  original=json.loads(value(a,q));restored=json.loads(value(b,q,db='postgres'))
  if original!=restored:report[label+'Differences']={'sourceOnly':[r for r in original if r not in restored],'restoreOnly':[r for r in restored if r not in original]}
  check('restored '+label+' identical',original==restored)

 object_copy=json.loads(decrypt('storage-objects.json'));check('separate synthetic Storage bytes restored',object_copy=={'synthetic/example.txt':'SYNTHETIC STORAGE BYTES'})
 check('encrypted backups unchanged after restore',all(hashlib.sha256((private/(n+'.aesgcm')).read_bytes()).hexdigest()==m['encryptedSha256']for n,m in report['files'].items()))
 check('source DB unchanged by backup and restore',before==snapshot(a,'postgres'))
 report['omissions']=['Real managed Auth internals/provider config/passwords/token restoration NOT RUN','Actual Storage download/API permissions NOT RUN; synthetic bytes only','Operating data consistency RPO/RTO and encrypted key custody NOT RUN','Supabase CLI filtering/managed role restoration NOT RUN; raw pg_dump synthetic fixture only']
 report['result']='PASS'
except Exception as e:
 report['result']='FAIL';report['error']=str(e)if isinstance(e,RuntimeError)else stage+'_unexpected_failure'
finally:
 cleanup=True
 for c in containers:
  p=run(D+['rm','-f',c],ok=False);cleanup=cleanup and p.returncode==0 and run(D+['inspect',c],ok=False).returncode!=0
 shutil.rmtree(private);shutil.rmtree(keys);cleanup=cleanup and not private.exists()and not keys.exists()
 report['cleanup']='PASS owned containers/tmpfs/encrypted synthetic files/key removed'if cleanup else'FAIL'
 if not cleanup:report['result']='FAIL'
 report['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat();OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'result':report.get('result'),'checks':len(report['checks']),'error':report.get('error'),'cleanup':report['cleanup']}))
 if report.get('result')!='PASS':sys.exit(1)
