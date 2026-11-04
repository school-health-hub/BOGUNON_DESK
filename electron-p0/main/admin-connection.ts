import {safeAdminLaunchUrl} from '../admin-protocol.js';
import {ADMIN_CONNECTION_MESSAGES,type AdminConnectionCheck,type AdminConnectionState} from '../admin-connection.js';
export type AdminProbeFetch=(url:string,init:RequestInit)=>Promise<Response>;
export function allowedAdminProbeUrl(value:string){try{return safeAdminLaunchUrl(value)===value;}catch{return false;}}
// Explicit user action only; no cookies, downloads, bodies, GET fallback or credential probes.
export async function inspectAdminConnection(fetcher:AdminProbeFetch,registered:string,outer:AbortSignal,timeoutMs=8000):Promise<AdminConnectionCheck>{
 const initial=safeAdminLaunchUrl(registered),origin=new URL(initial).origin,controller=new AbortController();let timedOut=false,redirects=0;
 const abort=()=>controller.abort();outer.addEventListener('abort',abort,{once:true});if(outer.aborted)abort();const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 const result=(state:AdminConnectionState,status?:number,redirectOrigin?:string):AdminConnectionCheck=>({state,...(status===undefined?{}:{httpStatus:status}),redirects,...(redirectOrigin?{redirectOrigin}:{}),message:ADMIN_CONNECTION_MESSAGES[state]});
 const seen=new Set<string>();let target=initial;
 try{for(let i=0;i<4;i++){
  if(controller.signal.aborted)throw Error('Canceled');if(seen.has(target))return result('redirect-limit');seen.add(target);
  const response=await fetcher(target,{method:'HEAD',redirect:'manual',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:'text/html'}});
  try{
   if(controller.signal.aborted)throw Error('Canceled');
   if(response.redirected||response.url&&response.url!==target)return result('redirect-blocked',response.status);
   const status=response.status;if([301,302,303,307,308].includes(status)){
    const location=response.headers.get('location');if(!location||location.length>2000||/[\u0000-\u0020\u007f\\]/.test(location))return result('redirect-blocked',status);
    let next:URL;try{next=new URL(location,target);}catch{return result('redirect-blocked',status);}
    // Validate origin first. Query-bearing auth redirects are reported, never fetched or exposed.
    if(next.protocol!=='https:'||next.port||next.username||next.password)return result('redirect-blocked',status);
    try{safeAdminLaunchUrl(next.origin+next.pathname);}catch{return result('redirect-blocked',status);}
    redirects++;
    if(next.origin!==origin)return result('redirect-review',status,next.origin);
    if(/(?:^|\/)(?:login|signin|sso|auth)(?:\/|\.|$)/i.test(next.pathname))return result('authentication-required',status);
    if(next.search||next.hash)return result('redirect-review',status,next.origin);
    if(!allowedAdminProbeUrl(next.href))return result('redirect-blocked',status);
    target=next.href;continue;
   }
   if(status>=200&&status<300)return result('reachable',status);
   if(status===401||status===407)return result('authentication-required',status);
   if(status===403)return result('access-denied',status);
   if(status===404)return result('not-found',status);
   if(status===405||status===501)return result('method-unsupported',status);
   return result('unavailable',status);
  }finally{await response.body?.cancel().catch(()=>{});}
 }return result('redirect-limit');
 }catch{if(outer.aborted)throw Error('Canceled');return result(timedOut?'timeout':'network-error');}
 finally{clearTimeout(timer);outer.removeEventListener('abort',abort);}
}

// Electron's default certificate selection can use a system certificate even on
// a cookie-free fetch. Suppress it only for active Main probe origins.
export function createAdminProbeClient(fetcher:AdminProbeFetch){
 const active=new Map<string,number>();
 return {
  async fetch(url:string,init:RequestInit){
   const origin=new URL(safeAdminLaunchUrl(url)).origin;active.set(origin,(active.get(origin)??0)+1);
   try{return await fetcher(url,init);}finally{const remaining=(active.get(origin)??1)-1;if(remaining)active.set(origin,remaining);else active.delete(origin);}
  },
  denyCertificate(event:{preventDefault:()=>void},webContents:unknown,url:string,_certificates:unknown[],callback:()=>void){
   if(webContents!==null)return;let origin:string;try{origin=new URL(url).origin;}catch{return;}
   if(active.has(origin)){event.preventDefault();callback();}
  },
 };
}
