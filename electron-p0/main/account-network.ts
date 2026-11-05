export type AccountConfig=Readonly<{origin:string;publishableKey:string}>;
export function parseAccountConfig(value:unknown):AccountConfig|null{
 try{const v=value as AccountConfig,u=new URL(v.origin),key=typeof v.publishableKey==='string'?v.publishableKey.trim():'';if(u.origin!==v.origin||u.protocol!=='https:'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v.origin)||typeof key!=='string'||key.length>4096)return null;
 const role=key.split('.')[1];if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)&&(!role||JSON.parse(Buffer.from(role,'base64url').toString()).role!=='anon'))return null;return {origin:u.origin,publishableKey:key};}catch{return null;}
}
export const SCHOOL_COLUMNS='neis_office_code,neis_school_code,neis_school_name,neis_office_name';
export function allowedAccountRequest(value:string,method:string,origin:string){
 try{const u=new URL(value);if(u.origin!==origin||u.username||u.password||u.hash)return false;
 if(method==='GET'&&u.pathname==='/auth/v1/user'&&!u.search)return true;
 if(method==='POST'&&u.pathname==='/auth/v1/token')return [...u.searchParams.keys()].join(',')==='grant_type'&&['pkce','refresh_token'].includes(u.searchParams.get('grant_type')??'');
 if(method==='POST'&&u.pathname==='/auth/v1/logout')return [...u.searchParams.keys()].join(',')==='scope'&&u.searchParams.get('scope')==='local';
 if(method==='GET'&&u.pathname==='/rest/v1/user_settings')return u.searchParams.size===2&&u.searchParams.get('select')===SCHOOL_COLUMNS&&/^eq\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(u.searchParams.get('user_id')??'');return false;}catch{return false;}
}
export function accountFetch(config:AccountConfig,fetcher:typeof fetch,signal:AbortSignal){
 return async(input:RequestInfo|URL,init:RequestInit={})=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url,method=(init.method??'GET').toUpperCase();if(signal.aborted||!allowedAccountRequest(url,method,config.origin))throw Error('Account request denied');
 const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});init.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,10000);
 try{const response=await fetcher(url,{...init,method,signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store'});if(response.redirected||response.url&&response.url!==url||controller.signal.aborted)throw Error();if(response.status===204)return new Response('{}');if(!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const part=await reader.read();if(controller.signal.aborted)throw Error();if(part.done)break;size+=part.value.length;if(size>256*1024)throw Error();chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return new Response(Buffer.concat(chunks),{status:response.status,headers:{'content-type':'application/json'}});}catch{throw Error('Account network request failed');}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);init.signal?.removeEventListener('abort',abort);}
 };
}
