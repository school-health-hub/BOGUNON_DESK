/** Local-only synthetic integration harness. Never deploy or use with real identities. */
import{createServer}from'node:https';import{readFile}from'node:fs/promises';import{resolve,extname}from'node:path';
import{createTaskSession,ORIGIN}from'./session.js';import{TASK_ACTIONS,type TaskAction}from'../core/types.js';import{WorkspaceAuthError}from'../../auth/common/types.js';import type{Action}from'../../school02/core/types.js';
const actions=new Set<Action>(['state','login','logout','search','select','refresh','join','space','withdraw','decide','role','membership','expiry','leave','propose','accept','reauth']);
const sessions=new Map<string,ReturnType<typeof createTaskSession>>();
const uiRoot=resolve('build/school03-ui');
const server=createServer({key:await readFile(process.env.SCHOOL03_KEY!),cert:await readFile(process.env.SCHOOL03_CERT!)},async(req,res)=>{
 if(req.url?.startsWith('/api/school03/')){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  let currentHandle='';
  try{
   if(!['/api/school03/school','/api/school03/tasks'].includes(req.url)||req.method!=='POST'||req.headers.origin!==ORIGIN||req.headers['content-type']!=='application/json')throw Error();
   let raw='';for await(const chunk of req){raw+=String(chunk);if(raw.length>4096)throw Error();}
   const body=JSON.parse(raw);const isTask=req.url==='/api/school03/tasks';if(!(isTask?TASK_ACTIONS.includes(body.action):actions.has(body.action))||body.input!==undefined&&(body.input===null||Array.isArray(body.input)||typeof body.input!=='object'))throw Error();
   const cookies=Object.fromEntries(String(req.headers.cookie??'').split(';').map(v=>v.trim().split('=',2)).filter(v=>v.length===2));
   const oldHandle=cookies['__Host-ws_session'];currentHandle=oldHandle;let rig=sessions.get(oldHandle);
   if(!isTask&&body.action==='login'){
    if(rig){rig.tasks.invalidate();rig.school.setRequest({method:'POST',origin:ORIGIN,cookies,csrfToken:String(req.headers['x-ws-csrf']??'')});await rig.school.bff.status(rig.school.getRequest());await rig.school.controller.command('logout');sessions.delete(oldHandle);}
    const index=body.input?.fixture;if(![1,2,3,4,5,6,9,11,12,13,14].includes(index))throw Error();
    rig=createTaskSession('web',index);const state=await rig.school.controller.command('login'),request=rig.school.getRequest();
    const handle=request.cookies['__Host-ws_session'];if(!handle)throw Error();sessions.set(handle,rig);res.setHeader('Set-Cookie',rig.school.getCookies());res.end(JSON.stringify({state,csrf:request.csrfToken}));return;
   }
   if(!rig)throw new WorkspaceAuthError('UNAUTHENTICATED');rig.school.setRequest({method:'POST',origin:ORIGIN,cookies,csrfToken:String(req.headers['x-ws-csrf']??'')});
   // Reject CSRF/Origin at the actual BFF before any controller mutation.
   await rig.school.bff.status(rig.school.getRequest());if(!isTask&&['login','logout','select'].includes(body.action))rig.tasks.invalidate();const state=isTask?await rig.tasks.command(body.action as TaskAction,body.input??{}):await rig.school.controller.command(body.action,body.input??{});
   if(body.action==='logout'){res.setHeader('Set-Cookie',rig.school.getCookies());sessions.delete(oldHandle);}
   res.end(JSON.stringify({state}));
  }catch(e){if(e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'){sessions.delete(currentHandle);res.statusCode=401;res.setHeader('Set-Cookie','__Host-ws_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.end(JSON.stringify({sessionExpired:true}));}else{res.statusCode=403;res.end(JSON.stringify({message:'공동 공간 요청을 확인해 주세요.'}));}}return;
 }
 try{
  if(req.method!=='GET')throw Error();const path=new URL(req.url??'/',ORIGIN).pathname;
  const relative=path.endsWith('/desktop.html')?'desktop.html':path.endsWith('/index.html')?'index.html':path.startsWith('/school03-ui/')?decodeURIComponent(path.slice('/school03-ui/'.length)):'';
  const file=resolve(uiRoot,relative);if(!relative||!file.startsWith(uiRoot+'/'))throw Error();
  const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'}as Record<string,string>)[extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch{res.statusCode=404;res.end('Not found');}
});
server.listen(5193,'127.0.0.1',()=>console.log('SCHOOL03 local synthetic UI/BFF/DB harness listening on loopback only'));
for(const sig of ['SIGINT','SIGTERM']as const)process.on(sig,()=>{server.close(()=>process.exit(0));});
