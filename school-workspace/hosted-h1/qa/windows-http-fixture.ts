/** QA ONLY: real loopback HTTP + native PG, simulated Auth/REST gateway; NOT GoTrue/PostgREST. */
import {createServer} from 'node:http';import {createHmac,timingSafeEqual,randomBytes,randomUUID} from 'node:crypto';import {writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';
import {sql} from '../../../scripts/qa/school05-native-pg.js';import {sqlTypes} from './sql-types.js';
const literal=(v:unknown)=>v===null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
export async function startFixture(root:string){
 const secret=randomBytes(32),password=randomBytes(32).toString('base64url'),accounts=[1,2,3,4,5,6,9,11].map(id=>({id,label:'H1 합성 계정 '+id,email:`h1-${id}@example.invalid`,password}));
 const sessions=new Map<string,{index:number;sid:string;refresh:string}>();let stopped=false,rejectNextLogin=false;
 const user=(i:number)=>({id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`,email:`h1-${i}@example.invalid`,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},is_anonymous:false});
 const sign=(x:object)=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify(x)).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',secret).update(h+'.'+p).digest('base64url');};
 const claims=(token:string)=>{const[h,p,s]=token.split('.'),expected=createHmac('sha256',secret).update(h+'.'+p).digest(),actual=Buffer.from(s??'','base64url');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error('unauthenticated_or_revoked');const c=JSON.parse(Buffer.from(p,'base64url').toString());if(c.exp<=Date.now()/1000||!sessions.has(c.session_id))throw Error('unauthenticated_or_revoked');return c;};
 const response=(i:number,sid:string,refresh:string)=>{const u=user(i),exp=Math.floor(Date.now()/1000)+300;return {access_token:sign({sub:u.id,role:'authenticated',session_id:sid,exp,is_anonymous:false,aud:'authenticated'}),refresh_token:refresh,expires_in:300,expires_at:exp,token_type:'bearer',user:u};};
 const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');const send=(s:number,x:unknown)=>{res.writeHead(s);res.end(JSON.stringify(x));};try{
  const u=new URL(req.url??'','http://127.0.0.1');let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>1100000)throw Error('input_rejected');}const b=text?JSON.parse(text):{};
  if(req.method==='POST'&&u.pathname==='/auth/v1/token'){
   if(u.searchParams.get('grant_type')==='password'){if(rejectNextLogin){rejectNextLogin=false;throw Error('unauthenticated_or_revoked');}const a=accounts.find(a=>a.email===b.email&&a.password===b.password);if(!a)throw Error('unauthenticated_or_revoked');const sid=randomUUID(),refresh=randomBytes(32).toString('base64url');await sql(`INSERT INTO auth.sessions(id,user_id)VALUES('${sid}','${user(a.id).id}')`);sessions.set(sid,{index:a.id,sid,refresh});send(200,response(a.id,sid,refresh));return;}
   const old=[...sessions.values()].find(s=>s.refresh===b.refresh_token);if(!old)throw Error('unauthenticated_or_revoked');old.refresh=randomBytes(32).toString('base64url');send(200,response(old.index,old.sid,old.refresh));return;
  }
  const c=claims((req.headers.authorization??'').replace(/^Bearer /,''));
  if(u.pathname==='/auth/v1/user'){send(200,user(Number(String(c.sub).slice(-12))));return;}
  if(u.pathname==='/auth/v1/logout'){sessions.delete(c.session_id);await sql(`DELETE FROM auth.sessions WHERE id='${c.session_id}'`);res.writeHead(204);res.end();return;}
  const n=u.pathname.slice('/rest/v1/rpc/'.length);if(!u.pathname.startsWith('/rest/v1/rpc/')||req.method!=='POST'||!Object.hasOwn(sqlTypes,n))throw Error('input_rejected');
  const fields=sqlTypes[n as keyof typeof sqlTypes];if(Object.keys(b).sort().join()!==fields.map(([k])=>k).sort().join())throw Error('input_rejected');
  const values=fields.map(([k,t])=>t.endsWith('[]')&&Array.isArray(b[k])?'ARRAY['+b[k].map(literal).join(',')+']::'+t:t==='jsonb'?literal(JSON.stringify(b[k]))+'::jsonb':literal(b[k])+'::'+t);
  const result=await sql(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=${literal(JSON.stringify(c))};SELECT public.${n}(${values.join(',')});COMMIT;`,'school_client');send(200,JSON.parse(result));
 }catch(e){const raw=String((e as {stderr?:unknown}).stderr??(e as Error).message);const message=/unauthenticated_or_revoked/.test(raw)?'unauthenticated_or_revoked':/access_denied|admin_required|not_found_or_denied/.test(raw)?'access_denied':/conflict|idempotency/.test(raw)?'conflict':/input_rejected/.test(raw)?'input_rejected':'network_error';send(message==='unauthenticated_or_revoked'?401:message==='access_denied'?403:message==='network_error'?503:400,{message});}});
 server.maxHeadersCount=24;server.requestTimeout=15000;server.headersTimeout=5000;await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('fixture_bind');const config=join(root,'h1-private-config.json');await writeFile(config,JSON.stringify({origin:`http://127.0.0.1:${address.port}`,publicKey:'sb_publishable_h1_fixture',accounts}),{mode:0o600,flag:'wx'});
 return {config,expireSessions:()=>sessions.clear(),failNextLogin:()=>{rejectNextLogin=true;},close:async()=>{if(stopped)return;stopped=true;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));sessions.clear();secret.fill(0);await rm(config,{force:true});}};
}
