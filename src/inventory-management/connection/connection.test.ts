import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInventoryConnection } from './index';
import { createLocalQaConnection, validateLocalEndpoint } from './localQa';
import { validateRpc } from './validation';
import type { InventoryLocalConnection, RpcInputs, RpcName } from './contracts';
const school='10000000-0000-4000-8000-00000000000a';
const schoolB='20000000-0000-4000-8000-00000000000b';
const user='a1000000-0000-4000-8000-000000000001';
const item='a2000000-0000-4000-8000-000000000001';
const lot='a3000000-0000-4000-8000-000000000001';
const batch='a4000000-0000-4000-8000-000000000001';
const request='a5000000-0000-4000-8000-000000000001';
const config={endpoint:'http://127.0.0.1:56321',publishableKey:'sb_publishable_synthetic'};
const itemRow={school_id:school,item_id:item,item_name:'Synthetic Item',category:null,specification:null,base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:1,recommended_stock:10,minimum_stock:2,is_active:true};
const stockResponse={school_id:school,item_id:item,request_uuid:request,operation:'USE',quantity_delta:-1,item_total_quantity:4,item_available_quantity:4,movements:[],processed_at:new Date().toISOString(),replayed:false,status:'applied',reactivation_required:false};
let role='teacher_admin', membership=true;
let fetcher:ReturnType<typeof vi.fn>;
let clients:InventoryLocalConnection[]=[];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
let route:((url:URL,init:RequestInit)=>Promise<Response>|Response)|undefined;
beforeEach(()=>{
  role='teacher_admin'; membership=true; route=undefined;
  fetcher=vi.fn(async (url:string,init:RequestInit)=>{
    const u=new URL(url);
    const routed=route?.(u,init); if(routed) return routed;
    if(u.pathname==='/auth/v1/token') return json({access_token:[btoa(JSON.stringify({alg:'HS256'})),btoa(JSON.stringify({role:'authenticated'})),crypto.randomUUID().replace(/-/g,'')].join('.'),expires_in:3600,user:{id:user,email:JSON.parse(String(init.body)).email}});
    if(u.pathname==='/auth/v1/logout') return new Response(null,{status:204});
    if(u.pathname.endsWith('/inventory_members')) return json(membership?[{school_id:u.searchParams.get('school_id')!.slice(3),user_id:user,role,is_active:true}]:[]);
    if(u.pathname.endsWith('/inventory_items')) return json([itemRow]);
    if(u.pathname.endsWith('/inventory_stock_lots')) return json([]);
    if(u.pathname.includes('/rpc/')) return json(stockResponse);
    return json([]);
  });
  vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{for(const c of clients)c.dispose(); clients=[];vi.unstubAllGlobals();vi.useRealTimers();});
function client(){const c=createLocalQaConnection(config); clients.push(c);return c;}
async function logged(){const c=client(); await c.login('teacher-a@example.invalid',crypto.randomUUID()); await c.selectSchool(school);return c;}
const inputs:RpcInputs={
  inventory_use_stock:{p_item_id:item,p_quantity:'1',p_reason:'Synthetic use'},
  inventory_receive_stock:{p_item_id:item,p_purchase_quantity:'2',p_base_units_per_purchase_unit:'1',p_received_at:'2026-11-02T00:00:00Z',p_expires_on:null,p_purchase_link_id:null,p_reason:'Synthetic receive'},
  inventory_dispose_stock:{p_item_id:item,p_lot_id:lot,p_quantity:'1',p_reason:'Synthetic dispose'},
  inventory_adjust_stock:{p_item_id:item,p_lot_id:lot,p_expected_quantity:'2',p_counted_quantity:'1',p_reason:'Synthetic adjust'},
  inventory_reverse_movement:{p_original_movement_id:lot,p_reason:'Synthetic reverse'},
  inventory_create_purchase_batch:{p_batch_id:batch,p_note:null,p_lines:[{candidate_id:'synthetic',item_id:item,requested_purchase_quantity:'1',base_unit:'piece',purchase_unit:'box',base_units_per_purchase_unit:'1',specification_snapshot:null,expected_unit_price:null,currency:null}]},
  inventory_set_purchase_batch_status:{p_batch_id:batch,p_target_status:'APPROVED',p_reason:'Synthetic approve'},
  inventory_confirm_receipt:{p_batch_id:batch,p_receipt_id:lot,p_received_at:'2026-11-02T00:00:00Z',p_reason:'Synthetic receipt',p_lines:[{line_id:lot,received_purchase_quantity:'1',expires_on:null}]},
};
describe('environment and Preview',()=>{
  it('defaults to isolated synthetic Preview without any fetch',async()=>{
    const c=await createInventoryConnection(); expect(c.mode).toBe('preview');
    if(c.mode==='preview'){const r=await c.adapter.loadWorkspace();expect(r.mode).toBe('synthetic');expect(c.persisted).toBe(false);}
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['https://example.com','http://127.0.0.1:54321','http://127.0.0.1:56321/path','http://127.0.0.1:56321?x=1','http://user@127.0.0.1:56321','http://127.0.0.1.evil.invalid:56321','http://0.0.0.0:56321','https://localhost:56321','http://localhost:56321/#x'])('rejects endpoint %s',(endpoint)=>{expect(()=>createLocalQaConnection({...config,endpoint})).toThrow('ENVIRONMENT_BLOCKED');expect(fetcher).not.toHaveBeenCalled();});
  it.each(['http://localhost:56321','http://127.0.0.1:56321','http://[::1]:56321'])('permits only dedicated loopback %s',endpoint=>expect(validateLocalEndpoint(endpoint)).toBe(endpoint));
  it('blocks production mode and automatic enabling',async()=>{await expect(createInventoryConnection('production',config)).rejects.toMatchObject({code:'ENVIRONMENT_BLOCKED'});expect(fetcher).not.toHaveBeenCalled();});
  it('blocks privileged keys',()=>{expect(()=>createLocalQaConnection({...config,publishableKey:'sb_secret_synthetic'})).toThrow('ENVIRONMENT_BLOCKED');});
  it('checks browser origin at runtime',()=>{vi.stubGlobal('location',new URL('https://example.invalid'));expect(()=>client()).toThrow('ENVIRONMENT_BLOCKED');});
  it('has no fallback after local connection failure',async()=>{fetcher.mockRejectedValue(new Error('unavailable'));await expect(client().login('teacher-a@example.invalid',crypto.randomUUID())).rejects.toMatchObject({code:'NETWORK_ERROR'});expect(fetcher.mock.calls.every(([url])=>new URL(url).origin===config.endpoint)).toBe(true);});
});
describe('auth and context isolation',()=>{
  it('allows only reserved synthetic login accounts',async()=>{await expect(client().login('real@example.com',crypto.randomUUID())).rejects.toMatchObject({code:'INVALID_INPUT'});expect(fetcher).not.toHaveBeenCalled();});
  it('keeps public state token-free and session independent',async()=>{const a=await logged(),b=client();expect(a.authState()).toEqual({status:'authenticated',userId:user,schoolId:school});expect(b.authState()).toEqual({status:'signed_out'});await expect(b.listItems()).rejects.toMatchObject({code:'UNAUTHENTICATED'});});
  it('invalidates views on login, school change and logout',async()=>{const c=client(),fn=vi.fn();c.onInvalidate(fn);await c.login('teacher-a@example.invalid',crypto.randomUUID());await c.selectSchool(school);const n=fn.mock.calls.length;await c.logout();expect(fn.mock.calls.length).toBeGreaterThan(n);expect(c.authState()).toEqual({status:'signed_out'});expect(fetcher.mock.calls.some(([u])=>u.endsWith('/logout?scope=local'))).toBe(true);});
  it('clears local data before failed logout',async()=>{const c=await logged();route=(u)=>u.pathname.endsWith('/logout')?Promise.reject(Error('offline')):undefined as never;await expect(c.logout()).rejects.toMatchObject({code:'NETWORK_ERROR'});expect(c.authState().status).toBe('signed_out');});
  it('expires session and disallows reads',async()=>{vi.useFakeTimers();const c=await logged();await vi.advanceTimersByTimeAsync(3600001);expect(c.authState().status).toBe('expired');await expect(c.listItems()).rejects.toMatchObject({code:'UNAUTHENTICATED'});});
  it('rejects prepared mutations after school switch',async()=>{const c=await logged();const m=c.prepare('inventory_use_stock',inputs.inventory_use_stock,request);await c.selectSchool(schoolB);await expect(m.execute()).rejects.toMatchObject({code:'STALE_CONTEXT'});});
  it('rejects prepared mutations after account switch',async()=>{const c=await logged();const m=c.prepare('inventory_use_stock',inputs.inventory_use_stock,request);await c.login('instructor-a@example.invalid',crypto.randomUUID());await c.selectSchool(school);await expect(m.execute()).rejects.toMatchObject({code:'STALE_CONTEXT'});});
  it('drops in-flight reads when switching context',async()=>{const c=await logged();let complete!:(r:Response)=>void;route=(u)=>u.pathname.endsWith('/inventory_items')?new Promise(r=>{complete=r;}):undefined as never;const pending=c.listItems();await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));await c.selectSchool(schoolB);complete(json([itemRow]));await expect(pending).rejects.toMatchObject({code:'STALE_CONTEXT'});});
  it('Preview constructed after Local QA cannot see local data',async()=>{const c=await logged();await c.listItems();fetcher.mockClear();const p=await createInventoryConnection();if(p.mode==='preview')expect((await p.adapter.loadWorkspace()).items.every(i=>i.isSynthetic)).toBe(true);expect(fetcher).not.toHaveBeenCalled();});
});
describe('RLS-aware reads and exact totals',()=>{
  it('distinguishes missing membership from a genuinely empty item list',async()=>{const c=await logged();membership=false;await expect(c.listItems()).rejects.toMatchObject({code:'PERMISSION_DENIED'});membership=true;route=(u)=>u.pathname.endsWith('/inventory_items')?json([]):undefined as never;expect(await c.listItems()).toEqual([]);});
  it('refuses instructor purchase access before querying purchase tables',async()=>{const c=await logged();role='instructor';await expect(c.purchaseBatches()).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(fetcher.mock.calls.some(([u])=>u.includes('inventory_purchase'))).toBe(false);});
  it('keeps school filters on every read and rejects cross-school responses',async()=>{const c=await logged();route=(u)=>u.pathname.endsWith('/inventory_items')?json([{...itemRow,school_id:schoolB}]):undefined as never;await expect(c.listItems()).rejects.toMatchObject({code:'INVALID_RESPONSE'});expect(fetcher.mock.calls.filter(([u])=>u.includes('/rest/')).every(([u])=>new URL(u).searchParams.get('school_id')===`eq.${school}`)).toBe(true);});
  it('computes Seoul-day available stock excluding expired/quarantined lots',async()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-01T16:00:00Z'));const c=await logged();route=(u)=>u.pathname.endsWith('/inventory_stock_lots')?json([{school_id:school,item_id:item,lot_id:lot,received_at:'2026-01-01T00:00:00Z',expires_on:'2026-11-01',initial_quantity:3,remaining_quantity:3,status:'available'},{school_id:school,item_id:item,lot_id:batch,received_at:'2026-01-01T00:00:00Z',expires_on:'2026-11-02',initial_quantity:4,remaining_quantity:4,status:'available'}]):undefined as never;expect((await c.itemDetail(item)).totals).toMatchObject({totalQuantity:'7',availableQuantity:'4',referenceDate:'2026-11-02'});});
  it('rejects unsafe JSON bigint rather than rounding',async()=>{const c=await logged();route=(u)=>u.pathname.endsWith('/inventory_items')?json([{...itemRow,recommended_stock:Number.MAX_SAFE_INTEGER+1}]):undefined as never;await expect(c.listItems()).rejects.toMatchObject({code:'INVALID_RESPONSE'});});
  it('paginates all rows instead of accepting a gateway-truncated total',async()=>{const c=await logged();let pages=0;route=(u)=>u.pathname.endsWith('/inventory_items')?json(pages++===0?Array.from({length:500},()=>itemRow):[]):undefined as never;expect((await c.listItems()).length).toBe(500);expect(pages).toBe(2);});
});
describe('typed mutations and immutable retry UUID',()=>{
  it.each(Object.keys(inputs) as RpcName[])('validates actual SQL DTO for %s',name=>{expect(()=>validateRpc(name,inputs[name])).not.toThrow();});
  it('rejects extra fields, invalid dates, purchase linkage and missing required fields',()=>{
    expect(()=>validateRpc('inventory_use_stock',{...inputs.inventory_use_stock,p_school_id:school} as never)).toThrow();
    expect(()=>validateRpc('inventory_receive_stock',{...inputs.inventory_receive_stock,p_expires_on:'2026-02-31'})).toThrow();
    expect(()=>validateRpc('inventory_receive_stock',{...inputs.inventory_receive_stock,p_purchase_link_id:batch} as never)).toThrow();
    expect(()=>validateRpc('inventory_use_stock',{p_quantity:'1'} as never)).toThrow();
  });
  it('rejects unsafe quantities and duplicate purchase lines',()=>{
    expect(()=>validateRpc('inventory_use_stock',{...inputs.inventory_use_stock,p_quantity:'9223372036854775808'})).toThrow();
    expect(()=>validateRpc('inventory_confirm_receipt',{...inputs.inventory_confirm_receipt,p_lines:[inputs.inventory_confirm_receipt.p_lines[0],inputs.inventory_confirm_receipt.p_lines[0]]})).toThrow();
  });
  it('keeps payload/UUID on retry and only succeeds after server acknowledgement',async()=>{
    const c=await logged();const input={...inputs.inventory_use_stock};const m=c.prepare('inventory_use_stock',input,request);input.p_quantity='99';
    route=(u)=>u.pathname.includes('/rpc/')?Promise.reject(Error('offline')):undefined as never;
    await expect(m.execute()).rejects.toMatchObject({code:'NETWORK_ERROR',outcomeUnknown:true});
    route=(u)=>u.pathname.includes('/rpc/')?json({...stockResponse,replayed:true,status:'replayed'}):undefined as never;
    expect(await m.execute()).toMatchObject({persisted:true,refreshRequired:true,data:{replayed:true}});
    const calls=fetcher.mock.calls.filter(([u])=>u.includes('/rpc/'));expect(calls.length).toBe(2);expect(calls[0][1].body).toBe(calls[1][1].body);expect(JSON.parse(calls[0][1].body)).toMatchObject({p_request_uuid:request,p_quantity:'1',p_school_id:school});
  });
  it('blocks concurrent execution across handles sharing UUID',async()=>{const c=await logged();const a=c.prepare('inventory_use_stock',inputs.inventory_use_stock,request),b=c.prepare('inventory_use_stock',inputs.inventory_use_stock,request);let complete!:(r:Response)=>void;route=(u)=>u.pathname.includes('/rpc/')?new Promise(r=>{complete=r;}):undefined as never;const p=a.execute();await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));await expect(b.execute()).rejects.toMatchObject({code:'REQUEST_IN_FLIGHT'});complete(json(stockResponse));await p;});
  it('rejects a changed payload under the same request UUID',async()=>{const c=await logged();c.prepare('inventory_use_stock',inputs.inventory_use_stock,request);expect(()=>c.prepare('inventory_use_stock',{...inputs.inventory_use_stock,p_quantity:'2'},request)).toThrow('IDEMPOTENCY_CONFLICT');});
  it.each([[403,'PT403','PERMISSION_DENIED'],[409,'PT409','CONFLICT'],[422,'PT422','SERVER_REJECTED'],[401,'PT401','UNAUTHENTICATED']] as const)('normalizes HTTP %s without leaking backend details',async(status,code,expected)=>{const c=await logged();route=(u)=>u.pathname.includes('/rpc/')?json({code,message:'sensitive backend detail'},status):undefined as never;await expect(c.prepare('inventory_use_stock',inputs.inventory_use_stock,request).execute()).rejects.toMatchObject({code:expected,message:expected});});
  it('rejects an unrelated success response',async()=>{const c=await logged();route=(u)=>u.pathname.includes('/rpc/')?json({...stockResponse,school_id:schoolB}):undefined as never;await expect(c.prepare('inventory_use_stock',inputs.inventory_use_stock,request).execute()).rejects.toMatchObject({code:'INVALID_RESPONSE'});});
  it('keeps unsupported receipt reversal errors explicit',async()=>{const c=await logged();route=(u)=>u.pathname.includes('/rpc/')?json({code:'PT422',message:'PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY'},422):undefined as never;await expect(c.prepare('inventory_reverse_movement',inputs.inventory_reverse_movement,request).execute()).rejects.toMatchObject({serverCode:'PURCHASE_RECEIPT_REVERSAL_REQUIRES_POLICY'});});
  it('registers items only through column-scoped INSERT',async()=>{const c=await logged();const {school_id:_,item_id:__,...input}=itemRow;expect(await c.registerItem({...input,base_units_per_purchase_unit:'1',recommended_stock:'10',minimum_stock:'2'})).toMatchObject({persisted:true,item:{item_id:item}});const calls=fetcher.mock.calls.filter(([,init])=>init.method==='POST');expect(calls[calls.length-1][0]).toBe(`${config.endpoint}/rest/v1/inventory_items`);});
});

describe('all eight RPC acknowledgement contracts',()=>{
  const operation:Record<RpcName,string>={inventory_use_stock:'USE',inventory_receive_stock:'RECEIVE',inventory_dispose_stock:'DISPOSE',inventory_adjust_stock:'ADJUST',inventory_reverse_movement:'REVERSAL',inventory_create_purchase_batch:'PURCHASE_BATCH_CREATE',inventory_set_purchase_batch_status:'PURCHASE_BATCH_STATUS',inventory_confirm_receipt:'PURCHASE_RECEIPT_CONFIRM'};
  it.each(Object.keys(inputs) as RpcName[])('sends exact wire DTO and validates %s acknowledgement',async(name)=>{
    const c=await logged();
    const base={school_id:school,request_uuid:request,operation:operation[name],processed_at:new Date().toISOString(),replayed:false};
    const output=name==='inventory_create_purchase_batch'?{...base,batch_id:batch,status:'DRAFT',line_count:1}:name==='inventory_set_purchase_batch_status'?{...base,batch_id:batch,status:'APPROVED'}:name==='inventory_confirm_receipt'?{...base,batch_id:batch,receipt_id:lot,item_id:item,status:'PARTIALLY_RECEIVED',receipt_lines:[{line_id:lot,item_id:item,lot_id:lot,movement_id:item,received_base_quantity:1}],remaining_by_line:[{line_id:lot,remaining_base_quantity:1}]}:{...stockResponse,...base};
    route=(u)=>u.pathname.includes('/rpc/')?json(output):undefined as never;
    expect((await c.prepare(name,inputs[name],request).execute()).persisted).toBe(true);
    const calls=fetcher.mock.calls.filter(([u])=>u.includes('/rpc/'));expect(calls).toHaveLength(1);expect(calls[0][0]).toBe(`${config.endpoint}/rest/v1/rpc/${name}`);
    expect(JSON.parse(calls[0][1].body)).toEqual({p_school_id:school,p_request_uuid:request,...inputs[name]});
    expect(calls[0][1]).toMatchObject({redirect:'error',credentials:'omit',cache:'no-store'});
  });
  it('rejects malformed nested movement acknowledgement without returning success',async()=>{
    const c=await logged();route=(u)=>u.pathname.includes('/rpc/')?json({...stockResponse,movements:[{movement_id:lot,lot_id:lot,quantity_delta:1,quantity_before:10,quantity_after:99}]}):undefined as never;
    await expect(c.prepare('inventory_use_stock',inputs.inventory_use_stock,request).execute()).rejects.toMatchObject({code:'INVALID_RESPONSE',outcomeUnknown:true});
  });
  it('invalidates views only after write success',async()=>{
    const c=await logged(),fn=vi.fn();c.onInvalidate(fn);const m=c.prepare('inventory_use_stock',inputs.inventory_use_stock,request);
    await m.execute();expect(fn).toHaveBeenCalledTimes(1);
    route=(u)=>u.pathname.includes('/rpc/')?json({code:'PT409',message:'STALE_STOCK_STATE'},409):undefined as never;
    await expect(m.execute()).rejects.toMatchObject({code:'CONFLICT'});expect(fn).toHaveBeenCalledTimes(1);
  });
});
