// Real DB gate only. No mock transport and no operational endpoint fallback.
import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateHostCi,EXPECTED_CASES,DB_BASELINE} from './inventory-host-ci-policy.mjs';
let active='CONTEXT';const passedCases=[],services=[];
const run=(file,args,input)=>{const r=spawnSync(file,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:2*1024*1024});if(r.error||r.status!==0)throw Error('FIXTURE_COMMAND');return r.stdout;};
const sql=query=>run('docker',['exec','-i','supabase_db_inventory_qa','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],query).trim();
const id=()=>crypto.randomUUID();
const uuid=value=>{assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return value;};
const check=async(name,work)=>{active=name;await work();passedCases.push(name);};
let gatewayOwned=false,gatewayPaused=false,gatewayStopped=false;
try{
 validateHostCi(process.env,process.platform,process.cwd());
 const baseline=resolve('.inventory-db-baseline');assert.equal(run('git',['-C',baseline,'rev-parse','HEAD']).trim(),DB_BASELINE);
 const qa=resolve(baseline,'inventory-management/qa');const {readLocalStatus}=await import(pathToFileURL(resolve(qa,'ci/local-status.mjs')).href);const {key}=readLocalStatus(qa);
 const gateway=JSON.parse(run('docker',['inspect','supabase_kong_inventory_qa']))[0];assert.equal(gateway.Name,'/supabase_kong_inventory_qa');assert.equal(gateway.State.Running,true);gatewayOwned=true;
 const {InventoryQaService,inventoryQaHandler}=await import(pathToFileURL(resolve('build/electron-p0-app/main/inventory-qa-service.js')).href);
 const fixtureHttp=async path=>{const response=await fetch(`http://127.0.0.1:56321${path}`,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key}});const status=response.status;await response.body?.cancel();return status;};
 async function actor(){const email=`inv-el04-${id()}@example.invalid`,password=id()+'Aa1!';const response=await fetch('http://127.0.0.1:56321/auth/v1/signup',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.ok,true);const chunks=[];let bytes=0;assert.ok(response.body);for await(const chunk of response.body){bytes+=chunk.length;assert.ok(bytes<=32768);chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));return {email,password,userId:uuid(body.user.id)};}
 function client(){
  const state={packaged:false,devUrl:'http://127.0.0.1:5174/',optIn:'1'},host={readExecutionState:()=>({...state})};
  const service=new InventoryQaService(host,()=>key);services.push(service);let revision=0;const frame={},contents={mainFrame:frame,getURL:()=> 'http://127.0.0.1:5174/'},event={sender:undefined,senderFrame:frame};event.sender=contents;
  const raw=async(method,input)=>{const result=await inventoryQaHandler(service,method,contents,contents.getURL())(event,...(input===undefined?[]:[input]));revision=result.ok?result.data.contextRevision:result.error.contextRevision;return result;};
  const call=async(method,input)=>{const result=await raw(method,input);assert.equal(result.ok,true,`HOST_${method}`);return result.data.value;};
  const ctx=()=>({contextRevision:revision});const prepare=(operation,input)=>call('prepare',{...ctx(),operation,input});const execute=handle=>call('execute',{...ctx(),handleId:handle.handleId});
  return {state,raw,call,ctx,prepare,execute,service};
 }
 const school=id(),otherSchool=id();const teacher=client(),instructor=client(),outsider=client();let a,i,b,item,lot,useHandle;
 await check('AUTH_SCHOOL',async()=>{
  a=await actor();i=await actor();b=await actor();
  sql(`insert into public.inventory_schools(school_id,display_name) values('${school}','Synthetic INV EL04 A'),('${otherSchool}','Synthetic INV EL04 B');insert into public.inventory_members(school_id,user_id,role) values('${school}','${a.userId}','teacher_admin'),('${school}','${i.userId}','instructor'),('${otherSchool}','${b.userId}','teacher_admin');`);
  for(const [c,account,target] of [[teacher,a,school],[instructor,i,school],[outsider,b,otherSchool]]){await c.call('login',{email:account.email,password:account.password});const auth=await c.call('selectSchool',{...c.ctx(),schoolId:target});assert.equal(auth.schoolId,target);}
 });
 const newItem={item_name:'Synthetic INV EL04 item',category:null,specification:null,base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:'1',recommended_stock:'0',minimum_stock:'0',is_active:true};
 await check('REGISTER_READ_DETAIL',async()=>{
  const saved=await teacher.call('registerItem',{...teacher.ctx(),item:newItem});assert.equal(saved.persisted,true);item=uuid(saved.item.item_id);assert.ok((await teacher.call('listItems',teacher.ctx())).some(row=>row.item_id===item));const detail=await teacher.call('itemDetail',{...teacher.ctx(),itemId:item});assert.equal(detail.totals.totalQuantity,'0');
 });
 await check('RECEIVE_USE_REPLAY',async()=>{
  const receive=await teacher.prepare('inventory_receive_stock',{p_item_id:item,p_purchase_quantity:'10',p_base_units_per_purchase_unit:'1',p_received_at:new Date().toISOString(),p_expires_on:null,p_purchase_link_id:null,p_reason:'Synthetic receive'});const received=await teacher.execute(receive);assert.equal(received.persisted,true);lot=uuid(received.data.movements[0].lot_id);
  useHandle=await instructor.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'});
  const args={...instructor.ctx(),handleId:useHandle.handleId};const simultaneous=await Promise.all([instructor.raw('execute',args),instructor.raw('execute',args)]);assert.equal(simultaneous.filter(r=>r.ok).length,1);assert.equal(simultaneous.find(r=>!r.ok).error.code,'REQUEST_IN_FLIGHT');
  const replay=await instructor.execute(useHandle);assert.equal(replay.data.replayed,true);assert.equal((await teacher.call('itemDetail',{...teacher.ctx(),itemId:item})).totals.totalQuantity,'9');
  assert.equal(sql(`select count(*) from public.inventory_idempotency_requests where school_id='${school}' and request_uuid='${uuid(useHandle.requestUuid)}' and status='COMPLETED';`),'1');
 });
 await check('DISPOSE_ADJUST',async()=>{
  await teacher.execute(await teacher.prepare('inventory_dispose_stock',{p_item_id:item,p_lot_id:lot,p_quantity:'1',p_reason:'Synthetic dispose'}));
  await teacher.execute(await teacher.prepare('inventory_adjust_stock',{p_item_id:item,p_lot_id:lot,p_expected_quantity:'8',p_counted_quantity:'9',p_reason:'Synthetic count'}));
  assert.equal((await teacher.call('itemDetail',{...teacher.ctx(),itemId:item})).totals.totalQuantity,'9');assert.ok((await teacher.call('movements',{...teacher.ctx(),itemId:item})).length>=4);
 });
 await check('TENANT_PERMISSION',async()=>{
  assert.ok(!(await outsider.call('listItems',outsider.ctx())).some(row=>row.item_id===item));assert.equal((await outsider.raw('itemDetail',{...outsider.ctx(),itemId:item})).error.code,'NOT_FOUND');assert.equal((await outsider.raw('selectSchool',{...outsider.ctx(),schoolId:school})).error.code,'PERMISSION_DENIED');
  assert.equal((await instructor.raw('registerItem',{...instructor.ctx(),item:newItem})).error.code,'PERMISSION_DENIED');assert.equal((await instructor.raw('purchaseBatches',instructor.ctx())).error.code,'PERMISSION_DENIED');
 });
 await check('CONTEXT_DISCARD_LOGOUT',async()=>{
  const before=await teacher.call('itemDetail',{...teacher.ctx(),itemId:item}),pending=await teacher.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic discard'});await teacher.call('discard',{...teacher.ctx(),handleId:pending.handleId});assert.equal((await teacher.raw('execute',{...teacher.ctx(),handleId:pending.handleId})).error.code,'STALE_CONTEXT');assert.equal((await teacher.call('itemDetail',{...teacher.ctx(),itemId:item})).totals.totalQuantity,before.totals.totalQuantity);
  const old=await instructor.prepare('inventory_use_stock',{p_item_id:item,p_quantity:'1',p_reason:'Synthetic old context'});await instructor.call('logout');assert.equal((await instructor.raw('listItems',instructor.ctx())).error.code,'UNAUTHENTICATED');await instructor.call('login',{email:i.email,password:i.password});await instructor.call('selectSchool',{...instructor.ctx(),schoolId:school});assert.equal((await instructor.raw('execute',{...instructor.ctx(),handleId:old.handleId})).error.code,'STALE_CONTEXT');
 });
 await check('CLIENT_AUTH_EXPIRY',async()=>{
  // Real Auth token/session, controlled local-memory clock only. This does not
  // claim server JWT wall-clock expiry; no Auth response or transport is mocked.
  mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});try{mock.timers.tick(86401000);assert.equal((await instructor.call('authState')).status,'expired');assert.equal((await instructor.raw('listItems',instructor.ctx())).error.code,'UNAUTHENTICATED');}finally{mock.timers.reset();}
 });
 await check('REAL_GATEWAY_TIMEOUT',async()=>{
  run('docker',['pause','supabase_kong_inventory_qa']);gatewayPaused=true;try{const result=await teacher.raw('listItems',teacher.ctx());assert.equal(result.ok,false);assert.equal(result.error.code,'TRANSPORT_TIMEOUT');}finally{run('docker',['unpause','supabase_kong_inventory_qa']);gatewayPaused=false;}
 });
 await check('REAL_GATEWAY_DISCONNECT',async()=>{
  run('docker',['stop','--time','2','supabase_kong_inventory_qa']);gatewayStopped=true;try{const result=await teacher.raw('listItems',teacher.ctx());assert.equal(result.ok,false);assert.ok(['NETWORK_ERROR','TRANSPORT_TIMEOUT'].includes(result.error.code));}finally{run('docker',['start','supabase_kong_inventory_qa']);gatewayStopped=false;}
  let restored=false;for(let attempt=0;attempt<20;attempt++){try{if(await fixtureHttp('/auth/v1/health')===200){restored=true;break;}}catch{/* Bounded local readiness only. */}await new Promise(r=>setTimeout(r,500));}assert.equal(restored,true);assert.equal((await teacher.call('itemDetail',{...teacher.ctx(),itemId:item})).totals.totalQuantity,'9');
 });
 await check('PRODUCTION_DENIED',async()=>{
  const blocked=client();blocked.state.packaged=true;assert.equal((await blocked.raw('login',{email:a.email,password:a.password})).error.code,'ENVIRONMENT_BLOCKED');assert.equal((await teacher.call('itemDetail',{...teacher.ctx(),itemId:item})).totals.totalQuantity,'9');
 });
 assert.deepEqual(passedCases,EXPECTED_CASES);console.log(JSON.stringify({status:'PASS',realDatabase:true,mockTransport:false,actualElectronProcess:false,passedCases}));
}catch{
 console.log(JSON.stringify({status:'FAIL',realDatabase:false,mockTransport:false,actualElectronProcess:false,failedCase:active,passedCases}));process.exitCode=1;
}finally{
 for(const service of services)service.close();
 // Only this job's inspected gateway; outer always() still stops inventory_qa.
 try{if(gatewayOwned&&gatewayPaused)run('docker',['unpause','supabase_kong_inventory_qa']);if(gatewayOwned&&gatewayStopped)run('docker',['start','supabase_kong_inventory_qa']);}catch{process.exitCode=1;}
}
