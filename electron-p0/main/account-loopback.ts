import {createServer,type Server} from 'node:http';import {randomBytes} from 'node:crypto';
export type AccountReturn=Readonly<{code?:string;flowId:string;error:boolean;cancelled?:true}>;
export function parseAccountReturn(value:string,expected:string,flowId:string):AccountReturn|null{
 try{if(value.length>8192)return null;const u=new URL(value),e=new URL(expected),keys=[...u.searchParams.keys()];if(u.origin!==e.origin||u.pathname!==e.pathname||u.username||u.password||u.hash||new Set(keys).size!==keys.length||keys.some(k=>!['code','sb_flow_id','error','error_code','error_description'].includes(k))||u.searchParams.get('sb_flow_id')!==flowId)return null;
 if(u.searchParams.has('error'))return {flowId,error:true,...(u.searchParams.get('error')==='access_denied'?{cancelled:true}:{})};const code=u.searchParams.get('code');if(!code||code.length>2048||/[\s\x00-\x1f\x7f]/.test(code))return null;return {code,flowId,error:false};}catch{return null;}
}
export class AccountLoopback{
 private server:Server|undefined;private expected='';private flowId='';private consumed=false;private timer:ReturnType<typeof setTimeout>|undefined;
 async start(callback:(value:AccountReturn)=>void,expired:()=>void,timeout=180000){const path='/auth/callback/'+randomBytes(24).toString('hex');this.server=createServer((req,res)=>{
  const value=req.url&&this.flowId&&req.method==='GET'&&req.headers.host===new URL(this.expected).host&&(!req.headers.origin||req.headers.origin===new URL(this.expected).origin)?parseAccountReturn(req.url.startsWith('/')?new URL(req.url,this.expected).href:req.url,this.expected,this.flowId):null;
  res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");if(!value||this.consumed){res.writeHead(400);res.end('로그인 응답을 확인하지 못했습니다. 앱에서 다시 시도하세요.');return;}this.consumed=true;res.end('로그인 응답을 받았습니다. BOGUNON DESK로 돌아가세요.',()=>{this.close();callback(value);});
 });this.server.maxHeadersCount=16;this.server.headersTimeout=5000;this.server.requestTimeout=5000;
 await new Promise<void>((resolve,reject)=>{this.server!.once('error',reject);this.server!.listen(0,'127.0.0.1',()=>resolve());});const address=this.server.address();if(!address||typeof address==='string')throw Error();this.expected=`http://127.0.0.1:${address.port}${path}`;this.timer=setTimeout(()=>{this.close();expired();},timeout);this.timer.unref();return this.expected;}
 arm(flowId:string){if(!/^[A-Za-z0-9_-]{8,64}$/.test(flowId))throw Error();this.flowId=flowId;}
 close(){clearTimeout(this.timer);this.server?.close();this.server?.closeAllConnections();this.server=undefined;this.flowId='';}
}
