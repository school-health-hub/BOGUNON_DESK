"""Real local PostgREST, ephemeral HS256 key, Docker-only HTTP; never Hosted."""
import json,subprocess,os,time,secrets,base64,hmac,hashlib,shlex,io,http.client,uuid
from pathlib import Path
IMAGE='postgrest/postgrest:v13.0.4@sha256:a312f4b2e48530a01fc26f5310d547d6c26d087858360e164522e415723a7732'
def run(sql,case,ROOT,DOCKER,NAME,ENV):
 image_name='bogunon-school07-rest-image'
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
 subprocess.run(args,check=True,capture_output=True,env=ENV)
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
 A='10000000-0000-0000-0000-000000000001';B=A[:-1]+'2'
 def expect_status(actual,status):assert actual[0]in status,(actual[0],str(actual[1])[:300])
 name='/rpc/ws_v1_list_inventory_items';body={'p_school_id':A,'p_payload':{}}
 case('LOCAL POSTGREST signed teacher inventories actual SQL',lambda:expect_status(request(name,body,token(3)),[200]))
 case('LOCAL POSTGREST anonymous inventory denied',lambda:expect_status(request(name,body),[401,403,404]))
 case('LOCAL POSTGREST expired JWT inventory denied',lambda:expect_status(request(name,body,token(3,exp=int(time.time())-60)),[401]))
 case('LOCAL POSTGREST assistant read, direct manage RPC forbidden',lambda:(expect_status(request(name,body,token(4)),[200]),expect_status(request('/rpc/ws_v1_create_inventory_item',{**body,'p_payload':{'name':'허용 안 됨'},'p_expected_version':0,'p_request_id':str(uuid.uuid4())},token(4)),[400,403])))
 case('LOCAL POSTGREST school A-only user cannot fetch school B inventory',lambda:expect_status(request(name,{**body,'p_school_id':B},token(4)),[400,403]))
 case('LOCAL POSTGREST raw inventory tables absent',lambda:expect_status(request('/shared_inventory_items',jwt=token(3)),[404]))
 case('LOCAL POSTGREST private dispatch function not a resource',lambda:expect_status(request('/rpc/s07_write',{'s':A,'op':'create','p':{},'ev':0,'r':str(uuid.uuid4())},token(3)),[404]))
 (ROOT/'evidence/local-postgrest.json').write_text(json.dumps({'classification':'LOCAL POSTGREST13.0.4 + synthetic Auth/HS256, NOT Hosted','checks':7,'image':IMAGE,'tokens_keys_saved':False,'hosted':'NOT RUN'},indent=2))
