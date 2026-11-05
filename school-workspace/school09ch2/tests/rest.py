"""Real local PostgREST, ephemeral HS256 key, Docker-only HTTP; never Hosted."""
import json,subprocess,os,time,secrets,base64,hmac,hashlib,shlex,io,http.client,uuid
from pathlib import Path
IMAGE='postgrest/postgrest:v13.0.4@sha256:a312f4b2e48530a01fc26f5310d547d6c26d087858360e164522e415723a7732'
def launch(args,env,runner=subprocess.run):
 try:
  p=runner(args,capture_output=True,env=env)
 except Exception:
  raise AssertionError('rest_startup_failed')from None
 if p.returncode:raise AssertionError('rest_startup_failed')

def launch_redaction(case):
 def test():
  import traceback
  marker='synthetic_signing_material_not_for_logs'
  def fail(args,**kw):raise subprocess.CalledProcessError(1,args)
  try:launch(['docker','-e','PGRST_JWT_SECRET='+marker],{},fail)
  except AssertionError as ex:
   text=''.join(traceback.format_exception(ex));assert marker not in text and 'rest_startup_failed'in text
  else:raise AssertionError('expected startup failure')
 case('MOCK failed REST startup never exposes signing material in traceback',test)

def run(sql,case,ROOT,DOCKER,NAME,ENV,run_file,check):
 launch_redaction(case)
 image_name='bogunon-school09ch2-rest-image'
 # Copy a pinned static binary, then remove the non-running source container.
 probe=subprocess.run(DOCKER+['inspect',image_name],capture_output=True,env=ENV)
 assert probe.returncode,'Refusing existing PostgREST image container'
 subprocess.run(DOCKER+['pull',IMAGE],check=True,capture_output=True,env=ENV)
 subprocess.run(DOCKER+['create','--name',image_name,'--network','none',IMAGE],check=True,capture_output=True,env=ENV)
 try:subprocess.run(DOCKER+['cp',image_name+':/bin/postgrest',str(ROOT/'evidence/postgrest.bin')],check=True,capture_output=True,env=ENV)
 finally:subprocess.run(DOCKER+['rm',image_name],check=True,capture_output=True,env=ENV)
 binary=ROOT/'evidence/postgrest.bin'
 subprocess.run(DOCKER+['cp',str(binary),NAME+':/tmp/postgrest'],check=True,capture_output=True,env=ENV);binary.unlink()
 key=secrets.token_urlsafe(64)
 args=DOCKER+['exec','-d','-e','PGRST_DB_URI=postgresql://school_rest@/school01a?host=/var/run/postgresql','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_SERVER_HOST=127.0.0.1','-e','PGRST_SERVER_PORT=3000','-e','PGRST_LOG_LEVEL=crit','-e','PGRST_JWT_SECRET='+key,NAME,'/tmp/postgrest']
 launch(args,ENV)
 def b64(b):return base64.urlsafe_b64encode(b).rstrip(b'=')
 def token(i=1,**changes):
  payload={'sub':f'00000000-0000-0000-0000-{i:012}','session_id':f'30000000-0000-0000-0000-{i:012}','role':'authenticated','exp':int(time.time())+300,'is_anonymous':False};payload.update(changes)
  s=b64(b'{"alg":"HS256","typ":"JWT"}')+b'.'+b64(json.dumps(payload).encode());return(s+b'.'+b64(hmac.new(key.encode(),s,hashlib.sha256).digest())).decode()
 def request(path,body=None,jwt=None,profile=None):
  body=''if body is None else json.dumps(body);method='POST'if body else'GET'
  headers=['Host: localhost','Connection: close','Content-Type: application/json','Content-Length: '+str(len(body.encode()))]
  if jwt:headers.append('Authorization: Bearer '+jwt)
  if profile:headers.append(('Content-Profile'if method=='POST'else'Accept-Profile')+': '+profile)
  message=method+' '+path+' HTTP/1.1\r\n'+'\r\n'.join(headers)+'\r\n\r\n'+body
  script='exec 3<>/dev/tcp/127.0.0.1/3000\nprintf %s '+shlex.quote(message)+' >&3\ntimeout 8 cat <&3\n'
  p=subprocess.run(DOCKER+['exec','-i',NAME,'bash'],input=script.encode(),capture_output=True,env=ENV,timeout=12)
  class Socket:
   def makefile(self,*a,**kw):return io.BytesIO(p.stdout)
  response=http.client.HTTPResponse(Socket());response.begin();data=response.read()
  return response.status,json.loads(data)if data else None
 for _ in range(40):
  try:request('/');break
  except Exception:time.sleep(.25)
 else:raise AssertionError('Local PostgREST readiness failed')
 A='10000000-0000-0000-0000-000000000001';B=A[:-1]+'2';sid1='30000000-0000-0000-0000-000000000003';sid2='39999999-0000-0000-0000-000000000003'
 sql("INSERT INTO auth.sessions(id,user_id)VALUES('"+sid2+"','00000000-0000-0000-0000-000000000003')")
 teacher=token(3);second=token(3,session_id=sid2);ctx='/rpc/ws_v1_get_context';c={'p_school_id':A}
 def status(r,allowed):assert r[0]in allowed,(r[0],str(r[1])[:400])
 case('HTTP approved teacher public→private→reader→Auth owner chain',lambda:status(request(ctx,c,teacher),[200]))
 case('HTTP anon and expired signed JWT denied',lambda:(status(request(ctx,c),[401,403,404]),status(request(ctx,c,token(3,exp=int(time.time())-60)),[401])))
 case('HTTP pending and other-school user denied',lambda:(status(request(ctx,c,token(5)),[400,403]),status(request(ctx,{'p_school_id':B},token(4)),[400,403])))
 task={'p_school_id':A,'p_title':'합성 운영 자료 점검','p_description':'일반 운영 업무','p_priority':'NORMAL','p_due_date':None,'p_assignees':[],'p_request_id':str(uuid.uuid4())}
 case('HTTP teacher write traverses unchanged business RPC',lambda:status(request('/rpc/ws_v1_create_task',task,teacher),[200]))
 sql("UPDATE workspace.school_memberships SET role='HEALTH_ASSISTANT'WHERE id='20000000-0000-0000-0000-000000000003'")
 case('HTTP live role downgrade blocks old JWT teacher write',lambda:status(request('/rpc/ws_v1_create_task',{**task,'p_request_id':str(uuid.uuid4())},teacher),[400,403]))
 sql("UPDATE workspace.school_memberships SET role='HEALTH_TEACHER',status='suspended'WHERE id='20000000-0000-0000-0000-000000000003'")
 case('HTTP live membership suspension blocks next request',lambda:status(request(ctx,c,teacher),[400,403]))
 sql("UPDATE workspace.school_memberships SET status='active'WHERE id='20000000-0000-0000-0000-000000000003'")
 case('HTTP two distinct sessions for same subject both initially valid',lambda:(status(request(ctx,c,teacher),[200]),status(request(ctx,c,second),[200])))
 sql("DELETE FROM auth.sessions WHERE id='"+sid1+"'")
 case('HTTP current revoked session denied while other session remains valid',lambda:(check(sql("SELECT count(*)FROM auth.sessions WHERE user_id='00000000-0000-0000-0000-000000000003'").stdout.strip()=='1'),status(request(ctx,c,teacher),[400,403]),status(request(ctx,c,second),[200])))
 sql("UPDATE auth.sessions SET not_after=now()-interval '1 second'WHERE id='"+sid2+"'")
 case('HTTP current session not_after expiry overrides valid JWT signature',lambda:status(request(ctx,c,second),[400,403]))
 sql("UPDATE auth.sessions SET not_after=NULL WHERE id='"+sid2+"'")
 case('HTTP purpose revocation RPC records current session',lambda:status(request('/rpc/ws_v1_revoke_current_session',{'p_request_id':str(uuid.uuid4())},second),[200]))
 case('HTTP app-revoked session denied with Auth row still present',lambda:(status(request(ctx,c,second),[400,403]),check(sql("SELECT count(*)FROM auth.sessions WHERE id='"+sid2+"'").stdout.strip()=='1')))
 case('HTTP mismatched sub/session binding and forged Auth role denied',lambda:(status(request(ctx,c,token(4,session_id=sid2)),[400,403]),status(request(ctx,c,token(3,role='supabase_auth_admin')),[400,401,403])))
 case('HTTP private/raw endpoints are not resources',lambda:(status(request('/shared_tasks',jwt=token(4)),[404]),status(request('/rpc/session_valid',{},token(4)),[404]),status(request('/session_valid',jwt=token(4),profile='workspace_auth_bridge'),[406])))
 before=sql('SELECT count(*)FROM workspace.shared_tasks').stdout.strip();run_file('h2_workspace','04-close-local.sql')
 def closed54():
  rows=json.loads(sql("SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',(SELECT jsonb_object_agg(arg,CASE WHEN typ='uuid'::regtype THEN to_jsonb('10000000-0000-0000-0000-000000000001'::text)WHEN typ='jsonb'::regtype THEN '{}'::jsonb WHEN typ IN('int8'::regtype,'int4'::regtype)THEN to_jsonb(0)WHEN typ='timestamptz'::regtype THEN 'null'::jsonb ELSE to_jsonb('HEALTH_TEACHER'::text)END)FROM unnest(p.proargnames,p.proargtypes::oid[])a(arg,typ))))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND left(p.proname,3)='ws_'").stdout.strip());assert len(rows)==54
  for row in rows:
   for jwt in [None,token(4)]:status(request('/rpc/'+row['name'],row['args']or{},jwt),[401,403,404])
 case('HTTP all54 CLOSED deny both anon/authenticated (108 requests,one grouped case)',closed54)
 case('HTTP closure retains existing task data',lambda:check(sql('SELECT count(*)FROM workspace.shared_tasks').stdout.strip()==before))
 (ROOT/'evidence/postgrest.json').write_text(json.dumps({'checks':15,'classification':'LOCAL PostgREST13.0.4 synthetic HS256/Auth only','hosted':'NOT RUN','tokens_keys_saved':False,'network':'none; loopback only'},indent=2))
