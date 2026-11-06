"""Reuse frozen D0 SQL assertions via native Windows PG17. No Hosted/HTTP calls."""
from pathlib import Path
import os,sys,json,subprocess,uuid,runpy
R=Path(__file__).resolve().parents[2];E=R/'school-workspace/school09d0';OUT=Path(os.environ['TD2_EVIDENCE_ROOT'])/'school09d0';OUT.mkdir(parents=True,exist_ok=True);(OUT/'evidence').mkdir(exist_ok=True)
root=Path(os.environ['TD2_ROOT']).resolve();data=Path(os.environ['SCHOOL05_PG_DATA']).resolve();port=os.environ['SCHOOL05_PG_PORT'];binary=Path(os.environ['SCHOOL05_PG_BIN'])/'psql.exe'
assert sys.platform=='win32' and data.is_relative_to(root) and port.isdecimal() and 1024<=int(port)<=65535
ENV={k:v for k,v in os.environ.items()if not k.startswith('PG')};ENV.update(PGCONNECT_TIMEOUT='5',PGCLIENTENCODING='UTF8',PGPASSFILE=str(root/'no-password-file'))
def native_sql(q,ok=True,role='fixture_root'):
 assert role in ('postgres','fixture_root','fixture_setup','school_client')
 p=subprocess.run([str(binary),'-X','-w','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse','-h','127.0.0.1','-p',port,'-U',role,'-d','postgres','-f','-'],input=q.encode('utf8'),capture_output=True,env=ENV,timeout=60)
 p.stdout=p.stdout.decode('utf8').replace('\r\n','\n');p.stderr=p.stderr.decode('utf8').replace('\r\n','\n')
 if ok:assert p.returncode==0,p.stderr[-2200:]
 return p

def native_security(sql,case,_root,_docker,_name,_env,recovery,check):
 """Native RPC checks: these are not HTTP/PostgREST/JWT-signature tests."""
 A='10000000-0000-0000-0000-000000000001';B=A[:-1]+'2';sid='30000000-0000-0000-0000-000000000003';sid2='39999999-0000-0000-0000-000000000003'
 def lit(v):return "'"+str(v).replace("'","''")+"'"
 def rpc(i,args,session=None,ok=True):
  claims={'role':'authenticated','sub':f'00000000-0000-0000-0000-{i:012}','session_id':session or f'30000000-0000-0000-0000-{i:012}','exp':2000000000,'is_anonymous':False}
  return sql('BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(claims))+';SELECT public.'+args+';COMMIT;',ok,role='school_client')
 def ctx(s=A):return 'ws_v1_get_context('+lit(s)+')'
 case('NATIVE approved supported Auth boolean and school context',lambda:rpc(3,ctx()))
 def task():return 'ws_v1_create_task('+lit(A)+','+lit('합성 SCHOOL09 보안 검증')+','+lit('개인자료 없는 운영 업무')+",'NORMAL',NULL,'{}'::uuid[],"+lit(uuid.uuid4())+')'
 case('NATIVE approved teacher writes through supported Auth business RPC',lambda:rpc(3,task()))
 sql("UPDATE workspace.school_memberships SET role='HEALTH_ASSISTANT' WHERE id='20000000-0000-0000-0000-000000000003'")
 case('NATIVE live role downgrade denies prior teacher write',lambda:check(rpc(3,task(),ok=False).returncode!=0))
 sql("UPDATE workspace.school_memberships SET role='HEALTH_TEACHER' WHERE id='20000000-0000-0000-0000-000000000003'")

 case('NATIVE pending and cross-school requests denied',lambda:(check(rpc(5,ctx(),ok=False).returncode!=0),check(rpc(4,ctx(B),ok=False).returncode!=0)))
 sql("UPDATE workspace.school_memberships SET status='suspended' WHERE id='20000000-0000-0000-0000-000000000003'")
 case('NATIVE live membership suspension denies next request',lambda:check(rpc(3,ctx(),ok=False).returncode!=0))
 sql("UPDATE workspace.school_memberships SET status='active' WHERE id='20000000-0000-0000-0000-000000000003'")
 sql("INSERT INTO auth.sessions(id,user_id)VALUES('"+sid2+"','00000000-0000-0000-0000-000000000003')")
 case('NATIVE two distinct sessions for subject both initially valid',lambda:(rpc(3,ctx()),rpc(3,ctx(),sid2)))
 sql("DELETE FROM auth.sessions WHERE id='"+sid+"'")
 case('NATIVE Auth session revocation denies current session only',lambda:(check(rpc(3,ctx(),ok=False).returncode!=0),rpc(3,ctx(),sid2)))
 sql("UPDATE auth.sessions SET not_after=now()-interval '1 second'WHERE id='"+sid2+"'")
 case('NATIVE session expiry overrides unexpired request claims',lambda:check(rpc(3,ctx(),sid2,False).returncode!=0))
 sql("UPDATE auth.sessions SET not_after=NULL WHERE id='"+sid2+"'")
 case('NATIVE subject/session mismatch denied',lambda:check(rpc(4,ctx(),sid2,False).returncode!=0))
 case('NATIVE purpose revocation records session and denies next request',lambda:(rpc(3,'ws_v1_revoke_current_session('+lit(uuid.uuid4())+')',sid2),check(rpc(3,ctx(),sid2,False).returncode!=0)))
 before=sql('SELECT count(*) FROM workspace.shared_tasks').stdout.strip()
 recovery('postgres','03-emergency-close.sql')
 case('NATIVE emergency closure preserves task rows',lambda:check(sql('SELECT count(*) FROM workspace.shared_tasks').stdout.strip()==before))

assert Path(native_sql('SHOW data_directory',role='postgres').stdout.strip()).resolve()==data
s=(E/'tests/run.py').read_text()
needle="exec(compile(s,'<frozen H3 DB utilities>','exec'),ns)";assert s.count(needle)==1
s=s.replace(needle,needle+"\nns['sql']=native_sql;ns['E']=OUT")
needle="runpy.run_path(str(E/'tests/rest.py'))['run'](sql,case,E,D,NAME,ENV,drift_recovery,check)";assert s.count(needle)==1
s=s.replace(needle,'native_security(sql,case,E,D,NAME,ENV,drift_recovery,check)').replace("E/'evidence/","OUT/'evidence/")
ns={'__file__':str(E/'tests/run.py'),'__name__':'native_windows_d0','native_sql':native_sql,'native_security':native_security,'OUT':OUT}
exec(compile(s,'<unchanged D0 SQL assertions; native transport and explicit non-HTTP security checks>','exec'),ns)
x=json.loads((OUT/'evidence/results.json').read_text());
for c in x['checks']:c['classification']='WINDOWS LOCAL DB'
x.update(sourceSha=os.environ['GITHUB_SHA'],backend='native Windows PostgreSQL17',auth='synthetic Auth fixtures/request claims; not real Google/JWT verification',http='NOT RUN; original D0 LOCAL PostgREST15 referenced separately',hosted='NOT RUN',baeruriRequests=0,pass_count=sum(c['status']=='PASS'for c in x['checks']),fail_count=sum(c['status']=='FAIL'for c in x['checks']))
(OUT/'evidence/results.json').write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf8');print('WINDOWS native SQL checks',x['pass_count'],'PASS',flush=True)
