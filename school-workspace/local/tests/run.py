#!/usr/bin/env python3
"""Local Docker/psql only. No DB URL parameter, no Supabase API, no network calls."""
import concurrent.futures, hashlib, json, os, subprocess, sys, time, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAME='bogunon-school01a-pg'
DOCKER=['docker','--host=unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
A='10000000-0000-0000-0000-000000000001'; B=A[:-1]+'2'; C=A[:-1]+'3'
def uid(i):return f'00000000-0000-0000-0000-{i:012}'
def mid(i):return f'20000000-0000-0000-0000-{i:012}'
def sid(i):return f'30000000-0000-0000-0000-{i:012}'
def rid():return str(uuid.uuid4())
def lit(x):
 if x is None:return 'NULL'
 if isinstance(x,(int,float)):return str(x)
 return "'"+str(x).replace("'","''")+"'"
def command(user):return DOCKER+['exec','-i',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a']
def sql(q,user='postgres',check=True):
 p=subprocess.run(command(user),input='\\set VERBOSITY verbose\n'+q,text=True,capture_output=True,env=ENV,timeout=20)
 if check and p.returncode:raise AssertionError(p.stderr[-3000:])
 return p

def auth_sql(i,q,anonymous=False,claims=None):
 c=claims if claims is not None else ({'sub':uid(i),'session_id':sid(i),'exp':int(time.time())+3600,'is_anonymous':False} if i else {})
 role='anon' if anonymous else 'authenticated'
 return f'BEGIN; SET LOCAL ROLE {role}; SET LOCAL "request.jwt.claims"={lit(json.dumps(c))}; SET LOCAL statement_timeout=\'8s\'; {q}; COMMIT;'
def auth(i,q,check=True,anonymous=False,claims=None):return sql(auth_sql(i,q,anonymous,claims),'school_anon' if anonymous else 'school_client',check)
def rpc(i,name,*args,check=True):return auth(i,f'SELECT public.ws_v1_{name}('+','.join(map(lit,args))+')',check)
def data(p):return json.loads(p.stdout.strip().splitlines()[-1])
def deny(p,expected):
 assert p.returncode!=0,'unexpected success: '+p.stdout
 assert expected in p.stderr,(expected,p.stderr)
 return p.stderr.strip().splitlines()[0]
def reset():sql((ROOT/'tests/fixtures.sql').read_text())
def scalar(q):return sql(q).stdout.strip().splitlines()[-1]
def version(i):return int(scalar(f'SELECT version FROM workspace.school_memberships WHERE id={lit(mid(i))}'))
def call(name,*args):return f'SELECT public.ws_v1_{name}('+','.join(map(lit,args))+')'
RESULT=[]
def test(name,fn):
 reset();start=time.monotonic()
 try:
  detail=fn();RESULT.append({'test':name,'status':'PASS','detail':detail or 'verified','seconds':round(time.monotonic()-start,3)});print('PASS',name,flush=True)
 except Exception as e:
  RESULT.append({'test':name,'status':'FAIL','detail':str(e),'seconds':round(time.monotonic()-start,3)});print('FAIL',name,str(e)[:1600],flush=True)

def t01():
 deny(auth(0,call('get_context',A),False,True),'42501')
 deny(auth(0,call('get_context',A),False),'unauthenticated_or_revoked')
 return 'anon EXECUTE denied (42501); missing claims authenticated caller denied'
def t02():deny(rpc(5,'get_context',A,check=False),'access_denied')
def t03():deny(rpc(1,'get_context',B,check=False),'access_denied')
def t04():
 for q in [call('set_member_role',A,mid(3),'HEALTH_TEACHER',1,rid()),call('set_membership_state',A,mid(3),'suspended',1,rid()),
           call('decide_join',A,'50000000-0000-0000-0000-000000000005','approve','HEALTH_TEACHER',None,1,rid()),
           call('propose_admin_change',A,mid(3),'add',rid())]:deny(auth(4,q,False),'admin_required')
def t05():deny(rpc(5,'decide_join',A,'50000000-0000-0000-0000-000000000005','approve','HEALTH_TEACHER',None,1,rid(),check=False),'access_denied')
def t06():
 assert data(rpc(1,'get_context',A))['role']=='SCHOOL_ADMIN'
 assert data(rpc(2,'get_context',A))['role']=='SCHOOL_ADMIN'
def t07():
 deny(rpc(6,'leave_school',B,1,rid(),check=False),'last_admin')
 deny(rpc(6,'set_member_role',B,mid(6),'HEALTH_TEACHER',1,rid(),check=False),'last_admin')
 deny(rpc(6,'set_membership_state',B,mid(6),'suspended',1,rid(),check=False),'last_admin')
def t08():
 # Two real connections; first holds API transaction lock across its successful downgrade.
 first=auth_sql(1,call('set_member_role',C,mid(101),'HEALTH_TEACHER',1,rid())+"; SELECT 'holder_ready'; SELECT pg_sleep(1.5)")
 p1=subprocess.Popen(command('school_client'),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
 p1.stdin.write(first);p1.stdin.close()
 lines=[]
 while True:
  line=p1.stdout.readline();lines.append(line)
  if 'holder_ready' in line:break
  if not line:raise AssertionError('holder failed: '+p1.stderr.read())
 p2=subprocess.Popen(command('school_client'),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
 p2.stdin.write(auth_sql(2,call('set_member_role',C,mid(102),'HEALTH_TEACHER',1,rid())));p2.stdin.close()
 waiting=False
 for _ in range(15):
  if scalar("SELECT count(*) FROM pg_stat_activity WHERE datname='school01a' AND wait_event='advisory'")!='0':waiting=True;break
  time.sleep(.03)
 p1.wait(timeout=10);p2.wait(timeout=10)
 assert p1.returncode==0,p1.stderr.read()
 err=p2.stderr.read();assert p2.returncode!=0 and 'last_admin' in err,err
 assert waiting,'did not observe second transaction waiting on advisory lock'
 assert scalar(f"SELECT count(*) FROM workspace.school_memberships WHERE school_id={lit(C)} AND role='SCHOOL_ADMIN' AND status='active'")=='1'
 return 'separate sessions; observed advisory lock wait; one commit, one last_admin rejection; 1 admin remains'
def t09():
 rpc(1,'set_membership_state',A,mid(3),'suspended',1,rid())
 deny(rpc(3,'get_context',A,check=False),'access_denied')
 deny(rpc(8,'get_context',A,check=False),'access_denied')
def t10():
 assert 'handover.create' in data(rpc(10,'get_context',A))['permissions']
 rpc(10,'leave_school',A,1,rid())
 j=data(rpc(10,'request_join',A,'HEALTH_ASSISTANT',rid()))
 assert j['epoch']==2
 rpc(1,'decide_join',A,j['join_request_id'],'approve','HEALTH_ASSISTANT','2099-01-01T00:00:00Z',1,rid())
 c=data(rpc(10,'get_context',A));assert c['epoch']==2 and 'handover.create' not in c['permissions']
 assert scalar(f'SELECT count(*) FROM workspace.membership_terms WHERE membership_id={lit(mid(10))}')=='2'
 return 'epoch 1 history retained; epoch 2 assistant has no old handover allow'
def t11():
 deny(rpc(1,'set_member_role',A,mid(6),'HEALTH_TEACHER',1,rid(),check=False),'not_found_or_denied')
 # Even privileged fixture SQL cannot evade a same-school composite FK.
 deny(sql(f"INSERT INTO workspace.membership_permission_overrides VALUES({lit(A)},{lit(mid(6))},1,'task.read','deny','school')",check=False),'23503')
 deny(sql(f"INSERT INTO workspace.admin_transfers(school_id,from_id,to_id,to_epoch,mode) VALUES({lit(A)},{lit(mid(1))},{lit(mid(6))},1,'add')",check=False),'23503')
def t12():
 for q in ['SELECT * FROM workspace.school_memberships',"UPDATE workspace.school_memberships SET role='SCHOOL_ADMIN'",'SET LOCAL ROLE ws_runtime','SELECT workspace_private.actor()']:
  deny(auth(1,q,False),'42501')
def t13():
 rpc(1,'get_context',A)
 for q in ["UPDATE workspace.audit_entries SET action='forged'",'DELETE FROM workspace.audit_entries']:
  deny(auth(1,q,False),'42501')
 # Runtime itself has no mutation privileges for append-only audit/history.
 for q in ['UPDATE workspace.audit_entries SET action=\'forged\'','DELETE FROM workspace.audit_entries','DELETE FROM workspace.role_change_history']:
  deny(sql('BEGIN; SET LOCAL ROLE ws_runtime; '+q+'; ROLLBACK;',check=False),'42501')
def t14():
 r=rid();a=data(rpc(7,'request_join',A,'HEALTH_TEACHER',r));b=data(rpc(7,'request_join',A,'HEALTH_TEACHER',r));assert a==b
 assert scalar(f'SELECT count(*) FROM workspace.command_receipts WHERE request_id={lit(r)}')=='1'
 assert scalar(f"SELECT count(*) FROM workspace.audit_entries WHERE request_id={lit(r)}")=='1'
 deny(rpc(7,'request_join',A,'HEALTH_ASSISTANT',r,check=False),'idempotency_mismatch')
def t15():
 before=data(rpc(3,'get_context',A));rpc(1,'set_membership_state',A,mid(3),'revoked',1,rid())
 deny(rpc(3,'get_context',A,check=False),'access_denied')
 assert scalar(f'SELECT count(*) FROM auth.sessions WHERE id={lit(sid(3))}')=='1'
 rpc(4,'revoke_current_session',rid())
 deny(rpc(4,'get_context',A,check=False),'unauthenticated_or_revoked')
 deny(rpc(4,'bootstrap',check=False),'unauthenticated_or_revoked')
 return 'unchanged old JWT/session fails membership check; separate session denylist blocks bootstrap and context'

def t16():
 j=data(rpc(7,'request_join',A,'HEALTH_TEACHER',rid()))
 rpc(1,'decide_join',A,j['join_request_id'],'approve','HEALTH_TEACHER',None,1,rid())
 assert data(rpc(7,'get_context',A))['role']=='HEALTH_TEACHER'
 deny(rpc(1,'decide_join',A,j['join_request_id'],'approve','HEALTH_TEACHER',None,1,rid(),check=False),'conflict')
def t17():
 proposal=data(rpc(1,'propose_admin_change',A,mid(3),'add',rid()))
 rpc(3,'accept_admin_change',A,proposal['transfer_id'],1,rid())
 assert data(rpc(3,'get_context',A))['role']=='SCHOOL_ADMIN'
 assert data(rpc(1,'get_context',A))['role']=='SCHOOL_ADMIN'
 deny(rpc(1,'propose_admin_change',A,mid(4),'add',rid(),check=False),'eligible_teacher_required')
def t18():
 p=data(rpc(1,'propose_admin_change',A,mid(3),'transfer',rid()))
 rpc(3,'accept_admin_change',A,p['transfer_id'],1,rid())
 assert data(rpc(1,'get_context',A))['role']=='HEALTH_TEACHER'
 assert data(rpc(3,'get_context',A))['role']=='SCHOOL_ADMIN'
 assert scalar("SELECT count(*) FROM workspace.role_change_history WHERE action IN('accept_admin_change','transfer_admin_out')")=='2'
def t19():
 p=data(rpc(1,'propose_admin_change',A,mid(3),'add',rid()))
 deny(rpc(4,'accept_admin_change',A,p['transfer_id'],1,rid(),check=False),'invalid_transfer')
 sql(f'UPDATE workspace.admin_transfers SET expires_at=clock_timestamp()-interval \'1 second\' WHERE id={lit(p["transfer_id"])}')
 deny(rpc(3,'accept_admin_change',A,p['transfer_id'],1,rid(),check=False),'invalid_transfer')
def t20():
 denied=['rolsuper','rolbypassrls','rolcanlogin']
 x=json.loads(scalar("SELECT json_agg(row_to_json(r)) FROM (SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN('ws_runtime','ws_authz_reader'))r"))
 assert len(x)==2 and all(not r[k] for r in x for k in denied),x
 assert scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_get_userbyid(c.relowner)<>'ws_owner')")=='0'
 assert scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'ws_v1_%' AND p.prosecdef")=='0'
 assert scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='workspace_private' AND p.prosecdef AND pg_get_userbyid(p.proowner) NOT IN('ws_runtime','ws_authz_reader')")=='0'
 assert scalar("SELECT pg_has_role('school_client','ws_runtime','MEMBER') OR pg_has_role('ws_runtime','ws_owner','MEMBER') OR pg_has_role('ws_runtime','ws_authz_reader','MEMBER')")=='f'
 return '13 FORCE-RLS tables; runtime/authz reader non-owner NOLOGIN/NOBYPASSRLS; invoker public wrappers'
def t21():
 claims={'sub':uid(1),'session_id':sid(1),'exp':int(time.time())-1}
 deny(auth(1,call('get_context',A),False,claims=claims),'unauthenticated_or_revoked')
 claims['exp']=int(time.time())+1000;claims['is_anonymous']=True
 deny(auth(1,call('get_context',A),False,claims=claims),'unauthenticated_or_revoked')
 sql(f'DELETE FROM auth.sessions WHERE id={lit(sid(1))}')
 deny(rpc(1,'get_context',A,check=False),'unauthenticated_or_revoked')
def t22():
 sql(f"UPDATE workspace.accounts SET status='suspended' WHERE user_id={lit(uid(3))}")
 deny(rpc(3,'get_context',A,check=False),'unauthenticated_or_revoked')
 sql(f"UPDATE workspace.schools SET state='recovery_locked' WHERE id={lit(A)}")
 deny(rpc(1,'get_context',A,check=False),'access_denied')
def t23():
 deny(sql(f"INSERT INTO workspace.schools(office_code,school_code,name,state) VALUES('B10','9000001','duplicate','active')",check=False),'23505')
 deny(sql(f"UPDATE workspace.school_memberships SET role='SCHOOL_ADMIN' WHERE id={lit(mid(5))}",check=False),'23514')
 deny(sql(f"UPDATE workspace.school_memberships SET valid_until=valid_from-interval '1 second' WHERE id={lit(mid(3))}",check=False),'23514')
def t24():
 # Direct runtime role probes are controlled test-only role injection, never API success evidence.
 claims={'sub':uid(1),'session_id':sid(1),'exp':int(time.time())+3600}
 q=f"BEGIN; SET LOCAL ROLE ws_runtime; SET LOCAL \"request.jwt.claims\"={lit(json.dumps(claims))}; SELECT count(*) FROM workspace.school_memberships WHERE school_id={lit(B)}; ROLLBACK;"
 assert sql(q).stdout.strip()=='0'
 q=f"BEGIN; SET LOCAL ROLE ws_runtime; SET LOCAL \"request.jwt.claims\"={lit(json.dumps(claims))}; UPDATE workspace.school_memberships SET role='HEALTH_TEACHER' WHERE school_id={lit(B)} RETURNING id; ROLLBACK;"
 assert sql(q).stdout.strip()==''
 return 'RLS defense in depth filters B rows even for runtime role; owner injection only for this negative probe'
def t25():
 r=rid();rpc(1,'set_membership_state',A,mid(3),'suspended',1,r)
 rpc(2,'set_membership_state',A,mid(1),'suspended',1,rid())
 deny(rpc(1,'set_membership_state',A,mid(3),'suspended',1,r,check=False),'access_denied')
def t26():
 r=rid();before=scalar('SELECT count(*) FROM workspace.audit_entries')
 deny(rpc(1,'set_member_role',A,mid(3),'HEALTH_TEACHER',999,r,check=False),'conflict')
 assert scalar('SELECT count(*) FROM workspace.audit_entries')==before
 assert scalar(f'SELECT count(*) FROM workspace.command_receipts WHERE request_id={lit(r)}')=='0'
 assert version(3)==1


def t27():
 i=11
 sql(f"INSERT INTO auth.users VALUES({lit(uid(i))}); INSERT INTO auth.sessions(id,user_id) VALUES({lit(sid(i))},{lit(uid(i))});")
 a=data(rpc(i,'bootstrap'));b=data(rpc(i,'bootstrap'));assert a==b
 assert scalar(f"SELECT count(*) FROM workspace.accounts WHERE user_id={lit(uid(i))}")=='1'
 assert scalar(f"SELECT count(*) FROM workspace.school_memberships WHERE actor_id={lit(a['actor_id'])}")=='0'
 deny(rpc(i,'get_context',A,check=False),'access_denied')
 return 'bootstrap creates only own account; repeat does not create a membership'
def t28():
 sql(f"INSERT INTO workspace.join_requests(id,school_id,membership_id,epoch,requested_role) VALUES('50000000-0000-0000-0000-000000000001',{lit(A)},{lit(mid(1))},1,'HEALTH_TEACHER')")
 deny(rpc(1,'decide_join',A,'50000000-0000-0000-0000-000000000001','approve','HEALTH_TEACHER',None,1,rid(),check=False),'self_approval')
 deny(rpc(1,'set_member_role',A,mid(4),'SCHOOL_ADMIN',1,rid(),check=False),'admin_promotion_requires_transfer')
 deny(rpc(7,'request_join',A,'SCHOOL_ADMIN',rid(),check=False),'invalid_role')
def t29():
 r=rid();before=scalar('SELECT count(*) FROM workspace.role_change_history')
 sql('REVOKE INSERT ON workspace.audit_entries FROM ws_runtime')
 try:
  deny(rpc(1,'set_member_role',A,mid(3),'HEALTH_TEACHER',1,r,check=False),'42501')
 finally:sql('GRANT INSERT ON workspace.audit_entries TO ws_runtime')
 assert version(3)==1
 assert scalar('SELECT count(*) FROM workspace.role_change_history')==before
 assert scalar(f'SELECT count(*) FROM workspace.command_receipts WHERE request_id={lit(r)}')=='0'
 return 'forced audit permission failure rolls back member version, role history, receipt atomically'
def t30():
 r=rid()
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  fs=[pool.submit(rpc,7,'request_join',A,'HEALTH_TEACHER',r) for _ in range(2)]
  values=[data(f.result()) for f in fs]
 assert values[0]==values[1]
 assert scalar(f'SELECT count(*) FROM workspace.command_receipts WHERE request_id={lit(r)}')=='1'
 assert scalar(f'SELECT count(*) FROM workspace.audit_entries WHERE request_id={lit(r)}')=='1'
 return 'parallel independent requests same UUID return same result; exactly one mutation/audit/receipt'
def t31():
 sql(f"UPDATE auth.sessions SET created_at=statement_timestamp()-interval '11 minutes' WHERE id={lit(sid(1))}")
 rpc(1,'get_context',A)
 deny(rpc(1,'set_member_role',A,mid(3),'HEALTH_TEACHER',1,rid(),check=False),'reauth_required')
 claims={'sub':uid(3),'session_id':sid(1),'exp':int(time.time())+3600}
 deny(auth(3,call('get_context',A),False,claims=claims),'unauthenticated_or_revoked')
 deny(auth(1,'SELECT * FROM auth.sessions',False),'42501')
def t32():
 sql(f"UPDATE workspace.school_memberships SET valid_until=statement_timestamp()-interval '1 day' WHERE id={lit(mid(6))}")
 deny(rpc(6,'get_context',B,check=False),'access_denied')
 return 'no valid admin => fail closed even before recovery-state scheduler runs'
def t33():
 p=data(rpc(1,'propose_admin_change',A,mid(3),'add',rid()))
 rpc(2,'set_membership_state',A,mid(1),'suspended',1,rid())
 deny(rpc(3,'accept_admin_change',A,p['transfer_id'],1,rid(),check=False),'invalid_transfer')
 assert data(rpc(3,'get_context',A))['role']=='HEALTH_TEACHER'
def t34():
 sql(f'DELETE FROM auth.sessions WHERE user_id={lit(uid(1))}; DELETE FROM auth.users WHERE id={lit(uid(1))}')
 assert scalar(f"SELECT user_id IS NULL FROM workspace.accounts WHERE id='40000000-0000-0000-0000-000000000001'")=='t'
 assert scalar(f'SELECT count(*) FROM workspace.school_memberships WHERE id={lit(mid(1))}')=='1'
 assert data(rpc(2,'get_context',A))['role']=='SCHOOL_ADMIN'
 return 'synthetic Auth deletion leaves account tombstone, school memberships/terms intact'

def main():
 # Refuse non-isolated Docker targets; no externally published port is allowed.
 info=json.loads(subprocess.check_output(DOCKER+['inspect',NAME],text=True,env=ENV))[0]
 assert info['HostConfig']['NetworkMode']=='none' and not info['HostConfig']['PortBindings']
 tests=[v for k,v in sorted(globals().items()) if k.startswith('t') and k[1:].isdigit()]
 for i,fn in enumerate(tests,1):test(f'{i:02d}_{fn.__name__}',fn)
 summary={'scope':'Standalone PostgreSQL 17.6 + synthetic Auth schema; not hosted Supabase/Auth/PostgREST',
 'base_sha':'38b45c2a762224f0af976026519b3d47463e4454','branch':'feature/school-01a-local-rls',
 'pass':sum(x['status']=='PASS' for x in RESULT),'fail':sum(x['status']=='FAIL' for x in RESULT),'not_run':['Hosted Supabase auth.sessions grants','JWT signature verification','GoTrue refresh','PostgREST routing','Electron/Web adapters'],
 'tests':RESULT}
 (ROOT/'evidence/results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in summary.items() if k!='tests'},ensure_ascii=False),flush=True)
 return bool(summary['fail'])
if __name__=='__main__':sys.exit(main())
