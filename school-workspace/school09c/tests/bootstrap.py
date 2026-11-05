import json,uuid

def run(sql,case,E,d):
 scalar=d['scalar'];rpc=d['rpc'];lit=d['lit'];deny=d['deny'];check=d['assertion'];S='10000000-0000-0000-0000-000000000004';target='40000000-0000-0000-0000-000000000011'
 # Operator provisioning is a synthetic DBA fixture, never inferred from JWT roles or installed as production data.
 sql("CREATE ROLE s09c_verifier_a LOGIN NOINHERIT NOBYPASSRLS;CREATE ROLE s09c_verifier_b LOGIN NOINHERIT NOBYPASSRLS;GRANT ws_bootstrap_operator TO s09c_verifier_a,s09c_verifier_b;")
 sql("INSERT INTO auth.users SELECT('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(21,22)i;INSERT INTO workspace.accounts(id,user_id)SELECT('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(21,22)i;")
 sql("INSERT INTO workspace_bootstrap.operators VALUES('s09c_verifier_a','40000000-0000-0000-0000-000000000021',true),('s09c_verifier_b','40000000-0000-0000-0000-000000000022',true)")
 # User requests a school space via the existing public contract; no admin is minted.
 claims={'sub':'00000000-0000-0000-0000-000000000011','session_id':'30000000-0000-0000-0000-000000000011','exp':2000000000,'is_anonymous':False}
 def app(q,ok=True):return sql('SET SESSION AUTHORIZATION school_rest;BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"='+lit(json.dumps(claims))+';'+q+';COMMIT;',ok)
 app('SELECT public.ws_v1_bootstrap()');target=scalar("SELECT id FROM workspace.accounts WHERE user_id='00000000-0000-0000-0000-000000000011'");app("SELECT public.ws_s02_space('"+S+"',gen_random_uuid())")
 case('bootstrap school request remains pending and has no admin',lambda:check(scalar("SELECT count(*)FROM workspace.school_memberships WHERE school_id='"+S+"'AND role='SCHOOL_ADMIN'")=='0'))
 case('bootstrap applicant cannot self assign admin through existing RPC',lambda:check(app("SELECT public.ws_v1_set_member_role('"+S+"',gen_random_uuid(),'SCHOOL_ADMIN',1,gen_random_uuid())",False).returncode!=0))
 case('bootstrap applicant cannot call private operator function',lambda:check(app("SELECT workspace_bootstrap.command('propose','"+S+"','"+target+"',NULL,repeat('a',64),gen_random_uuid(),0,gen_random_uuid())",False).returncode!=0))
 case('bootstrap operator has no raw table UPDATE',lambda:check(sql("SET SESSION AUTHORIZATION s09c_verifier_a;SET ROLE ws_bootstrap_operator;UPDATE workspace.schools SET state='active'",False).returncode!=0))
 proof='a'*64;consent=str(uuid.uuid4());rid=str(uuid.uuid4())
 def command(who,op,s=S,t=target,c=None,p=proof,co=consent,ev=0,r=None,ok=True):
  args=[op,s,t,c,p,co,ev,r or str(uuid.uuid4())]
  q='SET SESSION AUTHORIZATION '+who+';SET ROLE ws_bootstrap_operator;SELECT workspace_bootstrap.command('+','.join(str(v)if isinstance(v,int)else lit(v)for v in args)+');'
  x=sql(q,ok);return json.loads(x.stdout.strip().splitlines()[-1])if ok else x
 case('bootstrap NULL expected_version denied',lambda:deny(command('s09c_verifier_a','propose',ev=None,ok=False),'expected_version_required'))
 case('bootstrap missing external proof or consent fails',lambda:deny(command('s09c_verifier_a','propose',p=None,ok=False),'verification_required'))
 proposal=command('s09c_verifier_a','propose',r=rid);cid=proposal['case_id']
 case('bootstrap verified operator proposal still cannot activate school',lambda:check(proposal['state']=='proposed'and scalar("SELECT state FROM workspace.schools WHERE id='"+S+"'")=='unclaimed'))
 case('bootstrap proposal replay is idempotent',lambda:check(command('s09c_verifier_a','propose',r=rid)==proposal))
 case('bootstrap request_id payload mismatch denied',lambda:deny(command('s09c_verifier_a','propose',p='b'*64,r=rid,ok=False),'idempotency_mismatch'))
 case('bootstrap proposer cannot approve own case',lambda:deny(command('s09c_verifier_a','approve',c=cid,ev=1,ok=False),'independent_operator_required'))
 case('bootstrap wrong school case ID denied',lambda:deny(command('s09c_verifier_b','approve',s=d['B'],c=cid,ev=1,ok=False),'independent_operator_required'))
 case('bootstrap mismatched consent evidence denied',lambda:deny(command('s09c_verifier_b','approve',c=cid,co=str(uuid.uuid4()),ev=1,ok=False),'verification_mismatch'))
 case('bootstrap expected version required',lambda:deny(command('s09c_verifier_b','approve',c=cid,ev=2,ok=False),'conflict'))
 sql("UPDATE workspace_bootstrap.cases SET expires_at=now()-interval '1 second'WHERE id='"+cid+"'")
 case('bootstrap expired verification cannot activate',lambda:deny(command('s09c_verifier_b','approve',c=cid,ev=1,ok=False),'conflict'))
 sql("UPDATE workspace_bootstrap.cases SET expires_at=now()+interval '1 hour'WHERE id='"+cid+"'")
 sql("UPDATE workspace_bootstrap.operators SET active=false WHERE db_principal='s09c_verifier_b'")
 case('bootstrap operator authority can be revoked immediately',lambda:deny(command('s09c_verifier_b','approve',c=cid,ev=1,ok=False),'operator_required'))
 sql("UPDATE workspace_bootstrap.operators SET active=true WHERE db_principal='s09c_verifier_b'")
 # Failure at the audit boundary must roll back role/school/case and receipt in one transaction.
 sql("CREATE FUNCTION workspace_bootstrap.test_fail()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit_test_failure';END$$;CREATE TRIGGER s09c_test_fail BEFORE INSERT ON workspace.audit_entries FOR EACH ROW EXECUTE FUNCTION workspace_bootstrap.test_fail()")
 try:
  case('bootstrap audit failure rolls back all activation',lambda:(deny(command('s09c_verifier_b','approve',c=cid,ev=1,ok=False),'audit_test_failure'),check(scalar("SELECT state FROM workspace.schools WHERE id='"+S+"'")=='unclaimed'),check(scalar("SELECT count(*)FROM workspace.school_memberships WHERE school_id='"+S+"'AND role='SCHOOL_ADMIN'")=='0')))
 finally:sql('DROP TRIGGER s09c_test_fail ON workspace.audit_entries;DROP FUNCTION workspace_bootstrap.test_fail()')
 approve_rid=str(uuid.uuid4());approved=command('s09c_verifier_b','approve',c=cid,ev=1,r=approve_rid)
 case('bootstrap second operator approves, school active with one admin',lambda:check(approved['state']=='approved'and scalar("SELECT count(*)FROM workspace.school_memberships WHERE school_id='"+S+"'AND role='SCHOOL_ADMIN'AND status='active'")=='1'))
 case('bootstrap approval replay cannot duplicate membership/audit',lambda:(check(command('s09c_verifier_b','approve',c=cid,ev=1,r=approve_rid)==approved),check(scalar("SELECT count(*)FROM workspace_bootstrap.audit WHERE case_id='"+cid+"'")=='2')))
 case('bootstrap new approval command after completion rejected',lambda:deny(command('s09c_verifier_b','approve',c=cid,ev=1,ok=False),'conflict'))
 case('bootstrap cannot seize an existing active school',lambda:deny(command('s09c_verifier_a','propose',s=d['A'],ok=False),'bootstrap_not_allowed'))
 case('bootstrap app administrator cannot modify operator audit',lambda:check(app('DELETE FROM workspace_bootstrap.audit',False).returncode!=0))
 case('bootstrap last admin still cannot leave',lambda:deny(app("SELECT public.ws_v1_leave_school('"+S+"',2,gen_random_uuid())",False),'last_admin'))
 # Deliberately inconsistent synthetic unclaimed school with an assistant target: never promote it.
 other='10000000-0000-0000-0000-000000000005';otheractor='40000000-0000-0000-0000-000000000012';othermid='20000000-0000-0000-0000-000000000012'
 sql("INSERT INTO workspace.schools VALUES('"+other+"','NEIS','B10','0000005','합성 검증 학교','unclaimed',1);INSERT INTO workspace.s02_directory VALUES('"+other+"','B10','0000005','합성 검증 학교','합성 교육청','합성 학교');INSERT INTO workspace.accounts(id,user_id)VALUES('"+otheractor+"','00000000-0000-0000-0000-000000000012');INSERT INTO workspace.first_admin_requests(school_id,actor_id,case_ref,state)VALUES('"+other+"','"+otheractor+"',gen_random_uuid(),'pending');BEGIN;INSERT INTO workspace.school_memberships(id,school_id,actor_id,member_code,role,status)VALUES('"+othermid+"','"+other+"','"+otheractor+"','M-SYNTHETIC-AUX','HEALTH_ASSISTANT','active');INSERT INTO workspace.membership_terms(school_id,membership_id,epoch)VALUES('"+other+"','"+othermid+"',1);COMMIT;")
 case('bootstrap cannot promote an existing assistant target',lambda:deny(command('s09c_verifier_a','propose',s=other,t=otheractor,ok=False),'invalid_target'))
 case('bootstrap ownership and RLS separation remains intact',lambda:check(scalar("SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='ws_owner')FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workspace_bootstrap'AND c.relkind='r'")=='t'))

 case('bootstrap Hosted supplemental metadata SELECT is executable locally',lambda:check(sql((E/'sql/hosted-readonly.sql').read_text()).returncode==0))
