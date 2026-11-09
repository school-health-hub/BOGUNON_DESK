/** Local-only synthetic integration harness. Never deploy or use with real identities. */
import{createServer}from'node:https';import{readFile}from'node:fs/promises';import{resolve,extname}from'node:path';
import{createSchoolSession,ORIGIN}from'./session.js';import{WorkspaceAuthError}from'../../auth/common/types.js';import type{Action}from'../core/types.js';
const actions=new Set<Action>(['state','login','logout','search','select','refresh','join','space','withdraw','decide','role','membership','expiry','leave','propose','accept','mfaVerify','mfaCancel']);
const sessions=new Map<string,ReturnType<typeof createSchoolSession>>();
const uiRoot=resolve('build/school02-ui');
const server=createServer({key:await readFile(process.env.SCHOOL02_KEY!),cert:await readFile(process.env.SCHOOL02_CERT!)},async(req,res)=>{
 if(req.url?.startsWith('/api/school02')){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  let currentHandle='';
  try{
   if(req.url!=='/api/school02'||req.method!=='POST'||req.headers.origin!==ORIGIN||req.headers['content-type']!=='application/json')throw Error();
   let raw='';for await(const chunk of req){raw+=String(chunk);if(raw.length>4096)throw Error();}
   const body=JSON.parse(raw);if(!actions.has(body.action)||body.input!==undefined&&(body.input===null||Array.isArray(body.input)||typeof body.input!=='object'))throw Error();
   const cookies=Object.fromEntries(String(req.headers.cookie??'').split(';').map(v=>v.trim().split('=',2)).filter(v=>v.length===2));
   const oldHandle=cookies['__Host-ws_session'];currentHandle=oldHandle;let rig=sessions.get(oldHandle);
   if(body.action==='login'){
    if(rig){rig.setRequest({method:'POST',origin:ORIGIN,cookies,csrfToken:String(req.headers['x-ws-csrf']??'')});await rig.bff.status(rig.getRequest());await rig.controller.command('logout');sessions.delete(oldHandle);}
    const index=body.input?.fixture;if(![1,2,3,4,5,6,11,12,13,14].includes(index))throw Error();
    rig=createSchoolSession('web',index);const state=await rig.controller.command('login'),request=rig.getRequest();
    const handle=request.cookies['__Host-ws_session'];if(!handle)throw Error();sessions.set(handle,rig);res.setHeader('Set-Cookie',rig.getCookies());res.end(JSON.stringify({state,csrf:request.csrfToken}));return;
   }
   if(!rig)throw new WorkspaceAuthError('UNAUTHENTICATED');rig.setRequest({method:'POST',origin:ORIGIN,cookies,csrfToken:String(req.headers['x-ws-csrf']??'')});
   // Reject CSRF/Origin at the actual BFF before any controller mutation.
   await rig.bff.status(rig.getRequest());const state=await rig.controller.command(body.action,body.input??{});
   if(body.action==='logout'){res.setHeader('Set-Cookie',rig.getCookies());sessions.delete(oldHandle);}
   res.end(JSON.stringify({state}));
  }catch(e){if(e instanceof WorkspaceAuthError&&e.code==='UNAUTHENTICATED'){sessions.delete(currentHandle);res.statusCode=401;res.setHeader('Set-Cookie','__Host-ws_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');res.end(JSON.stringify({sessionExpired:true}));}else{res.statusCode=403;res.end(JSON.stringify({message:'공동 공간 요청을 확인해 주세요.'}));}}return;
 }
 try{
  if(req.method!=='GET')throw Error();const path=new URL(req.url??'/',ORIGIN).pathname;
  const relative=path.endsWith('/desktop.html')?'desktop.html':path.endsWith('/index.html')?'index.html':path.startsWith('/school02-ui/')?decodeURIComponent(path.slice('/school02-ui/'.length)):'';
  const file=resolve(uiRoot,relative);if(!relative||!file.startsWith(uiRoot+'/'))throw Error();
  const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'}as Record<string,string>)[extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch{res.statusCode=404;res.end('Not found');}
});
server.listen(5192,'127.0.0.1',()=>console.log('SCHOOL02 local synthetic UI/BFF/DB harness listening on loopback only'));
for(const sig of ['SIGINT','SIGTERM']as const)process.on(sig,()=>{server.close(()=>process.exit(0));});
