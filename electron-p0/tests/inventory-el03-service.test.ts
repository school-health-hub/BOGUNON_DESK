import {afterEach,expect,it,vi} from 'vitest';
import {InventoryQaService,inventoryQaHandler} from '../main/inventory-qa-service';
import {createElectronInventoryConnection} from '../main/inventory-connection/electron';
import {InventoryError} from '../main/inventory-connection/contracts';
import type {InventoryElectronTransport,InventoryTransportRequest} from '../main/inventory-connection/transport';
const school='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',user='20000000-0000-4000-8000-000000000001',item='30000000-0000-4000-8000-000000000001',lot='40000000-0000-4000-8000-000000000001';
const clients:InventoryQaService[]=[];afterEach(()=>{clients.splice(0).forEach(c=>c.close());vi.unstubAllGlobals();});
function harness(){
 const state={packaged:false,devUrl:'http://127.0.0.1:5174/' as string|undefined,optIn:'1' as string|undefined},host={readExecutionState:()=>({...state})};const calls:InventoryTransportRequest[]=[];let quantity=5n,uncertain=false;const seen=new Map<string,unknown>();let paused:((request:InventoryTransportRequest)=>Promise<unknown>|undefined)|undefined;
 const row=(sid:string)=>({school_id:sid,item_id:item,item_name:'합성 재고',category:null,specification:null,base_unit:'개',purchase_unit:'상자',base_units_per_purchase_unit:'1',recommended_stock:'0',minimum_stock:'0',is_active:true});
 const transport:InventoryElectronTransport={kind:'electron-local-qa',version:1,send:async r=>{
  calls.push(r);const pending=paused?.(r);if(pending)await pending;const sid=r.query.school_id?.slice(3)??String(r.body?.p_school_id??school);let body:unknown=[];
  if(r.path==='/auth/v1/token')body={access_token:`e30.${Buffer.from(JSON.stringify({role:'authenticated',sub:user})).toString('base64url')}.synthetic`,expires_in:3600,user:{id:user,email:r.body!.email}};
  else if(r.path==='/rest/v1/inventory_members')body=[{school_id:sid,user_id:user,role:'teacher_admin',is_active:true}];
  else if(r.path==='/rest/v1/inventory_items')body=[row(r.method==='POST'?String(r.body!.school_id):sid)];
  else if(r.path==='/rest/v1/inventory_stock_lots')body=[{school_id:sid,item_id:item,lot_id:lot,received_at:'2026-11-03T00:00:00.000Z',expires_on:null,remaining_quantity:String(quantity),initial_quantity:'5',status:'available'}];
  else if(r.path.startsWith('/rest/v1/rpc/')){
   const id=String(r.body!.p_request_uuid),old=seen.get(id);const op=r.path.split('_').at(-2)?.toUpperCase();if(!old)quantity-=1n;
   body=old?{...(old as object),replayed:true,status:'replayed'}:{school_id:sid,item_id:item,request_uuid:id,operation:op,quantity_delta:'-1',item_total_quantity:String(quantity),item_available_quantity:String(quantity),movements:[],processed_at:'2026-11-03T00:00:00.000Z',replayed:false,status:'applied',reactivation_required:false};seen.set(id,body);
   if(uncertain){uncertain=false;throw new InventoryError('NETWORK_ERROR',undefined,true);}
  }
  return {version:1,id:r.id,status:r.path==='/auth/v1/logout'?204:200,redirected:false,body:r.path==='/auth/v1/logout'?'':JSON.stringify(body)};
 }};
 const service=new InventoryQaService(host,()=> 'sb_publishable_synthetic',key=>createElectronInventoryConnection({enabled:true,endpoint:'http://127.0.0.1:56321',host,publishableKey:key,transport}));clients.push(service);
 let revision=0;const call=async(action:Parameters<InventoryQaService['call']>[0],input?:unknown)=>{const result=await service.call(action,input===undefined?[]:[input]);revision=result.ok?result.data.contextRevision:result.error.contextRevision;return result;};
 const data=async(action:Parameters<InventoryQaService['call']>[0],input?:unknown)=>{const result=await call(action,input);expect(result.ok,result.ok?'':result.error.message).toBe(true);if(!result.ok)throw Error(result.error.code);return result.data.value as any;};
 const logged=async()=>{await data('login',{email:'synthetic@example.invalid',password:crypto.randomUUID()});await data('selectSchool',{...ctx(),schoolId:school});};const ctx=()=>({contextRevision:revision});
 return {service,calls,state,call,data,logged,ctx,get quantity(){return quantity},setQuantity:(value:bigint)=>{quantity=value},uncertain:()=>{uncertain=true},pause:(fn:typeof paused)=>{paused=fn}};
}
it('uses real Adapter through Main service for auth, membership, UUID DTO reads, register and logout',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Renderer/global fetch forbidden')}));const h=harness();await h.logged();expect((await h.data('listItems',h.ctx()))[0].item_id).toBe(item);expect((await h.data('itemDetail',{...h.ctx(),itemId:item})).totals.totalQuantity).toBe('5');
 expect(await h.data('registerItem',{...h.ctx(),item:{item_name:'합성 신규',category:null,specification:null,base_unit:'개',purchase_unit:'상자',base_units_per_purchase_unit:'1',recommended_stock:'0',minimum_stock:'0',is_active:true}})).toMatchObject({persisted:true});
 expect(await h.data('logout')).toEqual({status:'signed_out'});expect(await h.data('authState')).toEqual({status:'signed_out'});expect(fetch).not.toHaveBeenCalled();expect(await h.call('listItems',h.ctx())).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
});
it('owns UUIDs, reuses immutable payloads on replay and refetches the server authority without a second decrement',async()=>{
 const h=harness();await h.logged();const input={operation:'inventory_use_stock',input:{p_item_id:item,p_quantity:'1',p_reason:'합성 사용'}};
 const prepared=await h.data('prepare',{...h.ctx(),...input});expect(prepared.requestUuid).toMatch(/^[0-9a-f-]{36}$/);expect(await h.data('prepare',{...h.ctx(),...input})).toEqual(prepared);
 expect(await h.data('execute',{...h.ctx(),handleId:prepared.handleId})).toMatchObject({persisted:true,data:{status:'applied'}});expect(await h.data('execute',{...h.ctx(),handleId:prepared.handleId})).toMatchObject({persisted:true,data:{status:'replayed'}});expect(h.quantity).toBe(4n);
 expect((await h.data('itemDetail',{...h.ctx(),itemId:item})).totals.totalQuantity).toBe('4');const rpc=h.calls.filter(r=>r.path.includes('/rpc/'));expect(rpc[0].body).toEqual(rpc[1].body);expect(rpc[0].body?.p_request_uuid).toBe(prepared.requestUuid);
});
it.each(['inventory_receive_stock','inventory_dispose_stock','inventory_adjust_stock'] as const)('dispatches %s via the existing validation/decoder',async operation=>{
 const h=harness();await h.logged();const base={p_item_id:item,p_reason:'합성 검증'};const input=operation==='inventory_receive_stock'?{...base,p_purchase_quantity:'1',p_base_units_per_purchase_unit:'1',p_received_at:'2026-11-03T00:00:00.000Z',p_expires_on:null,p_purchase_link_id:null}:operation==='inventory_dispose_stock'?{...base,p_lot_id:lot,p_quantity:'1'}:{...base,p_lot_id:lot,p_expected_quantity:'5',p_counted_quantity:'4'};
 const p=await h.data('prepare',{...h.ctx(),operation,input});expect(await h.data('execute',{...h.ctx(),handleId:p.handleId})).toMatchObject({persisted:true});
});
it('blocks new requests after an unknown result, retains UUID for explicit replay, and discard is not rollback',async()=>{
 const h=harness();await h.logged();const input={operation:'inventory_use_stock',input:{p_item_id:item,p_quantity:'1',p_reason:'합성 불명확'}};const prepared=await h.data('prepare',{...h.ctx(),...input});h.uncertain();
 expect(await h.call('execute',{...h.ctx(),handleId:prepared.handleId})).toMatchObject({ok:false,error:{outcomeUnknown:true,retryable:false}});expect(h.quantity).toBe(4n);
 expect(await h.data('prepare',{...h.ctx(),...input})).toEqual(prepared);expect(await h.call('prepare',{...h.ctx(),...input,input:{...input.input,p_reason:'다른 요청'}})).toMatchObject({ok:false,error:{outcomeUnknown:true}});
 const before=h.calls.length;await h.data('discard',{...h.ctx(),handleId:prepared.handleId});expect(h.calls).toHaveLength(before);expect(h.quantity).toBe(4n);expect(await h.call('prepare',{...h.ctx(),...input})).toMatchObject({ok:false,error:{outcomeUnknown:true}});
});
it('drops stale context and handles on school/account/mode changes; owner windows cannot share handles',async()=>{
 const h=harness();await h.logged();const context=h.ctx(),p=await h.data('prepare',{...context,operation:'inventory_use_stock',input:{p_item_id:item,p_quantity:'1',p_reason:'합성'}});
 await h.data('selectSchool',{...context,schoolId:other});expect(await h.call('listItems',context)).toMatchObject({ok:false,error:{code:'STALE_CONTEXT'}});expect(await h.call('execute',{...h.ctx(),handleId:p.handleId})).toMatchObject({ok:false,error:{code:'STALE_CONTEXT'}});
 const another=harness();await another.logged();expect(await another.call('execute',{...another.ctx(),handleId:p.handleId})).toMatchObject({ok:false,error:{code:'STALE_CONTEXT'}});
 await h.data('dispose');expect(await h.data('authState')).toEqual({status:'signed_out'});h.state.packaged=true;expect(await h.call('authState')).toMatchObject({ok:false,error:{code:'ENVIRONMENT_BLOCKED'}});
});
it('validates caller/frame/URL, exact arity, UUIDs, money/quantity and operation before any wire request',async()=>{
 const h=harness(),frame={},contents={mainFrame:frame,getURL:()=> 'file:///qa'},handler=inventoryQaHandler(h.service,'login',contents,'file:///qa');
 for(const event of [{sender:{},senderFrame:frame},{sender:contents,senderFrame:{}}])expect(await handler(event,{email:'synthetic@example.invalid',password:'synthetic'})).toMatchObject({ok:false});expect(h.calls).toHaveLength(0);
 expect(await h.call('login',{email:'real@example.com',password:'not allowed'})).toMatchObject({ok:false});expect(await h.service.call('authState',[{}])).toMatchObject({ok:false});expect(await h.call('login',null)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 await h.logged();const before=h.calls.length;expect(await h.call('listItems',{contextRevision:'1'})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 for(const input of [{...h.ctx(),operation:'sql',input:{}},{...h.ctx(),operation:'inventory_use_stock',input:{p_item_id:item,p_quantity:1,p_reason:'numeric forbidden'}},{...h.ctx(),operation:'inventory_use_stock',input:{p_item_id:'synthetic-1',p_quantity:'1',p_reason:'wrong ID'}},{...h.ctx(),operation:'inventory_use_stock',requestUuid:crypto.randomUUID(),input:{p_item_id:item,p_quantity:'1',p_reason:'untrusted UUID'}}])expect(await h.call('prepare',input)).toMatchObject({ok:false});expect(h.calls).toHaveLength(before);
});
it('ignores late responses after close and does not clear an in-flight mutation lock on concurrent reads',async()=>{
 const h=harness();await h.logged();let release!:()=>void;h.pause(r=>r.path.includes('/rpc/')?new Promise<void>(resolve=>{release=resolve}):undefined);
 const prepared=await h.data('prepare',{...h.ctx(),operation:'inventory_use_stock',input:{p_item_id:item,p_quantity:'1',p_reason:'합성'}});const pending=h.call('execute',{...h.ctx(),handleId:prepared.handleId});await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
 await h.call('authState');expect(await h.call('execute',{...h.ctx(),handleId:prepared.handleId})).toMatchObject({ok:false,error:{code:'REQUEST_IN_FLIGHT'}});h.service.close();release();expect(await pending).toMatchObject({ok:false,error:{outcomeUnknown:true}});
});

it('preserves bigint strings above JavaScript safe integers and never accepts numeric JSON IDs',async()=>{
 const h=harness();await h.logged();h.setQuantity(9007199254740993n);expect((await h.data('itemDetail',{...h.ctx(),itemId:item})).totals.totalQuantity).toBe('9007199254740993');expect(await h.call('itemDetail',{...h.ctx(),itemId:1})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
});
