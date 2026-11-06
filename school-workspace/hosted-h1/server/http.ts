import {rpcArgs,type RpcName} from './contracts.js';
export class H1Error extends Error {constructor(readonly code:'CONFIGURATION'|'INPUT'|'NETWORK'|'AUTH'|'DENIED'|'CONFLICT'|'STALE'|'LIMIT'|'REAUTH'){super(code);}}
export type H1Config=Readonly<{mode:'isolated-test'|'hosted-candidate';origin:string;publicKey:string;projectRef?:string}>;
export function checkedConfig(c:H1Config):H1Config{
 try{const u=new URL(c.origin);if(u.origin!==c.origin||u.username||u.password||u.search||u.hash)throw Error();
 if(c.mode==='isolated-test'){if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||Number(u.port)<1024)throw Error();}
 else if(c.mode!=='hosted-candidate'||!c.projectRef||!/^[a-z]{20}$/.test(c.projectRef)||u.origin!==`https://${c.projectRef}.supabase.co`)throw Error();
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publicKey)){
  if(c.mode!=='isolated-test')throw Error();const j=JSON.parse(Buffer.from(c.publicKey.split('.')[1]??'','base64url').toString());if(c.publicKey.split('.').length!==3||j.role!=='anon')throw Error();
 }
 return Object.freeze({...c});}catch{throw new H1Error('CONFIGURATION');}
}
const authPaths=new Set(['/auth/v1/token','/auth/v1/user','/auth/v1/logout','/auth/v1/.well-known/jwks.json']);
/** Main only. No caller URL proxy, ambient cookies, redirects, service keys or unbounded bodies. */
export class H1Http{
 readonly config:H1Config;private pending=new Set<Promise<Response>>();private requests=new Set<AbortController>();
 abortPending(){for(const c of this.requests)c.abort();}
 async drain(){this.abortPending();await Promise.allSettled([...this.pending]);}
 constructor(config:H1Config,private readonly wire:typeof fetch=fetch,readonly timeoutMs=10000){this.config=checkedConfig(config);}
 readonly fetch:typeof fetch=(input,init)=>{const p=this.request(input,init);this.pending.add(p);void p.then(()=>this.pending.delete(p),()=>this.pending.delete(p));return p;};
 private async request(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1]):Promise<Response>{
  let u:URL;try{u=new URL(input instanceof Request?input.url:String(input));}catch{throw new H1Error('CONFIGURATION');}
  const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase(),rpc=u.pathname.startsWith('/rest/v1/rpc/')?u.pathname.slice(13):'';
  if(u.origin!==this.config.origin||u.username||u.password||u.hash||(!authPaths.has(u.pathname)&&!Object.hasOwn(rpcArgs,rpc))||
   (rpc&&(method!=='POST'||u.search))||(!rpc&&!['GET','POST'].includes(method)))throw new H1Error('CONFIGURATION');
  if(init?.body&&typeof init.body!=='string'||typeof init?.body==='string'&&Buffer.byteLength(init.body)>1100000)throw new H1Error('LIMIT');
  const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));headers.set('apikey',this.config.publicKey);
  const a=headers.get('authorization');if(a?.startsWith('Bearer sb_')&&!a.endsWith(this.config.publicKey))throw new H1Error('AUTH');
  const owned=new AbortController();this.requests.add(owned);const timeout=AbortSignal.timeout(this.timeoutMs),signal=AbortSignal.any([owned.signal,timeout,...(init?.signal?[init.signal]:[])]);let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;let abort=()=>{};
  try{return await Promise.race([(async()=>{const r=await this.wire(u,{...init,method,headers,signal,redirect:'error',credentials:'omit',cache:'no-store'});
   if(r.status>=300&&r.status<400||r.redirected)throw new H1Error('NETWORK');
   reader=r.body?.getReader();let n=0;const chunks:Uint8Array[]=[];
   if(reader)try{for(;;){const{done,value}=await reader.read();if(done)break;n+=value.length;if(n>4*1024*1024){await reader.cancel();throw new H1Error('LIMIT');}chunks.push(value);}}finally{reader.releaseLock();}
   return new Response(r.status===204?null:Buffer.concat(chunks),{status:r.status,headers:r.headers});})(),new Promise<Response>((_,reject)=>{abort=()=>{void reader?.cancel().catch(()=>{});reject(new H1Error(init?.signal?.aborted||owned.signal.aborted?'STALE':'NETWORK'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});})]);
  }catch(e){if(e instanceof H1Error)throw e;throw new H1Error(init?.signal?.aborted?'STALE':'NETWORK');}finally{signal.removeEventListener('abort',abort);this.requests.delete(owned);}
 }
 async rpc(token:string,name:string,args:object,signal:AbortSignal):Promise<unknown>{
  if(!Object.hasOwn(rpcArgs,name)||Object.keys(args).sort().join()!==[...rpcArgs[name as RpcName]].sort().join())throw new H1Error('INPUT');
  const r=await this.fetch(`${this.config.origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal});
  if(signal.aborted)throw new H1Error('STALE');
  if(!r.ok){let code='';try{code=String((await r.json()).message??'');}catch{}
   throw new H1Error(r.status===401||/unauthenticated_or_revoked/.test(code)?'AUTH':/conflict|idempotency|version/.test(code)?'CONFLICT':/reauth_required/.test(code)?'REAUTH':r.status===403||/access_denied|admin_required|not_found_or_denied/.test(code)?'DENIED':r.status>=500?'NETWORK':'INPUT');}
  let value:unknown;try{value=await r.json();}catch{throw new H1Error('NETWORK');}
  if(value&&typeof value==='object'&&!Array.isArray(value)&&'error'in value)throw new H1Error(value.error==='INPUT_REJECTED'?'INPUT':'NETWORK');return value;
 }
}
