import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import {StringDecoder} from 'node:string_decoder';
export class ChatGptError extends Error{constructor(readonly code:string){super(code);}}
export type ChatGptRunner={available:boolean;run:(request:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>;dispose:()=>void;flush:()=>Promise<void>};
// Authorization URLs never enter Renderer, logs or error messages.
export function validChatGptAuthorize(value:unknown):value is string{
 if(typeof value!=='string'||value.length>12000)return false;
 try{const u=new URL(value),q=u.searchParams,r=new URL(q.get('redirect_uri')??'');
 const allowed=['client_id','agent_name_hint','ext_agent_host_id','response_type','redirect_uri','scope','resource','state','nonce','code_challenge_method','code_challenge','id_token_hint','login_hint'];
 return u.origin==='https://auth.openai.com'&&u.pathname==='/api/accounts/authorize'&&!u.username&&!u.password&&!u.hash&&[...q.keys()].every(k=>allowed.includes(k)&&q.getAll(k).length===1)&&r.protocol==='http:'&&r.hostname==='127.0.0.1'&&!!r.port&&r.pathname==='/auth/callback'&&!r.search&&!r.hash&&!r.username&&!r.password&&q.get('response_type')==='code'&&q.get('resource')==='https://api.openai.com/v1'&&q.get('code_challenge_method')==='S256'&&['state','nonce','code_challenge'].every(k=>/^[A-Za-z0-9_-]{43}$/.test(q.get(k)??''))&&/^(dynamic_agent_client|oaiapp_[A-Za-z0-9_-]+)$/.test(q.get('client_id')??'')&&q.get('scope')==='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
 }catch{return false;}
}
export class ChatGptProcess implements ChatGptRunner{
 readonly available:boolean;
 private child:ChildProcessWithoutNullStreams|null=null;
 private pending:Promise<unknown>|null=null;
 constructor(private readonly executable:string,private readonly root:string,private readonly openBrowser:(url:string)=>Promise<void>,platform=process.platform,private readonly timeoutMs?:number){this.available=platform==='win32';}
 async run(request:Record<string,unknown>,signal:AbortSignal):Promise<unknown>{
  if(!this.available)throw new ChatGptError('unsupportedPlatform');
  if(this.pending)throw new ChatGptError('busy');
  const bytes=Buffer.from(JSON.stringify(request)+'\n');if(bytes.length>70000)throw new ChatGptError('input');
  const info=await lstat(this.executable).catch(()=>null);if(!info?.isFile()||info.isSymbolicLink())throw new ChatGptError('missingRuntime');
  if(signal.aborted)throw new ChatGptError('cancelled');
  const operation=this.start(bytes,request.action==='signIn',signal);this.pending=operation;
  try{return await operation;}finally{if(this.pending===operation)this.pending=null;}
 }
 private start(bytes:Buffer,signIn:boolean,signal:AbortSignal):Promise<unknown>{return new Promise((resolve,reject)=>{
  const env:NodeJS.ProcessEnv={};for(const key of ['SystemRoot','WINDIR','TEMP','TMP','PATH','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
  const child=spawn(this.executable,['--data-dir',this.root],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;
  const decoder=new StringDecoder('utf8');
  let output='',size=0,reply:unknown,hasReply=false,failed:string|null=null,browserSeen=false,browserOpened=false;
  const stop=(code:string)=>{failed??=code;child.kill();};
  const abort=()=>stop('cancelled');signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>stop('timeout'),this.timeoutMs??(signIn?330000:130000));
  child.stdout.on('data',(bytes:Buffer)=>{
   if(failed||signal.aborted)return;
   size+=bytes.length;if(size>1024*1024){stop('invalidResponse');return;}output+=decoder.write(bytes);
   let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end);output=output.slice(end+1);try{
    const event=JSON.parse(line);
    if(event?.event==='authorize'){
     if(!signIn||browserSeen||!validChatGptAuthorize(event.url)){stop('invalidResponse');continue;}browserSeen=true;
     void this.openBrowser(event.url).then(()=>{browserOpened=true;},()=>stop('browser'));
    }else{if(hasReply||typeof event?.ok!=='boolean'){stop('invalidResponse');continue;}hasReply=true;reply=event;}
   }catch{stop('invalidResponse');}}
  });
  // Ignore all native stderr, including unexpected dependency diagnostics.
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>stop('connection'));
  child.on('error',()=>{failed??='missingRuntime';});
  child.once('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(this.child===child)this.child=null;
   if(failed||signal.aborted||code!==0||(signIn&&!browserOpened)||(output+decoder.end()).trim()||!hasReply){reject(new ChatGptError(failed??'invalidResponse'));return;}
   const result=reply as {ok:boolean;data?:unknown;code?:unknown};if(!result.ok){reject(new ChatGptError(typeof result.code==='string'?result.code:'connection'));return;}resolve(result.data);
  });
  child.stdin.end(bytes);if(signal.aborted)abort();
 });}
 dispose(){this.child?.kill();}
 async flush(){await this.pending?.catch(()=>{});}
}
